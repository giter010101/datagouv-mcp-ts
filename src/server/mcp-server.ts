import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { APP_NAME, APP_VERSION } from "../core/version.js";
import { ALL_TOOLS, registerTools } from "../tools/index.js";
import type { ServerDeps } from "./deps.js";
import { createTelemetry } from "./telemetry.js";

export const SERVER_TITLE = "data.gouv.fr MCP server";

export const SERVER_INSTRUCTIONS = [
  "Read-only access to data.gouv.fr, the French national open data platform (≈74k datasets, ≈690k resources, ≈1.2k APIs).",
  "Typical workflow: search_datasets → list_dataset_resources → query_resource_data (or get_resource_info to learn how a resource can be accessed).",
  "Use short, specific French keywords: the search is AND-based.",
].join("\n");

/**
 * Build a fully wired `McpServer`. Cheap enough to be called per request in
 * stateless HTTP mode (tool registration only; no I/O).
 */
export function createMcpServer(deps: ServerDeps): McpServer {
  const server = new McpServer(
    { name: APP_NAME, version: APP_VERSION, title: SERVER_TITLE },
    { instructions: SERVER_INSTRUCTIONS, capabilities: { tools: {}, logging: {} } },
  );
  const telemetry = createTelemetry(deps.config);
  registerTools(server, ALL_TOOLS, deps, {
    maxOutputChars: deps.config.output.maxChars,
    onToolCall: (event) => telemetry.onToolCall(event),
  });
  return server;
}
