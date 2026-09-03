import { unzipSync } from "fflate";
import { extractText } from "unpdf";
import { truncate } from "../../core/text.js";
import { charsetOf, decodeText } from "../download.js";
import type { FormatsDeps, ResourceAccessor } from "../types.js";
import {
  DEFAULT_PREVIEW_LIMIT,
  downloadForAccess,
  metadataPreview,
  resourceUrl,
} from "./shared.js";

const MAX_TEXT_CHARS = 8_000;

function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function pdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const result = await extractText(bytes, { mergePages: true });
  const rawText = (result as { text: unknown }).text;
  const text = Array.isArray(rawText)
    ? rawText.filter((v): v is string => typeof v === "string").join("\n")
    : typeof rawText === "string"
      ? rawText
      : String(rawText ?? "");
  return { text: text.trim(), pages: result.totalPages };
}

function docxText(bytes: Uint8Array): string | undefined {
  try {
    const files = unzipSync(bytes);
    const xml = files["word/document.xml"];
    if (!xml) return undefined;
    return stripMarkup(new TextDecoder("utf-8").decode(xml));
  } catch {
    return undefined;
  }
}

export function createDocumentAccessor(deps: FormatsDeps): ResourceAccessor {
  return {
    id: "document",
    capabilities: ["document_preview"],
    supports: (ctx) =>
      ctx.report.strategy === "document" ||
      ["pdf", "html", "md", "txt", "docx", "doc", "odt", "document"].includes(
        ctx.report.detectedFormat,
      ),
    async getSchema() {
      return undefined;
    },
    async preview(ctx, options) {
      const format = ctx.report.detectedFormat;
      const download = await downloadForAccess(deps, ctx, resourceUrl(ctx), "truncate");
      const limit = Math.min((options?.limit ?? DEFAULT_PREVIEW_LIMIT) * 400, MAX_TEXT_CHARS);
      const notes: string[] = [];
      if (download.truncated) notes.push("File was truncated to the in-process download cap.");

      if (format === "pdf") {
        const { text, pages } = await pdfText(download.bytes);
        return {
          kind: "text",
          text: truncate(text, limit, "…"),
          facts: { pages, bytes: download.bytes.byteLength, format: "pdf" },
          notes,
        };
      }
      if (format === "docx") {
        const text = docxText(download.bytes);
        if (text === undefined) {
          return metadataPreview(ctx, { bytes: download.bytes.byteLength }, [
            "Could not extract DOCX text; use the download URL.",
          ]);
        }
        return {
          kind: "text",
          text: truncate(text, limit, "…"),
          facts: { format: "docx", bytes: download.bytes.byteLength },
          notes,
        };
      }
      const decoded = decodeText(download.bytes, charsetOf(download.contentType));
      const body = format === "html" ? stripMarkup(decoded.text) : decoded.text;
      return {
        kind: "text",
        text: truncate(body, limit, "…"),
        facts: { encoding: decoded.encoding, format, bytes: download.bytes.byteLength },
        notes,
      };
    },
  };
}
