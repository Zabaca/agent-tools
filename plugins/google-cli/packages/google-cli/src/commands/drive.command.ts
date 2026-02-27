import {
	Command,
	CommandRunner,
	SubCommand,
	Option,
} from "nest-commander";
import { Injectable } from "@nestjs/common";
import { DriveService } from "../drive/drive.service.js";

interface ListOptions {
	query?: string;
	limit?: number;
}

@Injectable()
@SubCommand({
	name: "list",
	description: "List files in Google Drive",
})
class DriveListCommand extends CommandRunner {
	constructor(private readonly drive: DriveService) {
		super();
	}

	async run(_params: string[], options: ListOptions): Promise<void> {
		try {
			const files = await this.drive.listFiles({
				query: options.query,
				pageSize: options.limit,
			});

			if (files.length === 0) {
				console.log("No files found.");
				return;
			}

			console.log("\nFiles in Drive:\n");
			for (const file of files) {
				const modified = file.modifiedTime
					? new Date(file.modifiedTime).toLocaleDateString()
					: "unknown";
				console.log(`  ${file.name}`);
				console.log(`    ID: ${file.id}`);
				console.log(`    Type: ${file.mimeType}`);
				console.log(`    Modified: ${modified}`);
				console.log("");
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			}
			process.exit(1);
		}
	}

	@Option({
		flags: "-q, --query <query>",
		description: "Search query (Drive query syntax)",
	})
	parseQuery(val: string): string {
		return val;
	}

	@Option({
		flags: "-l, --limit <limit>",
		description: "Maximum number of files to return",
	})
	parseLimit(val: string): number {
		return parseInt(val, 10);
	}
}

@Injectable()
@SubCommand({
	name: "get",
	description: "Get file metadata",
	arguments: "<fileId>",
})
class DriveGetCommand extends CommandRunner {
	constructor(private readonly drive: DriveService) {
		super();
	}

	async run(params: string[]): Promise<void> {
		const [fileId] = params;

		if (!fileId) {
			console.error("Error: File ID is required");
			process.exit(1);
		}

		try {
			const file = await this.drive.getFile(fileId);

			console.log("\nFile Details:\n");
			console.log(`  Name: ${file.name}`);
			console.log(`  ID: ${file.id}`);
			console.log(`  Type: ${file.mimeType}`);
			if (file.modifiedTime) {
				console.log(
					`  Modified: ${new Date(file.modifiedTime).toLocaleString()}`
				);
			}
			if (file.size) {
				console.log(`  Size: ${file.size} bytes`);
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			}
			process.exit(1);
		}
	}
}

@Injectable()
@Command({
	name: "drive",
	description: "Google Drive operations",
	subCommands: [DriveListCommand, DriveGetCommand],
})
export class DriveCommand extends CommandRunner {
	async run(): Promise<void> {
		console.log("Use 'google drive --help' for available subcommands");
	}
}

export { DriveListCommand, DriveGetCommand };
