# Evidence: get_metrics (live stdio)

**Date**: 2026-09-03T16:55:46.104Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 984 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_metrics",
  "arguments": {
    "dataset_id": "53699d0ea3a729239d205b2e",
    "limit": 3
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `pnpm exec tsx scripts/evidence-live.ts`
- `tools/list` returned **21** tools; `get_metrics` present

## Output (text, truncated to 80 lines)

```text
Dataset Metrics: Population
Dataset ID: 53699d0ea3a729239d205b2e

Monthly Statistics:
------------------------------------------------------------
Month        Visits          Downloads
------------------------------------------------------------
2026-09      444             108
2026-08      4,628           3,142
2026-07      4,216           593
------------------------------------------------------------
Total        9,288           3,843
```

## structuredContent (keys)

- `limit`
- `dataset`

## Assertions

- [x] `tools/list` includes `get_metrics`
- [x] Tool returned without `isError`
- [x] Text content present (443 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_metrics` succeeded against production API.

## Reproduce

```bash
pnpm build
pnpm exec tsx scripts/evidence-live.ts
```
