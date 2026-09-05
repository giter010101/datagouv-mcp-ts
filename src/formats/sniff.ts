/**
 * Content sniffing from the first bytes of a file. Declared formats on
 * data.gouv.fr are frequently wrong (74k empty formats, "csv" pointing to an
 * HTML error page…), so accessors and the capability detector look at the
 * bytes before trusting metadata.
 */

export type SniffedKind =
  | "zip"
  | "gzip"
  | "parquet"
  | "pdf"
  | "ole" // legacy MS Office (xls, doc)
  | "sqlite"
  | "png"
  | "jpeg"
  | "html"
  | "xml"
  | "json-object"
  | "json-array"
  | "text"
  | "binary"
  | "empty";

export interface SniffResult {
  kind: SniffedKind;
  /** Text kinds: whether a UTF-8 BOM was present. */
  bom: boolean;
  /** Best-effort guess for text kinds ("csv" when delimiters dominate the first lines). */
  textHint: "csv" | "tsv" | "jsonl" | "text" | undefined;
}

const UTF8_BOM = [0xef, 0xbb, 0xbf];

function startsWith(bytes: Uint8Array, magic: number[] | string, offset = 0): boolean {
  const seq = typeof magic === "string" ? Array.from(magic, (c) => c.charCodeAt(0)) : magic;
  if (bytes.length < offset + seq.length) return false;
  return seq.every((b, i) => bytes[offset + i] === b);
}

function isMostlyText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  return control / Math.max(1, sample.length) < 0.05;
}

function textHint(text: string): SniffResult["textHint"] {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 5);
  if (lines.length === 0) return "text";
  const first = lines[0] ?? "";
  if (lines.every((l) => /^\s*\{.*\}\s*$/.test(l)) && lines.length >= 2) return "jsonl";
  if (lines.length === 1 && /^\s*\{.*\}\s*$/.test(first)) return "jsonl";
  const tabs = (first.match(/\t/g) ?? []).length;
  const semis = (first.match(/;/g) ?? []).length;
  const commas = (first.match(/,/g) ?? []).length;
  if (tabs >= 1 && tabs >= semis && tabs >= commas) return "tsv";
  if (semis >= 1 || commas >= 1) return "csv";
  return "text";
}

/** Inspect the first bytes (≥ 8 recommended, 512 ideal). Pure, never throws. */
export function sniffBytes(input: Uint8Array): SniffResult {
  if (input.length === 0) return { kind: "empty", bom: false, textHint: undefined };
  const bom = startsWith(input, UTF8_BOM);
  const bytes = bom ? input.subarray(3) : input;

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    return { kind: "zip", bom, textHint: undefined };
  }
  if (startsWith(bytes, [0x1f, 0x8b])) return { kind: "gzip", bom, textHint: undefined };
  if (startsWith(bytes, "PAR1")) return { kind: "parquet", bom, textHint: undefined };
  if (startsWith(bytes, "%PDF")) return { kind: "pdf", bom, textHint: undefined };
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return { kind: "ole", bom, textHint: undefined };
  if (startsWith(bytes, "SQLite format 3")) return { kind: "sqlite", bom, textHint: undefined };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { kind: "png", bom, textHint: undefined };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: "jpeg", bom, textHint: undefined };

  if (!isMostlyText(bytes)) return { kind: "binary", bom, textHint: undefined };

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 512));
  const trimmed = text.replace(/^\s+/, "");
  const lower = trimmed.slice(0, 256).toLowerCase();
  if (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    /<head>|<body/.test(lower)
  ) {
    return { kind: "html", bom, textHint: undefined };
  }
  if (trimmed.startsWith("<?xml") || /^<[a-z_][\w:.-]*[\s>]/i.test(trimmed)) {
    return { kind: "xml", bom, textHint: undefined };
  }
  if (trimmed.startsWith("[")) return { kind: "json-array", bom, textHint: undefined };
  if (trimmed.startsWith("{")) {
    const hint = textHint(text);
    return { kind: "json-object", bom, textHint: hint === "jsonl" ? "jsonl" : undefined };
  }
  return { kind: "text", bom, textHint: textHint(text) };
}

/** Map a sniffed kind to the normalised format vocabulary used by the detector. */
export function sniffedKindToFormat(result: SniffResult): string | undefined {
  switch (result.kind) {
    case "zip":
      return "zip";
    case "gzip":
      return "gzip";
    case "parquet":
      return "parquet";
    case "pdf":
      return "pdf";
    case "ole":
      return "xls";
    case "sqlite":
      return "sqlite";
    case "png":
      return "png";
    case "jpeg":
      return "jpeg";
    case "html":
      return "html";
    case "xml":
      return "xml";
    case "json-array":
      return "json";
    case "json-object":
      return result.textHint === "jsonl" ? "jsonl" : "json";
    case "text":
      return result.textHint === "text" ? "txt" : result.textHint;
    default:
      return undefined;
  }
}
