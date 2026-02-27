import { Injectable, Logger } from "@nestjs/common";
import { google, drive_v3 } from "googleapis";
import { AuthService } from "../auth/auth.service.js";

export interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
	modifiedTime?: string;
	size?: string;
	parents?: string[];
}

@Injectable()
export class DriveService {
	private readonly logger = new Logger(DriveService.name);

	constructor(private readonly auth: AuthService) {}

	/**
	 * Get authenticated Drive client
	 */
	private async getDriveClient(): Promise<drive_v3.Drive> {
		const authClient = await this.auth.getAuthenticatedClient();
		return google.drive({ version: "v3", auth: authClient });
	}

	/**
	 * List files in Drive
	 */
	async listFiles(options?: {
		query?: string;
		pageSize?: number;
		folderId?: string;
	}): Promise<DriveFile[]> {
		const drive = await this.getDriveClient();

		let q = options?.query ?? "";
		if (options?.folderId) {
			q = q ? `${q} and '${options.folderId}' in parents` : `'${options.folderId}' in parents`;
		}

		const response = await drive.files.list({
			pageSize: options?.pageSize ?? 20,
			fields: "files(id, name, mimeType, modifiedTime, size, parents)",
			q: q || undefined,
			orderBy: "modifiedTime desc",
		});

		return (response.data.files ?? []).map((file) => ({
			id: file.id ?? "",
			name: file.name ?? "",
			mimeType: file.mimeType ?? "",
			modifiedTime: file.modifiedTime ?? undefined,
			size: file.size ?? undefined,
			parents: file.parents ?? undefined,
		}));
	}

	/**
	 * Get file metadata
	 */
	async getFile(fileId: string): Promise<DriveFile> {
		const drive = await this.getDriveClient();

		const response = await drive.files.get({
			fileId,
			fields: "id, name, mimeType, modifiedTime, size, parents",
		});

		return {
			id: response.data.id ?? "",
			name: response.data.name ?? "",
			mimeType: response.data.mimeType ?? "",
			modifiedTime: response.data.modifiedTime ?? undefined,
			size: response.data.size ?? undefined,
			parents: response.data.parents ?? undefined,
		};
	}

	/**
	 * Download file content
	 */
	async downloadFile(fileId: string): Promise<Buffer> {
		const drive = await this.getDriveClient();

		const response = await drive.files.get(
			{ fileId, alt: "media" },
			{ responseType: "arraybuffer" }
		);

		return Buffer.from(response.data as ArrayBuffer);
	}

	/**
	 * Export Google Workspace file (Docs, Sheets, etc.) to a specific format
	 */
	async exportFile(
		fileId: string,
		mimeType: string
	): Promise<string> {
		const drive = await this.getDriveClient();

		const response = await drive.files.export({
			fileId,
			mimeType,
		});

		return response.data as string;
	}
}
