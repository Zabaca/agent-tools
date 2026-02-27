import { Injectable, Logger } from "@nestjs/common";
import type { TweetV2PostTweetResult } from "twitter-api-v2";
import { AuthService } from "../auth/auth.service.js";
import * as fs from "node:fs";
import * as path from "node:path";

@Injectable()
export class TwitterService {
	private readonly logger = new Logger(TwitterService.name);

	constructor(private readonly auth: AuthService) {}

	/**
	 * Upload media (image/video) and return media ID
	 * Uses v2 endpoint which supports OAuth 2.0 User Context
	 */
	async uploadMedia(filePath: string): Promise<string> {
		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const ext = path.extname(filePath).toLowerCase();
		const mimeTypes: Record<string, string> = {
			".png": "image/png",
			".jpg": "image/jpeg",
			".jpeg": "image/jpeg",
			".gif": "image/gif",
			".webp": "image/webp",
			".mp4": "video/mp4",
		};

		const mimeType = mimeTypes[ext];
		if (!mimeType) {
			throw new Error(`Unsupported format: ${ext}. Supported: ${Object.keys(mimeTypes).join(", ")}`);
		}

		const client = await this.auth.getClient();
		const buffer = fs.readFileSync(filePath);

		this.logger.debug(`Uploading media: ${filePath} (${mimeType})`);
		try {
			// Use v2 endpoint which supports OAuth 2.0 with media.write scope
			const mediaId = await client.v2.uploadMedia(buffer, {
				media_type: mimeType,
			});
			this.logger.debug(`Media uploaded: ${mediaId}`);
			return mediaId;
		} catch (error: unknown) {
			// Log full error details for debugging
			console.error("Media upload error details:", JSON.stringify(error, null, 2));
			throw error;
		}
	}

	/**
	 * Post a tweet with optional media and reply-to
	 */
	async tweet(text: string, mediaIds?: string[], replyToId?: string): Promise<TweetV2PostTweetResult> {
		if (text.length > 280) {
			throw new Error(`Tweet too long: ${text.length} characters (max 280)`);
		}

		const client = await this.auth.getClient();

		const tweetOptions: {
			text: string;
			media?: { media_ids: string[] };
			reply?: { in_reply_to_tweet_id: string };
		} = { text };

		if (mediaIds && mediaIds.length > 0) {
			tweetOptions.media = { media_ids: mediaIds };
		}

		if (replyToId) {
			tweetOptions.reply = { in_reply_to_tweet_id: replyToId };
		}

		const result = await client.v2.tweet(tweetOptions);

		this.logger.debug(`Tweet posted: ${result.data.id}`);
		return result;
	}

	/**
	 * Delete a tweet by ID
	 */
	async deleteTweet(id: string): Promise<void> {
		const client = await this.auth.getClient();
		await client.v2.deleteTweet(id);
		this.logger.debug(`Tweet deleted: ${id}`);
	}

	/**
	 * Get authenticated user info
	 */
	async getMe(): Promise<{ id: string; name: string; username: string }> {
		const client = await this.auth.getClient();
		const { data } = await client.v2.me();
		return {
			id: data.id,
			name: data.name,
			username: data.username,
		};
	}
}
