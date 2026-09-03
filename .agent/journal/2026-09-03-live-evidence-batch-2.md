# Live evidence batch 2 (2026-09-03)

**Agent:** Composer (live evidence batch 2)  
**Branch:** `cursor/datagouv-mcp-typescript-refonte-57e0`  
**Goal status:** complete — remaining 10 tools have live stdio PASS reports

## What ran

1. `pnpm build` (tsdown → `dist/index.js`)
2. `DATAGOUV_API_ENV=prod node /tmp/evidence-live-batch2.mjs`
   - spawn `node dist/index.js` stdio
   - JSON-RPC `initialize` + `tools/list` (21 tools) + sequential `tools/call`

IDs from `.agent/research/02-datagouv-platform-survey.md` (topics via live `/api/2/topics/`):

- API Adresse dataservice `672cf67802ef6b1be63b8975`
- Population dataset `53699d0ea3a729239d205b2e`
- Tabular resource `a86ebc34-a979-4d6c-8f2a-9710a43dca93`
- Reuse on population `6a96cc1b2aeed626b1cb300e` (Zonelo)
- Topic Inoé `6a9767b730e2eeddc825f377`

## Results (all PASS)

| Tool | Duration | Args |
|------|----------|------|
| search_dataservices | 968 ms | query adresse, page_size 3 |
| get_dataservice_info | 191 ms | 672cf67802ef6b1be63b8975 |
| get_dataservice_openapi_spec | 1551 ms | same dataservice (geopf OpenAPI) |
| get_dataset_resources_summary | 185 ms | 53699d0ea3a729239d205b2e |
| get_resource_schema | 2206 ms | a86ebc34-… |
| search_reuses | 257 ms | query population, page_size 3 |
| get_reuse_info | 424 ms | 6a96cc1b2aeed626b1cb300e |
| list_topics | 265 ms | query "", page_size 3 |
| get_topic | 204 ms | Inoé 6a9767b730e2eeddc825f377 |
| query_resource | 219 ms | a86ebc34-…, page_size 5 |

## Files

- `docs/evidence/*-live.md` — 10 new live reports
- `docs/evidence/coverage.md` — live rows added; offline rows kept
- `docs/evidence/README.md` — created (index of live vs offline proofs)

Did not edit `src/**`, `tests/**`, `package.json`, `scripts/**`, `.github/**`.
