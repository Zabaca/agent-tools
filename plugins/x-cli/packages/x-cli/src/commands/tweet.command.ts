import { Command, CommandRunner, Option } from "nest-commander";
import { Injectable } from "@nestjs/common";
import { TwitterService } from "../twitter/twitter.service.js";

interface TweetCommandOptions {
	image?: string;
	replyTo?: string;
}

@Injectable()
@Command({
	name: "tweet",
	arguments: "<message>",
	description: "Post a tweet to X/Twitter",
})
export class TweetCommand extends CommandRunner {
	constructor(private readonly twitter: TwitterService) {
		super();
	}

	@Option({
		flags: "-i, --image <path>",
		description: "Path to image file to attach (png, jpg, gif, webp, mp4)",
	})
	parseImage(val: string): string {
		return val;
	}

	@Option({
		flags: "-r, --reply-to <tweet_id>",
		description: "Tweet ID to reply to (for thread replies)",
	})
	parseReplyTo(val: string): string {
		return val;
	}

	async run(passedParams: string[], options?: TweetCommandOptions): Promise<void> {
		const message = passedParams.join(" ");

		if (!message) {
			console.error("Error: Message is required");
			process.exit(1);
		}

		if (message.length > 280) {
			console.error(`Error: Tweet too long (${message.length}/280 characters)`);
			process.exit(1);
		}

		try {
			let mediaIds: string[] | undefined;

			// Upload image if provided
			if (options?.image) {
				console.log(`Uploading image: ${options.image}`);
				const mediaId = await this.twitter.uploadMedia(options.image);
				mediaIds = [mediaId];
				console.log("Image uploaded successfully!");
			}

			// Log if replying to a tweet
			if (options?.replyTo) {
				console.log(`Replying to tweet: ${options.replyTo}`);
			}

			const result = await this.twitter.tweet(message, mediaIds, options?.replyTo);
			console.log(`Tweet posted successfully!`);
			console.log(`ID: ${result.data.id}`);
			console.log(`URL: https://twitter.com/i/web/status/${result.data.id}`);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			} else {
				console.error("An unexpected error occurred");
			}
			process.exit(1);
		}
	}
}
