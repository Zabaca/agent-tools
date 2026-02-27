import { Injectable, Logger } from "@nestjs/common";
import { google, docs_v1 } from "googleapis";
import { AuthService } from "../auth/auth.service.js";

interface MarkdownSegment {
	text: string;
	bold?: boolean;
	italic?: boolean;
	code?: boolean;
	link?: string;
}

interface MarkdownLine {
	type: "heading" | "paragraph" | "code" | "list" | "table" | "hr" | "empty";
	level?: number; // For headings (1-6) or list indent
	segments?: MarkdownSegment[];
	raw?: string;
	ordered?: boolean;
	tableRows?: string[][];
}

export interface DocumentContent {
	documentId: string;
	title: string;
	body: string;
	revisionId?: string;
}

@Injectable()
export class DocsService {
	private readonly logger = new Logger(DocsService.name);

	constructor(private readonly auth: AuthService) {}

	/**
	 * Get authenticated Docs client
	 */
	private async getDocsClient(): Promise<docs_v1.Docs> {
		const authClient = await this.auth.getAuthenticatedClient();
		return google.docs({ version: "v1", auth: authClient });
	}

	/**
	 * Get document metadata and content
	 * @param tab - Optional tab name or 0-based index to fetch a specific tab
	 */
	async getDocument(documentId: string, tab?: string): Promise<DocumentContent> {
		const docs = await this.getDocsClient();

		const response = await docs.documents.get({
			documentId,
			includeTabsContent: true,
		});

		const doc = response.data;
		const tabs = doc.tabs ?? [];

		if (tabs.length === 0) {
			// Fallback to legacy body if no tabs
			const body = this.extractTextContent(doc.body);
			return {
				documentId: doc.documentId ?? "",
				title: doc.title ?? "",
				body,
				revisionId: doc.revisionId ?? undefined,
			};
		}

		// If no tab specified, return the first tab
		if (tab === undefined) {
			const firstTab = tabs[0];
			const body = this.extractTextContent(firstTab.documentTab?.body);
			return {
				documentId: doc.documentId ?? "",
				title: `${doc.title ?? ""} [${firstTab.tabProperties?.title ?? "Tab 1"}]`,
				body,
				revisionId: doc.revisionId ?? undefined,
			};
		}

		// Try to match by index first
		const tabIndex = parseInt(tab, 10);
		if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex < tabs.length) {
			const selectedTab = tabs[tabIndex];
			const body = this.extractTextContent(selectedTab.documentTab?.body);
			return {
				documentId: doc.documentId ?? "",
				title: `${doc.title ?? ""} [${selectedTab.tabProperties?.title ?? `Tab ${tabIndex + 1}`}]`,
				body,
				revisionId: doc.revisionId ?? undefined,
			};
		}

		// Try to match by tab name (case-insensitive partial match)
		const matchedTab = tabs.find(t =>
			t.tabProperties?.title?.toLowerCase().includes(tab.toLowerCase())
		);

		if (matchedTab) {
			const body = this.extractTextContent(matchedTab.documentTab?.body);
			return {
				documentId: doc.documentId ?? "",
				title: `${doc.title ?? ""} [${matchedTab.tabProperties?.title ?? ""}]`,
				body,
				revisionId: doc.revisionId ?? undefined,
			};
		}

