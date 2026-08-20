import { Command, CommandRunner, Option } from "nest-commander";
import { Injectable } from "@nestjs/common";
import { GeminiService } from "../gemini/gemini.service.js";
import { writeImage } from "./write-image.js";

interface GenerateOptions {
	output: string;
	model?: string;
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

		const model = options.model || this.gemini.model;

		try {
			console.log(`Generating image for: "${prompt}"`);
			console.log(`Model: ${model}`);
			const image = await this.gemini.generateImage(prompt, model);

			const outputPath = writeImage(image, options.output);

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

	@Option({
		flags: "-m, --model <model>",
		description: "Model to use (defaults to $GEMINI_IMAGE_MODEL)",
	})
	parseModel(val: string): string {
		return val;
	}
}
