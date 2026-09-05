# 0009: In-memory caching, retries and download limits

**Status**: accepted
**Date**: 2026-09-03
**Deciders**: architect

## Context

Legacy made a fresh HTTP session per call, had no retries and cached only crawler exceptions (1 h). data.gouv.fr APIs publish `cache-control: public` but no rate-limit headers; `get_resource_info` performed up to 4 upstream calls. LLM sessions repeat the same lookups many times within minutes.

## Decision

1. **One `HttpClient` per process** (`core/http.ts`): global `fetch` (undici pool), `User-Agent: datagouv-mcp/<version>`, timeout `HTTP_TIMEOUT_MS` (15 s), `HTTP_RETRIES` (2) with exponential backoff + jitter on 408/425/429/5xx and network errors, `Retry-After` honoured (capped 10 s), 404 never retried, per-call overrides (`timeoutMs`, `retries`, `notFoundMessage`).
2. **In-memory LRU cache** (`core/cache.ts`, lru-cache): `CACHE_MAX_ENTRIES` (500), default TTL `CACHE_DEFAULT_TTL_MS` (5 min), per-key TTL, in-flight de-duplication, `staleOnError` for resilience (crawler exceptions). TTL table in exec-plan 001 §7. `CACHE_MAX_ENTRIES=0` disables caching (tests).
3. **Downloads are bounded**: `MAX_DOWNLOAD_BYTES` (50 MB) enforced both from `Content-Length` and while streaming (`readBodyBounded`); above it → `PAYLOAD_TOO_LARGE` with a hint to use Tabular/Parquet/URL. File bytes are never cached; parsed previews are (5 min).
4. **Concurrency**: ≤ 5 parallel upstream calls per tool invocation; no background prefetching.
5. **Keys** are namespaced strings `service:entity:id[:querystring]`; values are normalised `core/types`, never raw `Response`s.
6. No disk/shared cache in 1.0 (multi-instance deployments simply cache independently).

## Consequences

### Positive
- Repeated lookups in a session are instant; transient upstream hiccups are absorbed; memory is bounded.

### Negative
- Freshness lag up to TTL (fine for a daily-updated catalogue); stale-on-error can hide an outage for the exceptions list (by design).

### Neutral
- `fetchImpl` injection keeps every test offline (`routedFetch`, undici `MockAgent`).
