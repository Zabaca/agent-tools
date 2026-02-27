import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google, Auth } from "googleapis";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";

interface TokenData {
	access_token: string;
	refresh_token: string;
	expiry_date: number;
	token_type: string;
	scope: string;
}

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	private readonly tokenPath: string;
	private readonly callbackPort = 3001;
	private oauth2Client: Auth.OAuth2Client | null = null;

	private readonly SCOPES = [
		"https://www.googleapis.com/auth/drive",
		"https://www.googleapis.com/auth/documents",
		"https://www.googleapis.com/auth/spreadsheets",
	];

	constructor(private readonly config: ConfigService) {
		this.tokenPath = path.join(os.homedir(), ".google-cli", "tokens.json");
	}

	/**
	 * Get or create OAuth2 client
	 */
	private getOAuth2Client(): Auth.OAuth2Client {
		if (this.oauth2Client) {
			return this.oauth2Client;
		}

		const clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
		const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");

		if (!clientId || !clientSecret) {
			throw new Error(
				"Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment"
			);
		}

		this.oauth2Client = new google.auth.OAuth2(
			clientId,
			clientSecret,
			`http://localhost:${this.callbackPort}/callback`
		);

		return this.oauth2Client;
	}

	/**
	 * Get stored tokens or null if not authenticated
	 */
	getTokens(): TokenData | null {
		try {
			if (fs.existsSync(this.tokenPath)) {
				const data = fs.readFileSync(this.tokenPath, "utf-8");
				return JSON.parse(data) as TokenData;
			}
		} catch {
			this.logger.warn("Failed to read tokens file");
		}
		return null;
	}

	/**
	 * Save tokens to disk
	 */
	private saveTokens(tokens: TokenData): void {
		const dir = path.dirname(this.tokenPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2));
		fs.chmodSync(this.tokenPath, 0o600); // Secure permissions
	}

	/**
	 * Check if we have valid tokens
	 */
	isAuthenticated(): boolean {
		const tokens = this.getTokens();
		if (!tokens) return false;
		// Check if token is expired (with 5 min buffer)
		return tokens.expiry_date > Date.now() + 5 * 60 * 1000;
	}

	/**
	 * Get authenticated OAuth2 client, refreshing if needed
	 */
	async getAuthenticatedClient(): Promise<Auth.OAuth2Client> {
		const tokens = this.getTokens();

		if (!tokens) {
			throw new Error("Not authenticated. Run 'google login' first.");
		}

		const client = this.getOAuth2Client();
		client.setCredentials(tokens);

		// Check if token needs refresh
		if (tokens.expiry_date <= Date.now() + 5 * 60 * 1000) {
			this.logger.debug("Refreshing expired tokens...");
			const { credentials } = await client.refreshAccessToken();
			const newTokens: TokenData = {
				access_token: credentials.access_token ?? "",
				refresh_token: credentials.refresh_token ?? tokens.refresh_token,
				expiry_date: credentials.expiry_date ?? Date.now() + 3600 * 1000,
				token_type: credentials.token_type ?? "Bearer",
				scope: credentials.scope ?? this.SCOPES.join(" "),
			};
			this.saveTokens(newTokens);
			client.setCredentials(newTokens);
			this.logger.log("Tokens refreshed successfully");
		}

		return client;
	}

	/**
	 * Start OAuth 2.0 flow
	 */
	async login(): Promise<void> {
		const client = this.getOAuth2Client();

		const authUrl = client.generateAuthUrl({
			access_type: "offline",
			scope: this.SCOPES,
			prompt: "consent", // Force consent to get refresh token
		});

		console.log("\nOpening browser for authentication...");
		console.log(`If it doesn't open, visit: ${authUrl}\n`);

		// Open browser
		await this.openBrowser(authUrl);

		// Start callback server and wait for code
		const code = await this.waitForCallback();

		// Exchange code for tokens
		const { tokens } = await client.getToken(code);

		const tokenData: TokenData = {
			access_token: tokens.access_token ?? "",
			refresh_token: tokens.refresh_token ?? "",
			expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
			token_type: tokens.token_type ?? "Bearer",
			scope: tokens.scope ?? this.SCOPES.join(" "),
		};

		this.saveTokens(tokenData);
		console.log("Authentication successful! Tokens saved.");
	}

	/**
	 * Open URL in default browser
	 */
	private async openBrowser(url: string): Promise<void> {
		const { exec } = await import("node:child_process");
		const platform = process.platform;

		let command: string;
		if (platform === "darwin") {
			command = `open "${url}"`;
		} else if (platform === "win32") {
			command = `start "${url}"`;
		} else {
			command = `xdg-open "${url}"`;
		}

		exec(command, (err) => {
			if (err) {
				this.logger.warn("Could not open browser automatically");
			}
		});
	}

	/**
	 * Start temporary HTTP server to receive OAuth callback
	 */
	private waitForCallback(): Promise<string> {
		return new Promise((resolve, reject) => {
			let timeoutId: ReturnType<typeof setTimeout>;

			const cleanup = () => {
				clearTimeout(timeoutId);
			};

			const server = http.createServer((req, res) => {
				const url = new URL(
					req.url ?? "",
					`http://localhost:${this.callbackPort}`
				);

				if (url.pathname === "/callback") {
					const code = url.searchParams.get("code");
					const error = url.searchParams.get("error");

					if (error) {
						res.writeHead(400, { "Content-Type": "text/html" });
						res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
						cleanup();
						server.close();
						reject(new Error(`OAuth error: ${error}`));
						return;
					}

					if (!code) {
						res.writeHead(400, { "Content-Type": "text/html" });
						res.end("<h1>Authentication Failed</h1><p>No code received</p>");
						cleanup();
						server.close();
						reject(new Error("No authorization code received"));
						return;
					}

					res.writeHead(200, { "Content-Type": "text/html" });
					res.end(`
						<html>
							<body style="font-family: system-ui; text-align: center; padding: 50px;">
								<h1>Authentication Successful!</h1>
								<p>You can close this window and return to the terminal.</p>
							</body>
						</html>
					`);

					cleanup();
					server.close();
					resolve(code);
				}
			});

			server.listen(this.callbackPort, () => {
				this.logger.debug(
					`Callback server listening on port ${this.callbackPort}`
				);
			});

			// Timeout after 5 minutes
			timeoutId = setTimeout(() => {
				server.close();
				reject(new Error("Authentication timed out"));
			}, 5 * 60 * 1000);
		});
	}
}
