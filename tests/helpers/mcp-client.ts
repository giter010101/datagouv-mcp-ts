import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Config, loadConfig } from "../../src/core/config.js";
import type { FetchLike } from "../../src/core/http.js";
import { createDeps, type ServerDeps } from "../../src/server/deps.js";
import { createMcpServer } from "../../src/server/mcp-server.js";

/**
 * In-process MCP test client helpers (workstream D).
 *
 * - `createTestMcpClient(server)` — connect an SDK `Client` to any `McpServer`
 *   over `InMemoryTransport`; `callTool()` returns parsed text + structuredContent.
 * - `startTestServer({ fetchImpl | deps })` — full server wired with fake network.
 * - `routedFetch()` — tiny URL-substring router when a MockAgent is overkill.
 */

export interface ToolCallOutcome<TStructured = Record<string, unknown>> {
  /** First text content block ("" when absent). */
  text: string;
  /** `structuredContent` as returned by the server (undefined on tools without output schema). */
  structured: TStructured | undefined;
  isError: boolean;
  /** Raw SDK result for assertions on content blocks / annotations. */
  raw: CallToolResult;
  durationMs: number;
}

export interface TestMcpClient {
  client: Client;
  listTools(): Promise<Tool[]>;
  callTool<TStructured = Record<string, unknown>>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<ToolCallOutcome<TStructured>>;
  /** Like `callTool` but throws when the tool reports `isError`. */
  callToolOk<TStructured = Record<string, unknown>>(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<ToolCallOutcome<TStructured>>;
  close(): Promise<void>;
}

export function firstText(result: CallToolResult): string {
  const block = result.content.find((c) => c.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** Wrap a connected SDK client with the call helpers used across test suites. */
export function wrapClient(client: Client, close: () => Promise<void>): TestMcpClient {
  const wrapped: TestMcpClient = {
    client,
    listTools: async () => (await client.listTools()).tools,
    callTool: async <TStructured>(name: string, args: Record<string, unknown> = {}) => {
      const started = Date.now();
      const raw = (await client.callTool({ name, arguments: args })) as CallToolResult;
      return {
        text: firstText(raw),
        structured: raw.structuredContent as TStructured | undefined,
        isError: raw.isError === true,
        raw,
        durationMs: Date.now() - started,
      };
    },
    callToolOk: async <TStructured>(name: string, args: Record<string, unknown> = {}) => {
      const outcome = await wrapped.callTool<TStructured>(name, args);
      if (outcome.isError) {
        throw new Error(`Tool ${name} returned isError: ${outcome.text.slice(0, 500)}`);
      }
      return outcome;
    },
    close,
  };
  return wrapped;
}

/**
 * Connect an in-process MCP `Client` to `server` over `InMemoryTransport`.
 * Works with any `McpServer` (real `createMcpServer(deps)` or a hand-built one).
 */
export async function createTestMcpClient(server: McpServer): Promise<TestMcpClient> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return wrapClient(client, async () => {
    await client.close();
    await server.close();
  });
}

export interface TestServer extends TestMcpClient {
  deps: ServerDeps;
}

export interface StartTestServerOptions {
  /** Fake network (e.g. `mockDatagouv().fetchImpl` or `routedFetch([...])`). */
  fetchImpl?: FetchLike;
  /** Pre-built deps (e.g. `createDeps(...)` with fakes spliced in). Wins over `fetchImpl`. */
  deps?: ServerDeps;
  env?: Record<string, string>;
  config?: Partial<Config>;
}

/**
 * Wire an in-process MCP client to a fully configured server over
 * `InMemoryTransport`. Retries are disabled by default so failure paths are fast.
 */
export async function startTestServer(options: StartTestServerOptions = {}): Promise<TestServer> {
  const config = { ...loadConfig({ HTTP_RETRIES: "0", ...options.env }), ...options.config };
  const deps =
    options.deps ?? createDeps(config, options.fetchImpl ? { fetchImpl: options.fetchImpl } : {});
  const server = createMcpServer(deps);
  const client = await createTestMcpClient(server);
  return { ...client, deps };
}

/** Route requests by URL substring to canned responses; throws on unexpected URLs. */
export function routedFetch(
  routes: Array<{ match: string | RegExp; respond: (url: URL) => Response | Promise<Response> }>,
): FetchLike & { calls: URL[] } {
  const calls: URL[] = [];
  const fn: FetchLike = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const route = routes.find((r) =>
      typeof r.match === "string" ? url.href.includes(r.match) : r.match.test(url.href),
    );
    if (!route) throw new Error(`Unexpected request in test: ${url.href}`);
    return route.respond(url);
  };
  return Object.assign(fn, { calls });
}
