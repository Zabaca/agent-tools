import {
	Command,
	CommandRunner,
	SubCommand,
	Option,
} from "nest-commander";
import { Injectable } from "@nestjs/common";
import { SheetsService } from "../sheets/sheets.service.js";

@Injectable()
@SubCommand({
	name: "get",
	description: "Get spreadsheet information",
	arguments: "<spreadsheetId>",
})
class SheetsGetCommand extends CommandRunner {
	constructor(private readonly sheets: SheetsService) {
		super();
	}

	async run(params: string[]): Promise<void> {
		const [spreadsheetId] = params;

		if (!spreadsheetId) {
			console.error("Error: Spreadsheet ID is required");
			process.exit(1);
		}

		try {
			const info = await this.sheets.getSpreadsheet(spreadsheetId);

			console.log(`\n=== ${info.title} ===\n`);
			console.log(`  ID: ${info.spreadsheetId}`);
			console.log(`  URL: ${info.url}`);
			console.log(`  Sheets: ${info.sheets.join(", ")}`);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			}
			process.exit(1);
		}
	}
}

interface ReadOptions {
	format?: "table" | "json" | "csv";
}

@Injectable()
@SubCommand({
	name: "read",
	description: "Read data from a spreadsheet range",
	arguments: "<spreadsheetId> <range>",
})
class SheetsReadCommand extends CommandRunner {
	constructor(private readonly sheets: SheetsService) {
		super();
	}

	async run(params: string[], options: ReadOptions): Promise<void> {
		const [spreadsheetId, range] = params;

		if (!spreadsheetId || !range) {
			console.error("Error: Spreadsheet ID and range are required");
			console.error("Usage: google sheets read <spreadsheetId> <range>");
			console.error('Example: google sheets read 1ABC...XYZ "Sheet1!A1:C10"');
			process.exit(1);
		}

		try {
			const data = await this.sheets.readRange(spreadsheetId, range);

			if (data.values.length === 0) {
				console.log("No data found in range.");
				return;
			}

			const format = options.format ?? "table";

			switch (format) {
				case "json":
					console.log(JSON.stringify(data.values, null, 2));
					break;
				case "csv":
					for (const row of data.values) {
						console.log(row.map((cell) => `"${cell}"`).join(","));
					}
					break;
				case "table":
				default:
					this.printTable(data.values);
					break;
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			}
			process.exit(1);
		}
	}

	private printTable(values: string[][]): void {
		if (values.length === 0) return;

		// Calculate column widths
		const colWidths: number[] = [];
		for (const row of values) {
			for (let i = 0; i < row.length; i++) {
				const cellWidth = String(row[i] ?? "").length;
				colWidths[i] = Math.max(colWidths[i] ?? 0, cellWidth);
			}
		}

		// Print rows
		console.log("");
		for (const row of values) {
			const cells = row.map((cell, i) =>
				String(cell ?? "").padEnd(colWidths[i] ?? 0)
			);
			console.log(`  ${cells.join("  |  ")}`);
		}
		console.log("");
	}

	@Option({
		flags: "-f, --format <format>",
		description: "Output format: table, json, or csv",
	})
	parseFormat(val: string): string {
		if (!["table", "json", "csv"].includes(val)) {
			throw new Error("Format must be one of: table, json, csv");
		}
		return val;
	}
}

@Injectable()
@Command({
	name: "sheets",
	description: "Google Sheets operations",
	subCommands: [SheetsGetCommand, SheetsReadCommand],
})
export class SheetsCommand extends CommandRunner {
	async run(): Promise<void> {
		console.log("Use 'google sheets --help' for available subcommands");
	}
}

export { SheetsGetCommand, SheetsReadCommand };
