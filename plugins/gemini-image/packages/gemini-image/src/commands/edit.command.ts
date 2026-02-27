import { Command, CommandRunner, Option } from "nest-commander";
import { Injectable } from "@nestjs/common";
import { GeminiService } from "../gemini/gemini.service.js";
import * as fs from "node:fs";
import * as path from "node:path";

interface EditOptions {
	output: string;
}

@Injectable()
@Command({
	name: "edit",
	arguments: "<image-path> <prompt...>",
	description: "Edit an image with a text prompt",
})
export class EditCommand extends CommandRunner {
	constructor(private readonly gemini: GeminiService) {
		super();
	}

	async run(passedParams: string[], options: EditOptions): Promise<void> {
		if (passedParams.length < 2) {
			console.error("Error: Image path and prompt are required");
			console.error("Usage: gemini edit <image-path> <prompt> -o <output>");
			process.exit(1);
		}

		const imagePath = passedParams[0];
		const prompt = passedParams.slice(1).join(" ");

		if (!options.output) {
			console.error("Error: Output path is required (-o, --output)");
			process.exit(1);
		}

		// Check if input image exists
		if (!fs.existsSync(imagePath)) {
			console.error(`Error: Input image not found: ${imagePath}`);
			process.exit(1);
		}

		try {
			console.log(`Editing image: ${imagePath}`);
			console.log(`Prompt: "${prompt}"`);
			const imageBuffer = await this.gemini.editImage(imagePath, prompt);

			// Ensure directory exists
			const outputPath = path.resolve(options.output);
			const outputDir = path.dirname(outputPath);
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			// Write image to file
			fs.writeFileSync(outputPath, imageBuffer);

			console.log(`Edited image saved to: ${outputPath}`);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			} else {
				console.error("An unexpected error occurred");
			}
			process.exit(1);
		}
	}

	@Option({
		flags: "-o, --output <path>",
		description: "Output file path (required)",
		required: true,
	})
	parseOutput(val: string): string {
		return val;
	}
}
