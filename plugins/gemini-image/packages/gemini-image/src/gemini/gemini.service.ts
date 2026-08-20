import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "node:path";

/** Default model: Nano Banana 2 Lite — cheapest per image and newer than 2.5. */
export const DEFAULT_MODEL = "gemini-3.1-flash-lite-image";

export interface GeneratedImage {
	data: Buffer;
	mimeType: string;
}

@Injectable()
export class GeminiService {
	private readonly logger = new Logger(GeminiService.name);
	private readonly client: GoogleGenerativeAI;
	private readonly defaultModel: string;

	constructor(private readonly config: ConfigService) {
		const apiKey = this.config.get<string>("GEMINI_API_KEY");
		if (!apiKey) {
			throw new Error("GEMINI_API_KEY not found in environment");
		}
		this.client = new GoogleGenerativeAI(apiKey);
		this.defaultModel =
			this.config.get<string>("GEMINI_IMAGE_MODEL") || DEFAULT_MODEL;
	}

	/** Model used when a command doesn't override it. */
	get model(): string {
		return this.defaultModel;
	}

	/**
	 * Generate an image from a text prompt
	 */
	async generateImage(
		prompt: string,
		modelName = this.defaultModel,
	): Promise<GeneratedImage> {
		this.logger.debug(`Generating image with ${modelName}: ${prompt}`);

		const model = this.client.getGenerativeModel({ model: modelName });

		const response = await model.generateContent({
			contents: [
				{
					role: "user",
					parts: [{ text: prompt }],
				},
			],
			generationConfig: {
				responseModalities: ["image", "text"],
			},
		} as any);

		return this.extractImage(response.response, "No image generated");
	}

	/**
	 * Edit an existing image with a text prompt
	 */
	async editImage(
		imagePath: string,
		prompt: string,
		modelName = this.defaultModel,
	): Promise<GeneratedImage> {
		this.logger.debug(`Editing ${imagePath} with ${modelName}: ${prompt}`);

		// Read the input image
		const absolutePath = path.resolve(imagePath);
		if (!fs.existsSync(absolutePath)) {
			throw new Error(`Image file not found: ${absolutePath}`);
		}

		const imageData = fs.readFileSync(absolutePath);
		const base64Image = imageData.toString("base64");

		// Determine MIME type from extension
		const ext = path.extname(imagePath).toLowerCase();
		const mimeTypes: Record<string, string> = {
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".webp": "image/webp",
		};
		const mimeType = mimeTypes[ext] || "image/png";

		const model = this.client.getGenerativeModel({ model: modelName });

		const response = await model.generateContent({
			contents: [
				{
					role: "user",
					parts: [
						{
							inlineData: {
								mimeType,
								data: base64Image,
							},
						},
						{ text: prompt },
					],
				},
			],
			generationConfig: {
				responseModalities: ["image", "text"],
			},
		} as any);

		return this.extractImage(response.response, "No edited image generated");
	}

	/**
	 * Pull the first image part out of a response. Different models return
	 * different formats — 2.5 Flash returns PNG, the 3.x models return JPEG —
	 * so the caller gets the mime type alongside the bytes.
	 */
	private extractImage(
		result: { candidates?: any[] },
		emptyMessage: string,
	): GeneratedImage {
		const candidates = result.candidates;

		if (!candidates || candidates.length === 0) {
			throw new Error(emptyMessage);
		}

		for (const candidate of candidates) {
			if (candidate.content?.parts) {
				for (const part of candidate.content.parts) {
					if (
						part.inlineData?.mimeType?.startsWith("image/") &&
						part.inlineData?.data
					) {
						this.logger.debug("Image received successfully");
						return {
							data: Buffer.from(part.inlineData.data, "base64"),
							mimeType: part.inlineData.mimeType,
						};
					}
				}
			}
		}

		throw new Error("No image data found in response");
	}
}
