import { XMLParser, XMLValidator } from "fast-xml-parser";
import { FormatError } from "../../core/errors.js";
import type { Row } from "../../core/types.js";
import { findRecordsArray, flattenRecord } from "./json.js";

/**
 * XML → records. Parses to a JS tree (fast-xml-parser) then applies the same
 * "largest array of objects" heuristic as JSON to find repeated record
 * elements (`<row>`, `<record>`, `<Placemark>`, `<featureMember>`…).
 */

export interface XmlRecords {
  rows: Row[];
  recordsPath: string;
  total: number;
  rootElement: string | undefined;
  truncated: boolean;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  isArray: (_name, _jpath, _isLeaf, isAttribute) => !isAttribute && false,
});

export function parseXmlTree(text: string): Record<string, unknown> {
  const clean = text.replace(/^\uFEFF/, "");
  const valid = XMLValidator.validate(clean, { allowBooleanAttributes: true });
  if (valid !== true) {
    throw new FormatError(`Invalid XML: ${valid.err.msg} (line ${valid.err.line})`, {
      hint: "The file may be truncated or not XML; check the declared format.",
    });
  }
  return parser.parse(clean) as Record<string, unknown>;
}

/** Records with a single scalar child collapse to `{ "#text": ... }`; keep them readable. */
function normaliseRecord(item: unknown): Row {
  if (item === null || typeof item !== "object") return { value: item };
  return flattenRecord(item);
}

export function xmlToRecords(
  text: string,
  options: { limit?: number; inputTruncated?: boolean } = {},
): XmlRecords {
  let source = text;
  if (options.inputTruncated) source = repairTruncatedXml(text);
  const tree = parseXmlTree(source);
  const rootElement = Object.keys(tree)[0];
  const found = findRecordsArray(tree, 6);
  if (!found) {
    const root = rootElement ? tree[rootElement] : tree;
    return {
      rows: [normaliseRecord(root)],
      recordsPath: rootElement ? `/${rootElement}` : "/",
      total: 1,
      rootElement,
      truncated: false,
    };
  }
  const rows = found.array.slice(0, options.limit).map(normaliseRecord);
  return {
    rows,
    recordsPath: found.path.replace(/^\$/, "").replace(/\./g, "/") || "/",
    total: found.array.length,
    rootElement,
    truncated: options.limit !== undefined && found.array.length > options.limit,
  };
}

/** Best-effort: cut at the last complete closing tag and close open elements so a partial download parses. */
export function repairTruncatedXml(text: string): string {
  const lastClose = text.lastIndexOf(">");
  let cut = lastClose === -1 ? text : text.slice(0, lastClose + 1);
  const stack: string[] = [];
  const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)[^<>]*?(\/?)>/g;
  for (const match of cut.matchAll(tagRe)) {
    const [whole, closing, name, selfClosing] = match;
    if (whole.startsWith("<?") || whole.startsWith("<!")) continue;
    if (selfClosing) continue;
    if (closing) {
      const index = stack.lastIndexOf(name ?? "");
      if (index !== -1) stack.splice(index);
    } else {
      stack.push(name ?? "");
    }
  }
  // Drop a possibly partial last record: pop the innermost element entirely when unbalanced.
  if (stack.length > 1) {
    const inner = stack[stack.length - 1] ?? "";
    const lastOpen = cut.lastIndexOf(`<${inner}`);
    if (lastOpen > 0) {
      cut = cut.slice(0, lastOpen);
      stack.pop();
    }
  }
  for (const name of [...stack].reverse()) cut += `</${name}>`;
  return cut;
}
