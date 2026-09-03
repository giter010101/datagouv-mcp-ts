import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { type DatagouvError, toDatagouvError } from "../core/errors.js";
import { childLogger, type Logger } from "../core/logger.js";
import { capOutput } from "../core/text.js";
import type { AnyToolDefinition, ToolCallEvent, ToolResult } from "./types.js";

export interface RegistryOptions {
  /** Soft cap for text content per call (see ADR 0008). */
  maxOutputChars: number;
  logger?: Logger;
  /** Fire-and-forget observer for every call (Matomo/Sentry adapters live in `server/telemetry`). */
  onToolCall?: (event: ToolCallEvent) => void;
  /** Observer for failed calls (error reporting). Never throws back into the tool. */
  onToolError?: (error: DatagouvError, event: ToolCallEvent) => void;
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
      ...(definition.outputSchema ? { outputSchema: withTruncationFlag(definition) } : {}),
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
        const durationMs = Date.now() - started;
        log.info({ ms: durationMs }, "tool completed");
        emit(options, { tool: definition.name, durationMs, ok: true, requestId: extra.requestId });
        return toCallToolResult(result, options.maxOutputChars);
      } catch (error) {
        const mapped = toDatagouvError(error);
        const durationMs = Date.now() - started;
        log.error({ err: mapped, code: mapped.code, ms: durationMs }, "tool failed");
        const event: ToolCallEvent = {
          tool: definition.name,
          durationMs,
          ok: false,
          errorCode: mapped.code,
          requestId: extra.requestId,
        };
        emit(options, event);
        try {
          options.onToolError?.(mapped, event);
        } catch (hookError) {
          log.warn({ err: hookError }, "onToolError hook failed");
        }
        return toErrorResult(mapped.toJSON());
      }
    },
  );
}

function emit(options: RegistryOptions, event: ToolCallEvent): void {
  try {
    options.onToolCall?.(event);
  } catch {
    // Telemetry must never affect tool results.
  }
}

function withTruncationFlag<TDeps>(definition: AnyToolDefinition<TDeps>): z.ZodRawShape {
  return { ...definition.outputSchema, text_truncated: z.boolean().optional() };
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
