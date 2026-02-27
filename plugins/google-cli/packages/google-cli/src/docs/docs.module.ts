import { Module } from "@nestjs/common";
import { DocsService } from "./docs.service.js";

@Module({
	providers: [DocsService],
	exports: [DocsService],
})
export class DocsModule {}
