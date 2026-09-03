import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toDatagouvError } from "../core/errors.js";
import { childLogger, type Logger } from "../core/logger.js";
import { capOutput } from "../core/text.js";
import type { AnyToolDefinition, ToolResult } from "./types.js";

export interface RegistryOptions {
  /** Soft cap for text content per call (see ADR 0008). */
  maxOutputChars: number;
  logger?: Logger;
}

/**
 * Adapt a `ToolDefinition` to the MCP SDK: structured logging, timing,
 * error → `isError` result mapping (never throws to the transport) and output capping.
 */
export function registerTool<TDeps>(
  server: McpServer,
  definition: AnyToolDefinition<TDeps>,
  deps: TDeps,
  options: RegistryOptions,
): void {
  const log = (options.logger ?? childLogger("tools")).child({ tool: definition.name });

  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: definition.annotations,
    },
    async (args, extra) => {
      const started = Date.now();
      log.info({ args }, "tool called");
      try {
        const result = await definition.handler(args, {
          deps,
          log,
          signal: extra.signal,
          requestId: extra.requestId,
        });
        log.info({ ms: Date.now() - started }, "tool completed");
        return toCallToolResult(result, options.maxOutputChars);
      } catch (error) {
        const mapped = toDatagouvError(error);
        log.error({ err: mapped, code: mapped.code, ms: Date.now() - started }, "tool failed");
        return toErrorResult(mapped.toJSON());
      }
    },
  );
}

export function registerTools<TDeps>(
  server: McpServer,
  definitions: ReadonlyArray<AnyToolDefinition<TDeps>>,
  deps: TDeps,
  options: RegistryOptions,
): void {
  for (const definition of definitions) registerTool(server, definition, deps, options);
}

export function toCallToolResult(result: ToolResult, maxOutputChars: number): CallToolResult {
  const capped = capOutput(result.text, maxOutputChars, result.howToGetMore);
  const structured = result.structured
    ? { ...result.structured, ...(capped.truncated ? { text_truncated: true } : {}) }
    : undefined;
  return {
    content: [{ type: "text", text: capped.text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function toErrorResult(error: {
  code: string;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}): CallToolResult {
  const lines = [`Error [${error.code}]: ${error.message}`];
  if (error.hint) lines.push(`Hint: ${error.hint}`);
  if (error.retryable) lines.push("This error is transient; retrying may succeed.");
  return {
    isError: true,
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: { error },
  };
}
