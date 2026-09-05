# Evidence: check_resource_availability (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 1 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
  "live": false
}
```

## Output (text, truncated)
```text
Availability check: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
URL: https://www.habitants.fr/api/export-gentiles.php
File type: remote

Platform crawler check:
  Available: yes
  HTTP status: 200
  Checked at: [redacted]
  Detected MIME: text/csv
  Content length: 1.6 MB

Verdict: available
Recommendation: The file is reachable: call get_resource_info for the access path, then preview_resource or query_resource.
```

## structuredContent (keys)
- `resource_id`
- `title`
- `url`
- `latest_url`
- `filetype`
- `verdict`
- `platform_check`
- `live_check`
- `recommendation`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (455 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