		// Tab not found — list available tabs
		const tabNames = tabs.map((t, i) => `  ${i}: ${t.tabProperties?.title ?? "(untitled)"}`).join("\n");
		throw new Error(`Tab "${tab}" not found. Available tabs:\n${tabNames}`);
	}

	/**
	 * List all tabs in a document
	 */
	async listTabs(documentId: string): Promise<{ index: number; title: string }[]> {
		const docs = await this.getDocsClient();

		const response = await docs.documents.get({
			documentId,
			includeTabsContent: true,
		});

		const tabs = response.data.tabs ?? [];
		return tabs.map((t, i) => ({
			index: i,
			title: t.tabProperties?.title ?? "(untitled)",
		}));
	}

	/**
	 * Extract plain text content from document body
	 */
	private extractTextContent(body?: docs_v1.Schema$Body): string {
		if (!body?.content) return "";

		let text = "";

		for (const element of body.content) {
			if (element.paragraph?.elements) {
				for (const paragraphElement of element.paragraph.elements) {
					if (paragraphElement.textRun?.content) {
						text += paragraphElement.textRun.content;
					}
				}
			}
			if (element.table?.tableRows) {
				for (const row of element.table.tableRows) {
					if (row.tableCells) {
						for (const cell of row.tableCells) {
							text += this.extractTextContent({ content: cell.content });
							text += "\t";
						}
						text += "\n";
					}
				}
			}
		}

		return text;
	}

	/**
	 * Create a new document
	 */
	async createDocument(title: string): Promise<string> {
		const docs = await this.getDocsClient();

		const response = await docs.documents.create({
			requestBody: {
				title,
			},
		});

		return response.data.documentId ?? "";
	}

	/**
	 * Write/append text content to a document
	 * Replaces all existing content with new content
	 */
	async writeDocument(documentId: string, content: string): Promise<void> {
		const docs = await this.getDocsClient();

		// First, get the document to find the end index
		const doc = await docs.documents.get({ documentId });
		const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex ?? 1;

		const requests: docs_v1.Schema$Request[] = [];

		// If there's existing content (more than just the initial newline), delete it
		if (endIndex > 2) {
			requests.push({
				deleteContentRange: {
					range: {
						startIndex: 1,
						endIndex: endIndex - 1,
					},
				},
			});
		}

		// Insert the new content at the beginning
		requests.push({
			insertText: {
				location: {
					index: 1,
				},
				text: content,
			},
		});

		await docs.documents.batchUpdate({
			documentId,
			requestBody: {
				requests,
			},
		});
	}

	/**
	 * Append text content to end of document
	 */
	async appendDocument(documentId: string, content: string): Promise<void> {
		const docs = await this.getDocsClient();

		// Get the document to find the end index
		const doc = await docs.documents.get({ documentId });
		const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex ?? 1;

		await docs.documents.batchUpdate({
			documentId,
			requestBody: {
				requests: [
					{
						insertText: {
							location: {
								index: endIndex - 1,
							},
							text: content,
						},
					},
				],
			},
		});
	}

	/**
	 * Write markdown content to a document with formatting
	 */
	async writeMarkdown(documentId: string, markdown: string): Promise<void> {
		const docs = await this.getDocsClient();

		// First, get the document to find the end index and clear it
		const doc = await docs.documents.get({ documentId });
		const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex ?? 1;

		const requests: docs_v1.Schema$Request[] = [];

		// Clear existing content if any
		if (endIndex > 2) {
			requests.push({
				deleteContentRange: {
					range: {
						startIndex: 1,
						endIndex: endIndex - 1,
					},
				},
			});
		}

		// Parse markdown and generate requests
		const { text, formatRequests } = this.parseMarkdown(markdown);

		// Insert the plain text first
		requests.push({
			insertText: {
				location: { index: 1 },
				text,
			},
		});

		// Apply formatting (in reverse order since we're working from end to start)
		requests.push(...formatRequests.reverse());

		await docs.documents.batchUpdate({
			documentId,
			requestBody: { requests },
		});
	}

	/**
	 * Parse markdown and return text + formatting requests
	 */
	private parseMarkdown(markdown: string): {
		text: string;
		formatRequests: docs_v1.Schema$Request[];
	} {
		// Strip YAML frontmatter
		const content = markdown.replace(/^---[\s\S]*?---\n*/m, "");

		const lines = content.split("\n");
		let plainText = "";
		const formatRequests: docs_v1.Schema$Request[] = [];
		let inCodeBlock = false;
		let codeBlockStart = 0;
		let inTable = false;
		let tableLines: string[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const startIndex = plainText.length + 1; // +1 for 1-based indexing

			// Code block handling
			if (line.startsWith("```")) {
				if (!inCodeBlock) {
					inCodeBlock = true;
					codeBlockStart = startIndex;
					continue;
				} else {
					inCodeBlock = false;
					// Apply monospace formatting to code block
					const endIndex = plainText.length + 1;
					if (endIndex > codeBlockStart) {
						formatRequests.push({
							updateTextStyle: {
								range: { startIndex: codeBlockStart, endIndex },
								textStyle: {
									weightedFontFamily: {
										fontFamily: "Roboto Mono",
									},
									fontSize: { magnitude: 9, unit: "PT" },
								},
								fields: "weightedFontFamily,fontSize",
							},
						});
					}
					plainText += "\n";
					continue;
				}
			}

			if (inCodeBlock) {
				plainText += line + "\n";
				continue;
			}

			// Table handling
			if (line.startsWith("|") && line.endsWith("|")) {
				if (!inTable) {
					inTable = true;
					tableLines = [];
				}
				// Skip separator lines like |---|---|
				if (!line.match(/^\|[\s-:|]+\|$/)) {
					tableLines.push(line);
				}
				continue;
			} else if (inTable) {
				// End of table - convert to formatted text with inline formatting
				inTable = false;
				for (const tableLine of tableLines) {
					const cells = tableLine.split("|").filter((c) => c.trim());
					const processedCells: string[] = [];
					for (const cell of cells) {
						const cellStart = plainText.length + 1;
						const processed = this.processInlineFormatting(cell.trim(), cellStart, formatRequests);
						processedCells.push(processed);
						plainText += processed + "\t";
					}
					// Remove last tab and add newline
					plainText = plainText.slice(0, -1) + "\n";
				}
				tableLines = [];
			}

			// Headings
			const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
			if (headingMatch) {
				const level = headingMatch[1].length;
				const text = headingMatch[2];

				// Process inline formatting in heading text
				const processedText = this.processInlineFormatting(text, startIndex, formatRequests);
				const endIndex = startIndex + processedText.length;

				plainText += processedText + "\n";

				// Apply heading style
				const headingType =
					level === 1
						? "HEADING_1"
						: level === 2
							? "HEADING_2"
							: level === 3
								? "HEADING_3"
								: level === 4
									? "HEADING_4"
									: level === 5
										? "HEADING_5"
										: "HEADING_6";

				formatRequests.push({
					updateParagraphStyle: {
						range: { startIndex, endIndex: endIndex + 1 },
						paragraphStyle: {
							namedStyleType: headingType,
						},
						fields: "namedStyleType",
					},
				});
				continue;
			}

			// Horizontal rule
			if (line.match(/^[-*_]{3,}$/)) {
				plainText += "─".repeat(50) + "\n";
				continue;
			}

			// Checkboxes - MUST be before list items to match first
			const checkMatch = line.match(/^(\s*)- \[([ xX])\]\s*(.+)$/);
			if (checkMatch) {
				const indent = Math.floor(checkMatch[1].length / 2);
				const checked = checkMatch[2].toLowerCase() === "x";
				const text = checkMatch[3];
				const prefix = "  ".repeat(indent) + (checked ? "☑ " : "☐ ");
				plainText += prefix;
				const textStart = plainText.length + 1;
				const processedText = this.processInlineFormatting(text, textStart, formatRequests);
				plainText += processedText + "\n";
				continue;
			}

			// List items
			const listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
			if (listMatch) {
				const indent = Math.floor(listMatch[1].length / 2);
				const text = listMatch[2];
				const prefix = "  ".repeat(indent) + "• ";
				plainText += prefix;
				const textStart = plainText.length + 1;
				const processedText = this.processInlineFormatting(text, textStart, formatRequests);
				plainText += processedText + "\n";
				continue;
			}

			// Ordered list
			const orderedMatch = line.match(/^(\s*)(\d+\.)\s+(.+)$/);
			if (orderedMatch) {
				const prefix = orderedMatch[1] + orderedMatch[2] + " ";
				const text = orderedMatch[3];
				plainText += prefix;
				const textStart = plainText.length + 1;
				const processedText = this.processInlineFormatting(text, textStart, formatRequests);
				plainText += processedText + "\n";
				continue;
			}

			// Regular paragraph - handle inline formatting
			// Process in order: collect positions, then strip markers

			const lineStart = plainText.length + 1;
			let processedLine = line;
			let offset = 0; // Track how much we've removed from the line

			// Inline code - process first to get correct positions
			const codeMatches = [...line.matchAll(/`([^`]+)`/g)];
			for (const match of codeMatches) {
				const codeText = match[1];
				const matchStart = match.index! - offset;
				const codeStart = lineStart + matchStart;
				const codeEnd = codeStart + codeText.length;

				formatRequests.push({
					updateTextStyle: {
						range: { startIndex: codeStart, endIndex: codeEnd },
						textStyle: {
							weightedFontFamily: { fontFamily: "Roboto Mono" },
							fontSize: { magnitude: 10, unit: "PT" },
							backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
						},
						fields: "weightedFontFamily,fontSize,backgroundColor",
					},
				});
				offset += 2; // Remove 2 backticks
			}
			processedLine = processedLine.replace(/`([^`]+)`/g, "$1");

			// Bold - recalculate offset after code removal
			const boldMatches = [...processedLine.matchAll(/\*\*(.+?)\*\*/g)];
			let boldOffset = 0;
			for (const match of boldMatches) {
				const boldText = match[1];
				const matchStart = match.index! - boldOffset;
				const boldStart = lineStart + matchStart;
				const boldEnd = boldStart + boldText.length;

				formatRequests.push({
					updateTextStyle: {
						range: { startIndex: boldStart, endIndex: boldEnd },
						textStyle: { bold: true },
						fields: "bold",
					},
				});
				boldOffset += 4; // Remove 4 asterisks
			}
			processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, "$1");

			// Links - convert [text](url) to just text
			processedLine = processedLine.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

			plainText += processedLine + "\n";
		}

		// Handle any remaining table
		if (inTable && tableLines.length > 0) {
			for (const tableLine of tableLines) {
				const cells = tableLine.split("|").filter((c) => c.trim());
				for (const cell of cells) {
					const cellStart = plainText.length + 1;
					const processed = this.processInlineFormatting(cell.trim(), cellStart, formatRequests);
					plainText += processed + "\t";
				}
				plainText = plainText.slice(0, -1) + "\n";
			}
		}

		return { text: plainText, formatRequests };
	}

	/**
	 * Process inline formatting (code, bold) and return clean text + format requests
	 */
	private processInlineFormatting(
		text: string,
		startIndex: number,
		formatRequests: docs_v1.Schema$Request[]
	): string {
		let result = text;
		let offset = 0;

		// Inline code
		const codeMatches = [...text.matchAll(/`([^`]+)`/g)];
		for (const match of codeMatches) {
			const codeText = match[1];
			const matchStart = match.index! - offset;
			const codeStart = startIndex + matchStart;
			const codeEnd = codeStart + codeText.length;

			formatRequests.push({
				updateTextStyle: {
					range: { startIndex: codeStart, endIndex: codeEnd },
					textStyle: {
						weightedFontFamily: { fontFamily: "Roboto Mono" },
						fontSize: { magnitude: 10, unit: "PT" },
						backgroundColor: { color: { rgbColor: { red: 0.95, green: 0.95, blue: 0.95 } } },
					},
					fields: "weightedFontFamily,fontSize,backgroundColor",
				},
			});
			offset += 2; // Remove 2 backticks
		}
		result = result.replace(/`([^`]+)`/g, "$1");

		// Bold
		const boldMatches = [...result.matchAll(/\*\*(.+?)\*\*/g)];
		let boldOffset = 0;
		for (const match of boldMatches) {
			const boldText = match[1];
			const matchStart = match.index! - boldOffset;
			const boldStart = startIndex + matchStart;
			const boldEnd = boldStart + boldText.length;

			formatRequests.push({
				updateTextStyle: {
					range: { startIndex: boldStart, endIndex: boldEnd },
					textStyle: { bold: true },
					fields: "bold",
				},
			});
			boldOffset += 4; // Remove 4 asterisks
		}
		result = result.replace(/\*\*(.+?)\*\*/g, "$1");

		// Links
		result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

		return result;
	}
}
