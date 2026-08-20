import { Command, CommandRunner, Option } from "nest-commander";
import { Injectable } from "@nestjs/common";
import { GeminiService } from "../gemini/gemini.service.js";
import { writeImage } from "./write-image.js";
import * as fs from "node:fs";

interface EditOptions {
	output: string;
	model?: string;
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

		const model = options.model || this.gemini.model;

		try {
			console.log(`Editing image: ${imagePath}`);
			console.log(`Prompt: "${prompt}"`);
			console.log(`Model: ${model}`);
			const image = await this.gemini.editImage(imagePath, prompt, model);

			const outputPath = writeImage(image, options.output);

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

	@Option({
		flags: "-m, --model <model>",
		description: "Model to use (defaults to $GEMINI_IMAGE_MODEL)",
	})
	parseModel(val: string): string {
		return val;
	}
}
