import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { type Config, loadConfig } from "../../src/core/config.js";
import type { FetchLike } from "../../src/core/http.js";
import { createDeps, type ServerDeps } from "../../src/server/deps.js";
import { createMcpServer } from "../../src/server/mcp-server.js";

export interface TestServer {
  client: Client;
  deps: ServerDeps;
  close: () => Promise<void>;
}

/**
 * Wire an in-process MCP client to a fully configured server over
 * `InMemoryTransport`. `fetchImpl` replaces the network (contract fixtures).
 */
export async function startTestServer(options: {
  fetchImpl: FetchLike;
  env?: Record<string, string>;
  config?: Partial<Config>;
}): Promise<TestServer> {
  const config = { ...loadConfig({ HTTP_RETRIES: "0", ...options.env }), ...options.config };
  const deps = createDeps(config, { fetchImpl: options.fetchImpl });
  const server = createMcpServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    deps,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
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
