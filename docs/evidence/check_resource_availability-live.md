# Evidence: check_resource_availability (live stdio)

**Date**: 2026-09-03T16:55:44.134Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 742 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "check_resource_availability",
  "arguments": {
    "resource_id": "a86ebc34-a979-4d6c-8f2a-9710a43dca93",
    "live": true
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `check_resource_availability` present

## Output (text, truncated to 80 lines)

```text
Availability check: Gentilés des communes françaises
Resource ID: a86ebc34-a979-4d6c-8f2a-9710a43dca93
URL: https://www.habitants.fr/api/export-gentiles.php
File type: remote

Platform crawler check:
  Available: yes
  HTTP status: 200
  Checked at: 2026-09-02T21:46:30.217618+00:00
  Detected MIME: text/csv
  Content length: 1.6 MB

Live check (HEAD, 740 ms):
  Reachable: yes
  HTTP status: 200
  Content type: text/csv; charset=UTF-8

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

- [x] `tools/list` includes `check_resource_availability`
- [x] Tool returned without `isError`
- [x] Text content present (581 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `check_resource_availability` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
