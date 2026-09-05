import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { childLogger } from "../core/logger.js";
import { APP_VERSION } from "../core/version.js";
import type { ServerDeps } from "./deps.js";
import { createMcpServer } from "./mcp-server.js";

/**
 * stdio transport: one server per process, JSON-RPC over stdin/stdout.
 * All logging goes to stderr (see `core/logger.ts`).
 */
export async function runStdio(deps: ServerDeps): Promise<void> {
  const log = childLogger("stdio");
  const server = createMcpServer(deps);
  const transport = new StdioServerTransport();

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    await server.close().catch(() => undefined);
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await server.connect(transport);
  log.info({ version: APP_VERSION, dataEnv: deps.config.datagouvApiEnv }, "stdio transport ready");
}
