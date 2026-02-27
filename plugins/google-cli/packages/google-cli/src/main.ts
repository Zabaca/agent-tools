#!/usr/bin/env node
import "reflect-metadata";
import { CommandFactory } from "nest-commander";
import { AppModule } from "./app.module.js";

async function bootstrap() {
	await CommandFactory.run(AppModule, ["warn", "error"]);
}

bootstrap().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
