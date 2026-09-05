import { truncate } from "../../core/text.js";

const SHORT_DESCRIPTION_CHARS = 300;

/** First paragraph of a markdown description, flattened and bounded. */
export function summarizeDescription(description: string | null | undefined): string {
  if (!description) return "";
  const flattened = description
    .replace(/[#*_`>]+/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(flattened, SHORT_DESCRIPTION_CHARS);
}

/** Read a positive integer from an unknown JSON value (metrics maps mix numbers and nested objects). */
export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
