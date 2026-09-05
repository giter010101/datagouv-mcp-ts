import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/** Every tool of this server is a read-only call to public external APIs. */
export const READ_ONLY_EXTERNAL_API_TOOL: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
