# 0008: Output shaping for LLM consumption

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: architect

## Context

Legacy tools returned free text only. LLM clients waste tokens on unbounded outputs, cannot parse results reliably, and mishandle exceptions surfaced as JSON-RPC errors. MCP 2025-11-25 supports `structuredContent` and `isError` results.

## Decision

1. **Dual output**: every tool returns `content: [{ type: "text" }]` (legacy-compatible layout) **and** `structuredContent` (snake_case keys, same facts, no duplication of huge blobs). `outputSchema` is optional and added per tool when stable.
2. **Token budget**: text is soft-capped by `MAX_OUTPUT_CHARS` (default 40,000 chars ≈ 10k tokens) in `tools/registry.ts` via `capOutput`. The cut is explicit: `[Output truncated: N characters, showing first M. <howToGetMore>]` and `structuredContent.text_truncated = true`. Tools must themselves stay well under the cap by paginating (≤ 200 rows, cells ≤ 100 chars, descriptions 200/500 chars, tags 5/10).
3. **Pagination everywhere**: `total`, `page`, `page_size`, `has_next` in structured output and a "use page=N+1" line in text.
4. **Errors are results, not exceptions**: `DatagouvError` → `{ isError: true, content: "Error [CODE]: message\nHint: …\n(retryable)", structuredContent: { error: { code, message, hint, details, retryable } } }`. Only input-schema violations become protocol errors (handled by the SDK).
5. **Actionable hints**: every error and every capability report names the next tool to call.
6. **No raw dumps**: `extras`, full OpenAPI specs or file bytes are never returned; summaries plus URLs are.
7. **Deterministic formatting**: numbered lists, `Key: value` lines, ASCII tables for rows, ISO dates, humanised sizes; French content untouched, UI strings in English (legacy).
8. Warnings prefixed `Warning:`; emoji only where legacy strings are preserved.

## Consequences

### Positive
- Predictable size per call; clients with structured support get typed data, others lose nothing.

### Negative
- Slight payload duplication (text + structured) — bounded by the same cap.

### Neutral
- `MAX_OUTPUT_CHARS` is tunable per deployment.
