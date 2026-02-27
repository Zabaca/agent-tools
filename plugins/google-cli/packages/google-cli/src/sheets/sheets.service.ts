import { Injectable, Logger } from "@nestjs/common";
import { google, sheets_v4 } from "googleapis";
import { AuthService } from "../auth/auth.service.js";

export interface SpreadsheetInfo {
	spreadsheetId: string;
	title: string;
	sheets: string[];
	url: string;
}

export interface SheetData {
	range: string;
	values: string[][];
}

@Injectable()
export class SheetsService {
	private readonly logger = new Logger(SheetsService.name);

	constructor(private readonly auth: AuthService) {}

	/**
	 * Get authenticated Sheets client
	 */
	private async getSheetsClient(): Promise<sheets_v4.Sheets> {
		const authClient = await this.auth.getAuthenticatedClient();
		return google.sheets({ version: "v4", auth: authClient });
	}

	/**
	 * Get spreadsheet metadata
	 */
	async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetInfo> {
		const sheets = await this.getSheetsClient();

		const response = await sheets.spreadsheets.get({
			spreadsheetId,
		});

		const spreadsheet = response.data;

		return {
			spreadsheetId: spreadsheet.spreadsheetId ?? "",
			title: spreadsheet.properties?.title ?? "",
			sheets: (spreadsheet.sheets ?? []).map(
				(sheet) => sheet.properties?.title ?? ""
			),
			url: spreadsheet.spreadsheetUrl ?? "",
		};
	}

	/**
	 * Read data from a range
	 */
	async readRange(spreadsheetId: string, range: string): Promise<SheetData> {
		const sheets = await this.getSheetsClient();

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId,
			range,
		});

		return {
			range: response.data.range ?? range,
			values: (response.data.values ?? []) as string[][],
		};
	}

	/**
	 * Write data to a range
	 */
	async writeRange(
		spreadsheetId: string,
		range: string,
		values: string[][]
	): Promise<number> {
		const sheets = await this.getSheetsClient();

		const response = await sheets.spreadsheets.values.update({
			spreadsheetId,
			range,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values,
			},
		});

		return response.data.updatedCells ?? 0;
	}

	/**
	 * Append data to a sheet
	 */
	async appendRows(
		spreadsheetId: string,
		range: string,
		values: string[][]
	): Promise<number> {
		const sheets = await this.getSheetsClient();

		const response = await sheets.spreadsheets.values.append({
			spreadsheetId,
			range,
			valueInputOption: "USER_ENTERED",
			requestBody: {
				values,
			},
		});

		return response.data.updates?.updatedRows ?? 0;
	}
}
