import { Command, CommandRunner, Option } from "nest-commander";
import { Injectable } from "@nestjs/common";
import { GeminiService } from "../gemini/gemini.service.js";
import * as fs from "node:fs";
import * as path from "node:path";

interface GenerateOptions {
	output: string;
}

@Injectable()
@Command({
	name: "generate",
	arguments: "<prompt>",
	description: "Generate an image from a text prompt",
})
export class GenerateCommand extends CommandRunner {
	constructor(private readonly gemini: GeminiService) {
		super();
	}

	async run(passedParams: string[], options: GenerateOptions): Promise<void> {
		const prompt = passedParams.join(" ");

		if (!prompt) {
			console.error("Error: Prompt is required");
			process.exit(1);
		}

		if (!options.output) {
			console.error("Error: Output path is required (-o, --output)");
			process.exit(1);
		}

		try {
			console.log(`Generating image for: "${prompt}"`);
			const imageBuffer = await this.gemini.generateImage(prompt);

			// Ensure directory exists
			const outputPath = path.resolve(options.output);
			const outputDir = path.dirname(outputPath);
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			// Write image to file
			fs.writeFileSync(outputPath, imageBuffer);

			console.log(`Image saved to: ${outputPath}`);
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
