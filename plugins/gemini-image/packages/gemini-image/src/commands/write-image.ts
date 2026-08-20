import * as fs from "node:fs";
import * as path from "node:path";
import type { GeneratedImage } from "../gemini/gemini.service.js";

const EXTENSIONS: Record<string, string> = {
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/webp": ".webp",
	"image/gif": ".gif",
};

/**
 * Write an image to the requested path, creating parent directories.
 *
 * The path is honoured exactly as given so callers and scripts can rely on it,
 * but models don't all return the same format — Nano Banana 2 Lite returns
 * JPEG where 2.5 Flash returned PNG — so warn when the extension disagrees
 * with the actual bytes.
 */
export function writeImage(image: GeneratedImage, output: string): string {
	const outputPath = path.resolve(output);
	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	fs.writeFileSync(outputPath, image.data);

	const expected = EXTENSIONS[image.mimeType];
	const actual = path.extname(outputPath).toLowerCase();
	const normalized = actual === ".jpeg" ? ".jpg" : actual;
	if (expected && normalized !== expected) {
		console.warn(
			`Warning: model returned ${image.mimeType} but output path ends in "${actual}". ` +
				`File contents are ${image.mimeType}; use "${expected}" to match.`,
		);
	}

	return outputPath;
}
