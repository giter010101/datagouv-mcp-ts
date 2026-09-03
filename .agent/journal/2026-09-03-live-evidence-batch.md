# Live evidence batch (2026-09-03)

**Agent:** Composer (live evidence batch)  
**Branch:** `cursor/datagouv-mcp-typescript-refonte-57e0`  
**Goal status:** not complete (live proofs for remaining tools still missing)

## What ran

1. `pnpm build` (tsdown → `dist/index.js`)
2. `DATAGOUV_API_ENV=prod pnpm exec tsx scripts/evidence-live.ts`
   - spawn `node dist/index.js` stdio
   - JSON-RPC `initialize` + `tools/list` (21 tools) + sequential `tools/call`

Public IDs from `.agent/research/02-datagouv-platform-survey.md` / `03-resource-formats-catalog.md`:
- Population dataset `53699d0ea3a729239d205b2e`
- Tabular resource `a86ebc34-a979-4d6c-8f2a-9710a43dca93`
- Orgs query `etalab`; HVD list `page_size: 3`; suggest `popu`

## Results (all PASS)

| Tool | Duration | Args |
|------|----------|------|
| search_organizations | 867 ms | etalab, page_size 3 |
| get_dataset_info | 182 ms | 53699d0ea3a729239d205b2e |
| list_dataset_resources | 2 ms (warm after get_dataset_info) | same dataset |
| get_resource_info | 2267 ms | a86ebc34-… |
| query_resource_data | 208 ms | a86ebc34-…, page_size 5 |
| preview_resource | 2 ms (warm tabular) | a86ebc34-…, limit 5 |
| check_resource_availability | 742 ms | live HEAD true |
| list_high_value_datasets | 322 ms | page_size 3 (badge=hvd) |
| suggest | 906 ms | popu, size 5 |
| get_metrics | 984 ms | prod Metrics API, limit 3 |

Existing `search_datasets-live.md` left in place (PASS).

## Files

- `scripts/evidence-live.ts` — batch runner
- `docs/evidence/*-live.md` — 10 new reports
- `docs/evidence/coverage.md` — live rows added; offline rows kept
- `docs/evidence/README.md` — did not exist; not created

## Still offline-only

search_dataservices, get_dataservice_info, get_dataservice_openapi_spec, get_dataset_resources_summary, get_resource_schema, get_reuse_info, list_topics, get_topic, query_resource, search_reuses.
