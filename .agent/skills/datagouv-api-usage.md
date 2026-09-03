# Skill: data.gouv.fr API Usage

> **Placeholder** — to be filled by dev agents after research/02 is complete.

## Primary reference

See `.agent/research/02-datagouv-platform-survey.md` for:
- API base URLs and versions
- Authentication requirements
- Rate limits and pagination
- Available endpoints per domain (datasets, resources, organizations, dataservices, metrics)

## Client layer

All API calls go through `src/clients/`:
- `datagouv-api-client.ts` — main API (datasets, resources, orgs)
- `tabular-api-client.ts` — tabular data API
- `metrics-api-client.ts` — usage metrics
- `crawler-api-client.ts` — crawler status

## Conventions (draft)

- User-Agent: `datagouv-mcp/<version> (+https://github.com/datagouv/datagouv-mcp)`
- Base URL from env: `DATAGOUV_API_BASE_URL` (default: `https://www.data.gouv.fr/api/1`)
- Pagination: follow `page` + `page_size` pattern; return `total` when available
- Caching: LRU cache with 5-minute TTL for search results
- Retries: 3 attempts with exponential backoff for 5xx errors

## TODO

- [ ] Document each endpoint with request/response examples
- [ ] Map Python client methods to TypeScript equivalents
- [ ] Record contract test fixtures per endpoint
