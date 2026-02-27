import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { TwitterModule } from "./twitter/twitter.module.js";
import { LoginCommand, TweetCommand } from "./commands/index.js";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env", "../../.env"],
		}),
		AuthModule,
		TwitterModule,
	],
	providers: [TweetCommand, LoginCommand],
})
export class AppModule {}
