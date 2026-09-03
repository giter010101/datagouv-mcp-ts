import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { Logger } from "../core/logger.js";

/**
 * Tool contracts (workstream C owns `src/tools`).
 *
 * A tool is a plain object: schema + LLM-facing description + handler returning
 * `ToolResult`. `registry.ts` adapts it to the MCP SDK, adds logging, error
 * mapping and output capping so handlers stay thin and testable.
 */

export interface ToolContext<TDeps> {
  deps: TDeps;
  log: Logger;
  signal: AbortSignal | undefined;
  requestId: string | number | undefined;
}

export interface ToolResult {
  /** Human/LLM readable text. Will be soft-capped by the registry. */
  text: string;
  /** Machine-readable mirror (goes to `structuredContent`). */
  structured?: Record<string, unknown>;
  /** Hint appended to the truncation notice (e.g. "Use page=2 for more"). */
  howToGetMore?: string;
}

export interface ToolDefinition<TShape extends z.ZodRawShape, TDeps> {
  /** Legacy-compatible snake_case name (see ADR 0007). */
  name: string;
  title: string;
  description: string;
  inputSchema: TShape;
  annotations: ToolAnnotations;
  // Method syntax (not an arrow property) on purpose: parameter bivariance lets
  // tools with specific shapes be stored in a `ToolDefinition<z.ZodRawShape, D>[]`.
  handler(input: z.output<z.ZodObject<TShape>>, ctx: ToolContext<TDeps>): Promise<ToolResult>;
}

/** Helper preserving inference of the input shape and deps. */
export function defineTool<TShape extends z.ZodRawShape, TDeps>(
  definition: ToolDefinition<TShape, TDeps>,
): ToolDefinition<TShape, TDeps> {
  return definition;
}

/** Erased element type for heterogeneous tool lists. */
export type AnyToolDefinition<TDeps> = ToolDefinition<z.ZodRawShape, TDeps>;
