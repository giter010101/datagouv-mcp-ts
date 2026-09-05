# MCP tool evidence

Proof artifacts for every registered MCP tool (`ALL_TOOLS` in `src/tools/index.ts`).

- **Index / gate:** [`coverage.md`](coverage.md) — `pnpm evidence:check` requires a PASS/OK row and a present file for each tool.
- **Live stdio:** `*-live.md` — `pnpm build` then `node dist/index.js` JSON-RPC (`initialize` + `tools/call`) against production data.gouv.fr.
- **Offline fixtures:** `*-offline-2026-09-03.md` — in-process MCP + recorded HTTP fixtures.

Live batches (2026-09-03, version `1.0.0-alpha.0`):

1. `search_datasets` (earlier harness) plus `scripts/evidence-live.ts` (10 tools).
2. Remaining 10 tools via `/tmp/evidence-live-batch2.mjs`: `search_dataservices`, `get_dataservice_info`, `get_dataservice_openapi_spec`, `get_dataset_resources_summary`, `get_resource_schema`, `search_reuses`, `get_reuse_info`, `list_topics`, `get_topic`, `query_resource`.

Each live report records date, version, arguments, truncated text output, duration, and PASS/FAIL.
