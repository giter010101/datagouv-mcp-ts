# Tool evidence coverage

Index of **registered MCP tools** (`ALL_TOOLS` in `src/tools/index.ts`) to proof artifacts under `docs/evidence/`.

Gate: `pnpm evidence:check` (fails if a tool has no row, the markdown file is missing, or status is not PASS/OK).

Offline reports were produced on 2026-09-03 by `EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts` (in-process MCP + recorded fixtures). Live stdio reports (`*-live.md`) were produced with `pnpm exec tsx scripts/evidence-live.ts` and `/tmp/evidence-live-batch2.mjs` (`node dist/index.js` JSON-RPC against production).

| Tool | Evidence file | Mode (offline/live) | Status |
|------|---------------|------|--------|
| `search_datasets` | `search_datasets-live.md` | live | PASS |
| `search_datasets` | `search_datasets-offline-2026-09-03.md` | offline | PASS |
| `search_organizations` | `search_organizations-live.md` | live | PASS |
| `search_organizations` | `search_organizations-offline-2026-09-03.md` | offline | PASS |
| `search_dataservices` | `search_dataservices-live.md` | live | PASS |
| `search_dataservices` | `search_dataservices-offline-2026-09-03.md` | offline | PASS |
| `get_dataservice_info` | `get_dataservice_info-live.md` | live | PASS |
| `get_dataservice_info` | `get_dataservice_info-offline-2026-09-03.md` | offline | PASS |
| `get_dataservice_openapi_spec` | `get_dataservice_openapi_spec-live.md` | live | PASS |
| `get_dataservice_openapi_spec` | `get_dataservice_openapi_spec-offline-2026-09-03.md` | offline | PASS |
| `get_dataset_info` | `get_dataset_info-live.md` | live | PASS |
| `get_dataset_info` | `get_dataset_info-offline-2026-09-03.md` | offline | PASS |
| `list_dataset_resources` | `list_dataset_resources-live.md` | live | PASS |
| `list_dataset_resources` | `list_dataset_resources-offline-2026-09-03.md` | offline | PASS |
| `get_resource_info` | `get_resource_info-live.md` | live | PASS |
| `get_resource_info` | `get_resource_info-offline-2026-09-03.md` | offline | PASS |
| `query_resource_data` | `query_resource_data-live.md` | live | PASS |
| `query_resource_data` | `query_resource_data-offline-2026-09-03.md` | offline | PASS |
| `get_metrics` | `get_metrics-live.md` | live | PASS |
| `get_metrics` | `get_metrics-offline-2026-09-03.md` | offline | PASS |
| `check_resource_availability` | `check_resource_availability-live.md` | live | PASS |
| `check_resource_availability` | `check_resource_availability-offline-2026-09-03.md` | offline | PASS |
| `get_dataset_resources_summary` | `get_dataset_resources_summary-live.md` | live | PASS |
| `get_dataset_resources_summary` | `get_dataset_resources_summary-offline-2026-09-03.md` | offline | PASS |
| `get_resource_schema` | `get_resource_schema-live.md` | live | PASS |
| `get_resource_schema` | `get_resource_schema-offline-2026-09-03.md` | offline | PASS |
| `get_reuse_info` | `get_reuse_info-live.md` | live | PASS |
| `get_reuse_info` | `get_reuse_info-offline-2026-09-03.md` | offline | PASS |
| `list_high_value_datasets` | `list_high_value_datasets-live.md` | live | PASS |
| `list_high_value_datasets` | `list_high_value_datasets-offline-2026-09-03.md` | offline | PASS |
| `list_topics` | `list_topics-live.md` | live | PASS |
| `list_topics` | `list_topics-offline-2026-09-03.md` | offline | PASS |
| `get_topic` | `get_topic-live.md` | live | PASS |
| `get_topic` | `get_topic-offline-2026-09-03.md` | offline | PASS |
| `preview_resource` | `preview_resource-live.md` | live | PASS |
| `preview_resource` | `preview_resource-offline-2026-09-03.md` | offline | PASS |
| `query_resource` | `query_resource-live.md` | live | PASS |
| `query_resource` | `query_resource-offline-2026-09-03.md` | offline | PASS |
| `search_reuses` | `search_reuses-live.md` | live | PASS |
| `search_reuses` | `search_reuses-offline-2026-09-03.md` | offline | PASS |
| `suggest` | `suggest-live.md` | live | PASS |
| `suggest` | `suggest-offline-2026-09-03.md` | offline | PASS |
