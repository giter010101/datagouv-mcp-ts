/** Small pure helpers for LLM-oriented text output. */

export function truncate(text: string, max: number, suffix = "..."): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - suffix.length))}${suffix}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "unknown size";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

export interface TruncationResult {
  text: string;
  truncated: boolean;
  originalChars: number;
}

/**
 * Soft-cap text for a tool response. Appends an explicit notice so the LLM
 * knows the output was cut and how to get the rest.
 */
export function capOutput(text: string, maxChars: number, howToGetMore?: string): TruncationResult {
  if (text.length <= maxChars) return { text, truncated: false, originalChars: text.length };
  const notice = `\n\n[Output truncated: ${text.length} characters, showing first ${maxChars}.${
    howToGetMore ? ` ${howToGetMore}` : ""
  }]`;
  return {
    text: `${text.slice(0, maxChars)}${notice}`,
    truncated: true,
    originalChars: text.length,
  };
}
