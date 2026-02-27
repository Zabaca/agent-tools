import { Command, CommandRunner, Option } from "nest-commander";
import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";

interface LoginOptions {
	force?: boolean;
}

@Injectable()
@Command({
	name: "login",
	description: "Authenticate with Google using OAuth 2.0",
})
export class LoginCommand extends CommandRunner {
	constructor(private readonly auth: AuthService) {
		super();
	}

	async run(_params: string[], options: LoginOptions): Promise<void> {
		try {
			if (this.auth.isAuthenticated() && !options.force) {
				console.log("Already authenticated!");
				console.log("Use --force to re-authenticate.");
				process.exit(0);
			}

			await this.auth.login();
			process.exit(0);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Authentication failed: ${error.message}`);
			} else {
				console.error("An unexpected error occurred during authentication");
			}
			process.exit(1);
		}
	}

	@Option({
		flags: "-f, --force",
		description: "Force re-authentication even if already logged in",
	})
	parseForce(): boolean {
		return true;
	}
}
