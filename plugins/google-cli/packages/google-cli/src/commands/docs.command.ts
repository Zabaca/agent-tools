import {
	Command,
	CommandRunner,
	SubCommand,
	Option,
} from "nest-commander";
import { Injectable } from "@nestjs/common";
import { readFileSync } from "fs";
import { DocsService } from "../docs/docs.service.js";

interface GetOptions {
	tab?: string;
	listTabs?: boolean;
}

@Injectable()
@SubCommand({
	name: "get",
	description: "Get document content",
	arguments: "<documentId>",
})
class DocsGetCommand extends CommandRunner {
	constructor(private readonly docs: DocsService) {
		super();
	}

	@Option({
		flags: "-t, --tab <nameOrIndex>",
		description: "Fetch a specific tab by name or 0-based index",
	})
	parseTab(val: string): string {
		return val;
	}

	@Option({
		flags: "--list-tabs",
		description: "List all tabs in the document",
	})
	parseListTabs(): boolean {
		return true;
	}

	async run(params: string[], options?: GetOptions): Promise<void> {
		const [documentId] = params;

		if (!documentId) {
			console.error("Error: Document ID is required");
			process.exit(1);
		}

		try {
			if (options?.listTabs) {
				const tabs = await this.docs.listTabs(documentId);
				console.log(`\nDocument tabs:`);
				for (const tab of tabs) {
					console.log(`  ${tab.index}: ${tab.title}`);
				}
				return;
			}

			const doc = await this.docs.getDocument(documentId, options?.tab);

			console.log(`\n=== ${doc.title} ===\n`);
			console.log(doc.body);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			}
			process.exit(1);
		}
	}
}

@Injectable()
@SubCommand({
	name: "create",
	description: "Create a new document",
	arguments: "<title>",
})
class DocsCreateCommand extends CommandRunner {
	constructor(private readonly docs: DocsService) {
		super();
	}

	async run(params: string[]): Promise<void> {
		const [title] = params;

		if (!title) {
			console.error("Error: Document title is required");
			process.exit(1);
		}

		try {
			const documentId = await this.docs.createDocument(title);

			console.log(`\nDocument created successfully!`);
			console.log(`  Title: ${title}`);
			console.log(`  ID: ${documentId}`);
			console.log(
				`  URL: https://docs.google.com/document/d/${documentId}/edit`
			);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			}
			process.exit(1);
		}
	}
}

interface WriteOptions {
	file?: string;
	append?: boolean;
	markdown?: boolean;
}

@Injectable()
@SubCommand({
	name: "write",
	description: "Write content to a document",
	arguments: "<documentId> [content]",
})
class DocsWriteCommand extends CommandRunner {
	constructor(private readonly docs: DocsService) {
		super();
	}

	@Option({
		flags: "-f, --file <path>",
		description: "Read content from file instead of argument",
	})
	parseFile(val: string): string {
		return val;
	}

	@Option({
		flags: "-a, --append",
		description: "Append to document instead of replacing",
	})
	parseAppend(): boolean {
		return true;
	}

	@Option({
		flags: "-m, --markdown",
		description: "Parse markdown and apply formatting (headings, bold, code blocks, etc.)",
	})
	parseMarkdown(): boolean {
		return true;
	}

	async run(params: string[], options?: WriteOptions): Promise<void> {
		const [documentId, contentArg] = params;

		if (!documentId) {
			console.error("Error: Document ID is required");
			process.exit(1);
		}

		let content: string;

		if (options?.file) {
			try {
				content = readFileSync(options.file, "utf-8");
			} catch (error) {
				console.error(`Error reading file: ${options.file}`);
				process.exit(1);
			}
		} else if (contentArg) {
			content = contentArg;
		} else {
			console.error("Error: Content is required (use --file or provide as argument)");
			process.exit(1);
		}

		try {
			if (options?.append) {
				await this.docs.appendDocument(documentId, content);
				console.log(`\nContent appended to document successfully!`);
			} else if (options?.markdown) {
				await this.docs.writeMarkdown(documentId, content);
				console.log(`\nMarkdown content written with formatting!`);
			} else {
				await this.docs.writeDocument(documentId, content);
				console.log(`\nDocument content replaced successfully!`);
			}
			console.log(
				`  URL: https://docs.google.com/document/d/${documentId}/edit`
			);
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
	name: "docs",
	description: "Google Docs operations",
	subCommands: [DocsGetCommand, DocsCreateCommand, DocsWriteCommand],
})
export class DocsCommand extends CommandRunner {
	async run(): Promise<void> {
		console.log("Use 'google docs --help' for available subcommands");
	}
}

export { DocsGetCommand, DocsCreateCommand, DocsWriteCommand };
