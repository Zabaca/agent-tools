import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GeminiModule } from "./gemini/gemini.module.js";
import { GenerateCommand, EditCommand } from "./commands/index.js";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env", "../../.env"],
		}),
		GeminiModule,
	],
	providers: [GenerateCommand, EditCommand],
})
export class AppModule {}
