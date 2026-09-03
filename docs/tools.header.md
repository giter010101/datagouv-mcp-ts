# Tool reference

Every tool is read-only (`readOnlyHint`, `idempotentHint`, `openWorldHint` set; `destructiveHint`
false) and returns two things: a text block laid out like the legacy Python server, and
`structuredContent` — a snake_case JSON mirror of the same facts (`total`, `page`, `page_size`,
`has_next` for paginated tools). Text is soft-capped by `MAX_OUTPUT_CHARS` (explicit
`[Output truncated…]` notice + `text_truncated: true`).

Failures are returned as results, not protocol errors:

```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "Error [NOT_FOUND]: Dataset with ID 'x' not found.\nHint: check the id with search_datasets." }],
  "structuredContent": { "error": { "code": "NOT_FOUND", "message": "…", "hint": "…", "retryable": false } }
}
```

Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `API_ERROR`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK_ERROR`,
`FORMAT_ERROR`, `RESOURCE_UNAVAILABLE`, `UNSUPPORTED_CAPABILITY`, `PAYLOAD_TOO_LARGE`,
`ENGINE_UNAVAILABLE`, `INTERNAL_ERROR` ([architecture.md](architecture.md#cross-cutting-policies)).

Recommended workflows:

- **Find and read data**: `search_datasets` → `list_dataset_resources` (or `get_dataset_resources_summary`)
  → `get_resource_info` → `query_resource_data` (Tabular API) / `preview_resource` / `query_resource`.
- **Third-party APIs**: `search_dataservices` → `get_dataservice_info` → `get_dataservice_openapi_spec` → call `base_api_url` yourself.
- **Usage**: `get_metrics` (production platform only).

The parameter tables below are generated from the Zod input schemas in `src/tools/*.ts`
(descriptions are exactly what the LLM sees). "Registered" means present in `ALL_TOOLS`
(`src/tools/index.ts`) and therefore exposed by the server. The README catalogue is generated
with `tsx scripts/print-tool-catalog.ts`. Regenerate this page with `pnpm docs:tools`
(`docs/generate-tools-reference.mts`) after changing a tool. Legacy names, parameters,
defaults and clamps are frozen ([ADR 0007](../.agent/decisions/0007-tool-naming-and-compat.md)).
