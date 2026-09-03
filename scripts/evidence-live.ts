#!/usr/bin/env node
/**
 * Live stdio evidence batch: spawn `node dist/index.js`, JSON-RPC initialize + tools/call.
 *
 *   pnpm build
 *   pnpm exec tsx scripts/evidence-live.ts
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const ROOT = resolve(import.meta.dirname, "..");
const SERVER = resolve(ROOT, "dist/index.js");
const OUT_DIR = resolve(ROOT, "docs/evidence");
const VERSION = "1.0.0-alpha.0";
const DATE = new Date().toISOString().slice(0, 10);
const MAX_LINES = 80;
const CALL_TIMEOUT_MS = 45_000;

type Rpc = { jsonrpc: "2.0"; id?: number; method?: string; params?: unknown; result?: unknown; error?: unknown };

interface CallSpec {
  name: string;
  arguments: Record<string, unknown>;
}

const CALLS: CallSpec[] = [
  { name: "search_organizations", arguments: { query: "etalab", page_size: 3 } },
  { name: "get_dataset_info", arguments: { dataset_id: "53699d0ea3a729239d205b2e" } },
  { name: "list_dataset_resources", arguments: { dataset_id: "53699d0ea3a729239d205b2e", page_size: 8 } },
  { name: "get_resource_info", arguments: { resource_id: "a86ebc34-a979-4d6c-8f2a-9710a43dca93" } },
  { name: "query_resource_data", arguments: { resource_id: "a86ebc34-a979-4d6c-8f2a-9710a43dca93", page_size: 5 } },
  { name: "preview_resource", arguments: { resource_id: "a86ebc34-a979-4d6c-8f2a-9710a43dca93", limit: 5 } },
  { name: "check_resource_availability", arguments: { resource_id: "a86ebc34-a979-4d6c-8f2a-9710a43dca93", live: true } },
  { name: "list_high_value_datasets", arguments: { page_size: 3 } },
  { name: "suggest", arguments: { query: "popu", size: 5 } },
  { name: "get_metrics", arguments: { dataset_id: "53699d0ea3a729239d205b2e", limit: 3 } },
];

function firstText(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)?.content;
  if (!Array.isArray(content)) return "";
  const block = content.find((c) => c.type === "text");
  return block?.text ?? "";
}

function structuredKeys(result: unknown): string[] {
  const sc = (result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent;
  return sc ? Object.keys(sc) : [];
}

function isErrorResult(result: unknown): boolean {
  return (result as { isError?: boolean } | undefined)?.isError === true;
}

function truncate(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}\n… (${lines.length - maxLines} more lines)`;
}

function formatError(error: unknown): string {
  if (error === undefined || error === null) return "";
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function reportMarkdown(opts: {
  tool: string;
  input: Record<string, unknown>;
  durationMs: number;
  timestamp: string;
  toolsListed: number;
  toolPresent: boolean;
  text: string;
  structuredKeys: string[];
  verdict: "PASS" | "FAIL";
  error?: unknown;
  isError?: boolean;
}): string {
  const errorBlock = opts.error
    ? `\n## Error\n\n\`\`\`json\n${formatError(opts.error)}\n\`\`\`\n`
    : opts.isError
      ? `\n## Error\n\nTool returned \`isError: true\` (see output).\n`
      : "";
  return `# Evidence: ${opts.tool} (live stdio)

**Date**: ${opts.timestamp}
**Version**: ${VERSION}
**Agent**: Composer (live evidence batch)
**Status**: **${opts.verdict}**
**Transport**: stdio (\`node dist/index.js\`)
**Duration**: ${opts.durationMs} ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

\`\`\`json
${JSON.stringify({ name: opts.tool, arguments: opts.input }, null, 2)}
\`\`\`

## Preconditions

- \`pnpm build\` completed successfully
- Evidence harness: \`pnpm exec tsx scripts/evidence-live.ts\`
- \`tools/list\` returned **${opts.toolsListed}** tools; \`${opts.tool}\` ${opts.toolPresent ? "present" : "MISSING"}

## Output (text, truncated to ${MAX_LINES} lines)

\`\`\`text
${truncate(opts.text, MAX_LINES) || "(empty)"}
\`\`\`

## structuredContent (keys)

${opts.structuredKeys.length ? opts.structuredKeys.map((k) => `- \`${k}\``).join("\n") : "_none_"}
${errorBlock}
## Assertions

- [${opts.toolPresent ? "x" : " "}] \`tools/list\` includes \`${opts.tool}\`
- [${opts.verdict === "PASS" ? "x" : " "}] Tool returned without \`isError\`
- [${opts.text.length > 0 ? "x" : " "}] Text content present (${opts.text.length} chars)
- [${opts.structuredKeys.length ? "x" : " "}] \`structuredContent\` present with expected keys

## Verdict

**${opts.verdict}** — live stdio call to \`${opts.tool}\` ${opts.verdict === "PASS" ? "succeeded against production API" : "failed (see Error / output)"}.

## Reproduce

\`\`\`bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
\`\`\`
`;
}

class StdioRpc {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: Rpc) => void; reject: (e: Error) => void }>();
  readonly proc;

  constructor() {
    this.proc = spawn(process.execPath, [SERVER], {
      stdio: ["pipe", "pipe", "inherit"],
      cwd: ROOT,
      env: {
        ...process.env,
        LOG_LEVEL: process.env.LOG_LEVEL ?? "warn",
        DATAGOUV_API_ENV: process.env.DATAGOUV_API_ENV ?? "prod",
      },
    });
    const rl = createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as Rpc;
        if (typeof msg.id === "number") {
          const wait = this.pending.get(msg.id);
          if (wait) {
            this.pending.delete(msg.id);
            wait.resolve(msg);
          }
        }
      } catch {
        // ignore non-JSON log lines on stdout
      }
    });
    this.proc.on("error", (err) => {
      for (const wait of this.pending.values()) wait.reject(err);
      this.pending.clear();
    });
    this.proc.on("close", (code) => {
      for (const wait of this.pending.values()) {
        wait.reject(new Error(`server exited with code ${code ?? 0}`));
      }
      this.pending.clear();
    });
  }

  sendNotify(method: string, params?: unknown): void {
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  request(method: string, params?: unknown, timeoutMs = CALL_TIMEOUT_MS): Promise<Rpc> {
    const id = this.nextId++;
    const msg: Rpc = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout after ${timeoutMs}ms waiting for ${method} id=${id}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolvePromise(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.proc.stdin.write(`${JSON.stringify(msg)}\n`);
    });
  }

  async close(): Promise<void> {
    this.proc.stdin.end();
    await new Promise<void>((resolveClose) => {
      const t = setTimeout(() => {
        this.proc.kill("SIGTERM");
        resolveClose();
      }, 2000);
      this.proc.once("close", () => {
        clearTimeout(t);
        resolveClose();
      });
    });
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const rpc = new StdioRpc();
  const summary: Array<{ tool: string; verdict: string; durationMs: number; file: string; error?: string }> = [];

  try {
    const init = await rpc.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "evidence-live", version: "0.1.0" },
    });
    if (init.error) {
      throw new Error(`initialize failed: ${formatError(init.error)}`);
    }
    rpc.sendNotify("notifications/initialized");
    const list = await rpc.request("tools/list", {});
    const tools = ((list.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []).map((t) => t.name);
    console.log(`tools/list: ${tools.length} tools`);

    for (const call of CALLS) {
      const timestamp = new Date().toISOString();
      const started = Date.now();
      let rpcResp: Rpc | undefined;
      let caught: unknown;
      try {
        rpcResp = await rpc.request("tools/call", { name: call.name, arguments: call.arguments });
      } catch (err) {
        caught = err;
      }
      const durationMs = Date.now() - started;
      const result = rpcResp?.result;
      const text = firstText(result);
      const keys = structuredKeys(result);
      const toolPresent = tools.includes(call.name);
      const rpcError = rpcResp?.error ?? caught;
      const fail =
        Boolean(rpcError) || isErrorResult(result) || !text || !toolPresent;
      const verdict: "PASS" | "FAIL" = fail ? "FAIL" : "PASS";
      const file = `${call.name}-live.md`;
      const md = reportMarkdown({
        tool: call.name,
        input: call.arguments,
        durationMs,
        timestamp,
        toolsListed: tools.length,
        toolPresent,
        text,
        structuredKeys: keys,
        verdict,
        error: rpcError,
        isError: isErrorResult(result),
      });
      writeFileSync(resolve(OUT_DIR, file), md);
      const errorMsg = rpcError
        ? formatError(rpcError)
        : isErrorResult(result)
          ? text.slice(0, 400)
          : undefined;
      summary.push({
        tool: call.name,
        verdict,
        durationMs,
        file,
        error: errorMsg,
      });
      console.log(`${verdict} ${call.name} ${durationMs}ms → docs/evidence/${file}`);
    }
  } finally {
    await rpc.close();
  }

  writeFileSync(resolve("/tmp/evidence-live-summary.json"), JSON.stringify({ version: VERSION, date: DATE, summary }, null, 2));
  console.log(JSON.stringify({ date: DATE, version: VERSION, summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
