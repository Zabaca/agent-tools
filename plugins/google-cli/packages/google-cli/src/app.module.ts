import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { DriveModule } from "./drive/drive.module.js";
import { DocsModule } from "./docs/docs.module.js";
import { SheetsModule } from "./sheets/sheets.module.js";
import { LoginCommand } from "./commands/login.command.js";
import { DriveCommand, DriveListCommand, DriveGetCommand } from "./commands/drive.command.js";
import { DocsCommand, DocsGetCommand, DocsCreateCommand, DocsWriteCommand } from "./commands/docs.command.js";
import { SheetsCommand, SheetsGetCommand, SheetsReadCommand } from "./commands/sheets.command.js";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env", "../../.env"],
		}),
		AuthModule,
		DriveModule,
		DocsModule,
		SheetsModule,
	],
	providers: [
		LoginCommand,
		DriveCommand,
		DriveListCommand,
		DriveGetCommand,
		DocsCommand,
		DocsGetCommand,
		DocsCreateCommand,
		DocsWriteCommand,
		SheetsCommand,
		SheetsGetCommand,
		SheetsReadCommand,
	],
})
export class AppModule {}
