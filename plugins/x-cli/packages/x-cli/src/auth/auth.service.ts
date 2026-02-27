import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TwitterApi } from "twitter-api-v2";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";

interface TokenData {
	access_token: string;
	refresh_token: string;
	expires_at: number;
}

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);
	private readonly tokenPath: string;
	private readonly callbackPort = 3000;

	constructor(private readonly config: ConfigService) {
		this.tokenPath = path.join(os.homedir(), ".x-cli", "tokens.json");
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
		return tokens.expires_at > Date.now() + 5 * 60 * 1000;
	}

	/**
	 * Get authenticated Twitter client, refreshing if needed
	 */
	async getClient(): Promise<TwitterApi> {
		const tokens = this.getTokens();

		if (!tokens) {
			throw new Error("Not authenticated. Run 'x login' first.");
		}

		// Check if token needs refresh
		if (tokens.expires_at <= Date.now() + 5 * 60 * 1000) {
			await this.refreshTokens(tokens.refresh_token);
			const newTokens = this.getTokens();
			if (!newTokens) {
				throw new Error("Failed to refresh tokens");
			}
			return new TwitterApi(newTokens.access_token);
		}

		return new TwitterApi(tokens.access_token);
	}

	/**
	 * Refresh expired tokens
	 */
	private async refreshTokens(refreshToken: string): Promise<void> {
		const clientId = this.config.get<string>("X_CLIENT_ID");
		const clientSecret = this.config.get<string>("X_CLIENT_SECRET");

		if (!clientId || !clientSecret) {
			throw new Error("Missing X_CLIENT_ID or X_CLIENT_SECRET in environment");
		}

		const client = new TwitterApi({
			clientId,
			clientSecret,
		});

		const { accessToken, refreshToken: newRefreshToken, expiresIn } =
			await client.refreshOAuth2Token(refreshToken);

		this.saveTokens({
			access_token: accessToken,
			refresh_token: newRefreshToken ?? refreshToken,
			expires_at: Date.now() + (expiresIn ?? 7200) * 1000,
		});

		this.logger.log("Tokens refreshed successfully");
	}

	/**
	 * Start OAuth 2.0 PKCE flow
	 */
	async login(): Promise<void> {
		const clientId = this.config.get<string>("X_CLIENT_ID");
		const clientSecret = this.config.get<string>("X_CLIENT_SECRET");

		if (!clientId || !clientSecret) {
			throw new Error("Missing X_CLIENT_ID or X_CLIENT_SECRET in environment");
		}

		const client = new TwitterApi({ clientId, clientSecret });
		const callbackUrl = `http://localhost:${this.callbackPort}/callback`;

		// Let the library generate PKCE verifier and challenge
		const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
			callbackUrl,
			{
				scope: ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
			}
		);

		console.log("\nOpening browser for authentication...");
		console.log(`If it doesn't open, visit: ${url}\n`);

		// Open browser
		await this.openBrowser(url);

		// Start callback server
		const code = await this.waitForCallback(state);

		// Exchange code for tokens
		const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
			code,
			codeVerifier,
			redirectUri: callbackUrl,
		});

		this.saveTokens({
			access_token: accessToken,
			refresh_token: refreshToken ?? "",
			expires_at: Date.now() + (expiresIn ?? 7200) * 1000,
		});

		console.log("Authentication successful! Tokens saved.");
	}

	/**
	 * Generate PKCE code verifier
	 */
	private generateCodeVerifier(): string {
		return crypto.randomBytes(32).toString("base64url");
	}

	/**
	 * Generate PKCE code challenge from verifier
	 */
	private generateCodeChallenge(verifier: string): string {
		return crypto.createHash("sha256").update(verifier).digest("base64url");
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
	private waitForCallback(expectedState: string): Promise<string> {
		return new Promise((resolve, reject) => {
			let timeoutId: ReturnType<typeof setTimeout>;

			const cleanup = () => {
				clearTimeout(timeoutId);
			};

			const server = http.createServer((req, res) => {
				const url = new URL(req.url ?? "", `http://localhost:${this.callbackPort}`);

				if (url.pathname === "/callback") {
					const code = url.searchParams.get("code");
					const state = url.searchParams.get("state");
					const error = url.searchParams.get("error");

					if (error) {
						res.writeHead(400, { "Content-Type": "text/html" });
						res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
						cleanup();
						server.close();
						reject(new Error(`OAuth error: ${error}`));
						return;
					}

					if (state !== expectedState) {
						res.writeHead(400, { "Content-Type": "text/html" });
						res.end("<h1>Authentication Failed</h1><p>State mismatch</p>");
						cleanup();
						server.close();
						reject(new Error("State mismatch - possible CSRF attack"));
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
				this.logger.debug(`Callback server listening on port ${this.callbackPort}`);
			});

			// Timeout after 5 minutes
			timeoutId = setTimeout(() => {
				server.close();
				reject(new Error("Authentication timed out"));
			}, 5 * 60 * 1000);
		});
	}
}
