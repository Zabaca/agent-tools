import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class GeminiService {
	private readonly logger = new Logger(GeminiService.name);
	private readonly client: GoogleGenerativeAI;
	private readonly modelName = "gemini-2.5-flash-image";

	constructor(private readonly config: ConfigService) {
		const apiKey = this.config.get<string>("GEMINI_API_KEY");
		if (!apiKey) {
			throw new Error("GEMINI_API_KEY not found in environment");
		}
		this.client = new GoogleGenerativeAI(apiKey);
	}

	/**
	 * Generate an image from a text prompt
	 */
	async generateImage(prompt: string): Promise<Buffer> {
		this.logger.debug(`Generating image with prompt: ${prompt}`);

		const model = this.client.getGenerativeModel({
			model: this.modelName,
		});

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

		const result = response.response;
		const candidates = result.candidates;

		if (!candidates || candidates.length === 0) {
			throw new Error("No image generated");
		}

		// Find the image part in the response
		for (const candidate of candidates) {
			if (candidate.content?.parts) {
				for (const part of candidate.content.parts) {
					if (
						part.inlineData?.mimeType?.startsWith("image/") &&
						part.inlineData?.data
					) {
						this.logger.debug("Image generated successfully");
						return Buffer.from(part.inlineData.data, "base64");
					}
				}
			}
		}

		throw new Error("No image data found in response");
	}

	/**
	 * Edit an existing image with a text prompt
	 */
	async editImage(imagePath: string, prompt: string): Promise<Buffer> {
		this.logger.debug(`Editing image ${imagePath} with prompt: ${prompt}`);

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

		const model = this.client.getGenerativeModel({
			model: this.modelName,
		});

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

		const result = response.response;
		const candidates = result.candidates;

		if (!candidates || candidates.length === 0) {
			throw new Error("No edited image generated");
		}

		// Find the image part in the response
		for (const candidate of candidates) {
			if (candidate.content?.parts) {
				for (const part of candidate.content.parts) {
					if (
						part.inlineData?.mimeType?.startsWith("image/") &&
						part.inlineData?.data
					) {
						this.logger.debug("Image edited successfully");
						return Buffer.from(part.inlineData.data, "base64");
					}
				}
			}
		}

		throw new Error("No image data found in response");
	}
}
