import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { TwitterService } from "./twitter.service.js";

@Module({
	imports: [AuthModule],
	providers: [TwitterService],
	exports: [TwitterService],
})
export class TwitterModule {}
