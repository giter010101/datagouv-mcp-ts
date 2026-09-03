# 0005: Zod 4 (`zod@4.5.4`) as the single validation library

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: architect

## Context

`@modelcontextprotocol/sdk@1.30.0` declares `peerDependencies: { zod: "^3.25 || ^4.0" }` and ships a `zod-compat` layer accepting both. Zod 4 is the current major (4.5.4 on 2026-09-03), faster, with `z.looseObject`, better JSON-schema output and smaller bundles. Mixing majors (3 for SDK shapes, 4 elsewhere) would double the dependency and confuse types.

## Decision

- Depend on **`zod@4.5.4`** only (`import { z } from "zod"`).
- Tool input schemas are passed to `registerTool` as **raw shapes** (`z.ZodRawShape`, e.g. `searchDatasetsInputShape`) so the SDK builds the JSON Schema; `.describe()` on every field feeds the LLM.
- Upstream API payloads are parsed with **loose objects** (`z.looseObject`) so unknown fields never break us; only fields we read are typed.
- Config is parsed once with Zod (`core/config.ts`), errors aggregated into `ConfigError`.
- `z.output<z.ZodObject<TShape>>` is the handler input type (`tools/types.ts`); no hand-written duplicates.

## Consequences

### Positive
- One validation vocabulary across config, API responses and tool inputs; typed inference end-to-end.

### Negative
- If a future SDK 1.x drops zod 4 compat (unlikely; v2 is zod-4-first) we would pin the SDK.

### Neutral
- `zod/v4` sub-path imports are unnecessary; the root export is v4.
