import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "../src/core/config.js";
import { createDeps } from "../src/server/deps.js";
import { createMcpServer } from "../src/server/mcp-server.js";

/**
 * Evidence report generator (rules/testing-and-evidence.md).
 *
 *   pnpm evidence --tool search_datasets --input '{"query":"population"}'
 *   pnpm evidence --tool search_datasets --input '{"query":"population"}' --stdio   # through dist/index.js
 *
 * Executes the tool for real (live network), writes:
 *   docs/evidence/<tool>-<YYYY-MM-DD>.md   (truncated, human readable)
 *   docs/evidence/raw/<tool>-<YYYY-MM-DD>.json (full result; git-ignored)
 */

const { values } = parseArgs({
  options: {
    tool: { type: "string" },
    input: { type: "string", default: "{}" },
    stdio: { type: "boolean", default: false },
    agent: { type: "string", default: process.env.EVIDENCE_AGENT ?? "unknown" },
    "out-dir": { type: "string", default: "docs/evidence" },
    "max-lines": { type: "string", default: "60" },
  },
  strict: true,
});

if (!values.tool) {
  console.error(
    'Usage: pnpm evidence --tool <name> --input \'{"key":"value"}\' [--stdio] [--agent name]',
  );
  process.exit(2);
}

const toolName = values.tool;
const input = JSON.parse(values.input ?? "{}") as Record<string, unknown>;
const date = new Date().toISOString().slice(0, 10);
const outDir = resolve(values["out-dir"] ?? "docs/evidence");
const maxLines = Number(values["max-lines"] ?? "60");

async function connectClient(): Promise<{ client: Client; close: () => Promise<void> }> {
  const client = new Client({ name: "evidence", version: "0.0.0" });
  if (values.stdio) {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve("dist/index.js")],
      env: {
        ...(process.env as Record<string, string>),
        LOG_LEVEL: process.env.LOG_LEVEL ?? "warn",
      },
      stderr: "inherit",
    });
    await client.connect(transport);
    return { client, close: () => client.close() };
  }
  const deps = createDeps(loadConfig());
  const server = createMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function firstText(result: CallToolResult): string {
  const block = result.content.find((c) => c.type === "text");
  return block && block.type === "text" ? block.text : "";
}

const { client, close } = await connectClient();
const started = Date.now();
let result: CallToolResult;
try {
  const tools = await client.listTools();
  if (!tools.tools.some((t) => t.name === toolName)) {
    console.error(
      `Unknown tool "${toolName}". Available: ${tools.tools.map((t) => t.name).join(", ")}`,
    );
    process.exit(2);
  }
  result = (await client.callTool({ name: toolName, arguments: input })) as CallToolResult;
} finally {
  await close();
}
const elapsedMs = Date.now() - started;

const text = firstText(result);
const textLines = text.split("\n");
const truncatedText =
  textLines.length > maxLines
    ? `${textLines.slice(0, maxLines).join("\n")}\n… (${textLines.length - maxLines} more lines, see raw output)`
    : text;
const status = result.isError ? "FAIL" : "PASS";
const rawPath = resolve(outDir, "raw", `${toolName}-${date}.json`);
const mdPath = resolve(outDir, `${toolName}-${date}.md`);

mkdirSync(resolve(outDir, "raw"), { recursive: true });
writeFileSync(rawPath, JSON.stringify({ tool: toolName, input, result, elapsedMs }, null, 2));

const structured = result.structuredContent;
const report = `# Evidence: ${toolName}

**Date**: ${date}
**Agent**: ${values.agent}
**Status**: ${status}
**Transport**: ${values.stdio ? "stdio (dist/index.js)" : "in-process"}
**Duration**: ${elapsedMs} ms
**Data env**: ${process.env.DATAGOUV_API_ENV ?? "prod"}

## Input
\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

## Output (text, truncated to ${maxLines} lines)
\`\`\`text
${truncatedText}
\`\`\`

## structuredContent (keys)
${
  structured
    ? Object.keys(structured)
        .map((k) => `- \`${k}\``)
        .join("\n")
    : "_none_"
}

## Assertions
- [${result.isError ? " " : "x"}] Tool returned without \`isError\`
- [${text.length > 0 ? "x" : " "}] Text content present (${text.length} chars)
- [${structured ? "x" : " "}] \`structuredContent\` present
- [${text.length <= 50_000 ? "x" : " "}] Text under 50 KB

## Full output
See \`docs/evidence/raw/${toolName}-${date}.json\` (git-ignored; regenerate with the command below).

\`\`\`bash
pnpm evidence --tool ${toolName} --input '${JSON.stringify(input)}'${values.stdio ? " --stdio" : ""}
\`\`\`
`;
writeFileSync(mdPath, report);
console.log(`${status} ${toolName} in ${elapsedMs} ms → ${mdPath}`);
process.exit(result.isError ? 1 : 0);
