# Changelog

## 1.0.0-alpha.1

### Minor Changes

- aa73648: TypeScript rewrite of the data.gouv.fr MCP server (first alpha).
  
  - Runs on Node 22 with `@modelcontextprotocol/sdk` 1.x; published as `datagouv-mcp` (`npx datagouv-mcp`).
  - Transports: **stdio** (default, for IDE/CLI clients) and stateless **Streamable HTTP** (`POST /mcp`, `GET /health`) with Host/Origin (DNS-rebinding) protection.
  - Legacy tool names, parameters and in-band messages preserved (`search_datasets` first); every tool also returns `structuredContent` and bounded text output.
  - Configuration keeps the legacy variable names (`MCP_HOST`, `MCP_PORT`, `DATAGOUV_API_ENV`, `LOG_LEVEL`, `MATOMO_*`, `SENTRY_*`) and adds `MCP_TRANSPORT`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, `HTTP_TIMEOUT_MS`, `HTTP_RETRIES`, `MAX_DOWNLOAD_BYTES`, `CACHE_*`, `MAX_OUTPUT_CHARS`, `ENABLE_DUCKDB`.
  - Multi-stage Docker image (`node:22-slim`, non-root) and `docker-compose.yml` with a `/health` check.

### Patch Changes

- 33ecd96: CI now requires `pnpm evidence:check` and `pnpm test:conformance`. Live vitest covers additional tools (get_dataset_info, list_dataset_resources, search_organizations, query_resource_data, preview_resource) for the 1.0.0-alpha.1 cut. Evidence remains 21/21 offline and live; no production 1.0.0 publish.

All notable changes to `datagouv-mcp` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Versions are cut with
[changesets](.changeset/README.md): agents and contributors append bullets under `[Unreleased]`
as they land changes; the release PR moves them into the new version section
(see `.agent/skills/release.md`).

## [Unreleased]

### Added

- **TypeScript rewrite (1.0.0 in progress)** — the server is rewritten in TypeScript
  (Node 22, `@modelcontextprotocol/sdk` 1.x) and published as the npm package `datagouv-mcp`
  (`npx datagouv-mcp`). The package lives at the repository root (`package.json`, `src/`).
- New **stdio** transport (default, for local IDE/CLI clients) in addition to **Streamable HTTP**
  (`POST /mcp`, `GET /health`).
- Every tool returns `structuredContent` (snake_case mirror of the text) and a bounded text output
  (`MAX_OUTPUT_CHARS`), with errors returned as `isError` results carrying a `code` and a `hint`.
- New environment variables: `MCP_TRANSPORT`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`,
  `HTTP_TIMEOUT_MS`, `HTTP_RETRIES`, `MAX_DOWNLOAD_BYTES`, `CACHE_MAX_ENTRIES`, `CACHE_DEFAULT_TTL_MS`,
  `MAX_OUTPUT_CHARS`, `ENABLE_DUCKDB` (legacy names unchanged, see `docs/configuration.md`).
- Formats layer (workstream B): capability detection plus **resource accessors** for Tabular API,
  Hydra/native Parquet, CSV/TSV (gzip), XLSX/XLS/ODS, JSON/JSONL, GeoJSON, ZIP listing + member
  recurse, shapefile-in-zip, XML/KML, PDF/HTML/text, OGC API endpoints, and a metadata-only
  fallback that never throws. Stable exports: `defaultAccessors()`, `createAccessorRegistry()`,
  `openResource()`.
- Optional DuckDB query engine behind `ENABLE_DUCKDB` + `@duckdb/node-api`; pure-JS engine always
  available (filters/sort/page/aggregations aligned with the Tabular API).
- **21 MCP tools** registered in `ALL_TOOLS` (10 legacy first, then 11 new):
  `check_resource_availability`, `get_dataset_resources_summary`, `get_resource_schema`,
  `get_reuse_info`, `list_high_value_datasets`, `list_topics`, `get_topic`, `preview_resource`,
  `query_resource`, `search_reuses`, `suggest`.
- `tsx scripts/print-tool-catalog.ts` prints the README markdown catalogue from `ALL_TOOLS`.
- E2E `tools/list` snapshot (`tests/e2e/tools-list.test.ts`) asserting every registered name,
  count ≥ 21, and the ten legacy names in the first ten slots.
- Multi-stage Docker image (`node:22-slim`, non-root, `HEALTHCHECK` on `/health`), `.dockerignore`
  and `docker-compose.yml` passing every documented variable through.
- Optional **Matomo** tool-call beacons and **Sentry** error logging via `createTelemetry` / `onToolCall`
  (`MATOMO_*`, `SENTRY_*` env vars; no-op when unset).
- Live evidence reports for **all 21 registered MCP tools** (`docs/evidence/*-live.md`;
  `pnpm evidence:check` indexes 42 PASS rows). Automated live vitest smoke for
  `search_datasets`, `get_dataset_info`, `list_dataset_resources`, `search_organizations`,
  `query_resource_data`, and `preview_resource` (`DATAGOUV_LIVE=1`, loose assertions against
  research/evidence fixture IDs). Nightly: `.github/workflows/nightly-live.yml` (`pnpm test:live`).
- Loopback MCP conformance script (`pnpm test:conformance`: HTTP initialize + `tools/list` + `tools/call`).
- GitHub Actions: `ci.yml` (Node 22/24: typecheck, lint, layering, offline tests with coverage,
  required `pnpm evidence:check`, required `pnpm test:conformance`, build, Docker smoke;
  `docs/evidence/**` is **not** path-ignored so evidence-only commits still run the check job),
  `nightly-live.yml` (live suite + evidence, auto-managed tracking issue),
  `docker.yml` (branch: build+`/health` without registry push; main/tags: multi-arch GHCR image
  with provenance/SBOM), `release.yml` (changesets version PR, npm publish with provenance gated
  on `NPM_TOKEN`); Dependabot for npm, Actions and Docker.
- Release tooling: `@changesets/cli` in `alpha` pre-release mode. Next cut is **`1.0.0-alpha.1`**
  (changesets pending; M6 documented). Not a production `1.0.0` and not published to npm from this work.
- Documentation: rewritten `README.md` (quick start, every client configuration in stdio and HTTP
  variants, tool catalogue, architecture, env table), `docs/architecture.md`, `docs/deployment.md`,
  `docs/configuration.md`, `docs/tools.md`, `docs/development.md`, `docs/migration-from-python.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`.

### Changed

- **BREAKING (repository layout)**: the legacy Python implementation (`main.py`, `tools/`, `helpers/`,
  `tests/`, CircleCI, Dockerfile, docker-compose) was moved unchanged to `legacy/python/` and is kept
  as a reference until tool parity; it is no longer released from here.
- Default bind address is `127.0.0.1` (legacy: `0.0.0.0`); the Docker image and compose file set
  `MCP_HOST=0.0.0.0` explicitly.
- Log levels follow pino (`info`, `debug`, …); legacy uppercase Python levels are still accepted.
- Architecture, tool catalogue and milestones: `.agent/exec-plans/001-typescript-rewrite.md`;
  decisions: `.agent/decisions/`.

### Removed

- CircleCI configuration (replaced by GitHub Actions); `tag_version.sh` (replaced by changesets).

### Fixed

- _(nothing yet)_

---

## Python (legacy) history


## 0.2.30 (2026-07-17)

- chore: upgrade dependencies
- docs: add Autohand Code MCP setup ([#124](https://github.com/datagouv/datagouv-mcp/pull/124))
- fix: matomo healthcheck stats ([#122](https://github.com/datagouv/datagouv-mcp/pull/122))


## 0.2.29 (2026-06-24)

- fix(health): run health probe in-process to avoid FD leak ([#121](https://github.com/datagouv/datagouv-mcp/pull/121))
- Replace HTTPX with niquests ([#119](https://github.com/datagouv/datagouv-mcp/pull/119))


## 0.2.28 (2026-06-23)

- fix(docs): fix link in github issues template
- fix(matomo): remove matomo request on/mcp, keep only tools events ([#120](https://github.com/datagouv/datagouv-mcp/pull/120))


## 0.2.27 (2026-06-19)

- add cip for tool tracking as well
- chore: upgrade dependencies ([#117](https://github.com/datagouv/datagouv-mcp/pull/117))
- chore(matomo): try to fix tracking
- fix lint
- fix(ci): fix lint check in CI
- use f-string for error


## 0.2.26 (2026-06-02)

- feat: add sort and last_update_range params to search_datasets ([#113](https://github.com/datagouv/datagouv-mcp/pull/113))
- fix: report real resource count from resources.total in search_datasets ([#115](https://github.com/datagouv/datagouv-mcp/pull/115))


## 0.2.25 (2026-05-18)

- chore: upgrade dependencies
- chore(deps): remove provisional urllib3 constraint
- chore(github): add issue/PR AI policy templates and reminder workflow ([#107](https://github.com/datagouv/datagouv-mcp/pull/107))
- feat(tools): add search_organizations MCP tool ([#103](https://github.com/datagouv/datagouv-mcp/pull/103))
- feat(tools): align third-party API wording with dataservice identifiers ([#110](https://github.com/datagouv/datagouv-mcp/pull/110))
- fix(deps): constrain urllib3 for CVE-2026-44432 ([#112](https://github.com/datagouv/datagouv-mcp/pull/112))
- fix(type): fix type issues


## 0.2.24 (2026-04-22)

- chore: update gitignore
- chore: upgrade dependencies ([#105](https://github.com/datagouv/datagouv-mcp/pull/105))
- feat: add deep health check and call_tool dev script ([#100](https://github.com/datagouv/datagouv-mcp/pull/100))
- feat: add tool titles and MCP annotations ([#102](https://github.com/datagouv/datagouv-mcp/pull/102))
- feat(matomo): track MCP tool calls as Matomo events ([#101](https://github.com/datagouv/datagouv-mcp/pull/101))
- fix(tabular): handle Tabular API 4xx/5xx with LLM hints ([#94](https://github.com/datagouv/datagouv-mcp/pull/94))
- refactor(datagouv): simplify tags handling to match API swagger ([#98](https://github.com/datagouv/datagouv-mcp/pull/98))
- refactor(query_resource_data): remove question parameter ([#95](https://github.com/datagouv/datagouv-mcp/pull/95))


## 0.2.23 (2026-04-09)

- docs(readme): add OpenCode MCP configuration ([#99](https://github.com/datagouv/datagouv-mcp/pull/99))
- docs(readme): note Windows Claude Desktop built-in Node for MCP ([#90](https://github.com/datagouv/datagouv-mcp/pull/90))
- fix: fix wrong matomo env var


## 0.2.22 (2026-04-02)

- chore: update dependencies to fix dependabot alerts ([#79](https://github.com/datagouv/datagouv-mcp/pull/79))
- chore(logging): add structured logging for MCP tool calls
- chore(logging): add unit test
- ci: run workflow on all branches; align Ruff imports with CI ([#81](https://github.com/datagouv/datagouv-mcp/pull/81))
- docs: improve contributing guidelines ([#82](https://github.com/datagouv/datagouv-mcp/pull/82))
- feat(matomo): read base URL from env and skip tracking when unset ([#89](https://github.com/datagouv/datagouv-mcp/pull/89))
- fix: get_metrics limit exceeds API maximum ([#75](https://github.com/datagouv/datagouv-mcp/pull/75))
- fix: handle None values in metrics to prevent TypeError ([#78](https://github.com/datagouv/datagouv-mcp/pull/78))
- fix: typo
- fix(logging): import logger name var ([#80](https://github.com/datagouv/datagouv-mcp/pull/80))
- fix(matomo): use shared httpx client instead of per-request client ([#88](https://github.com/datagouv/datagouv-mcp/pull/88))
- test: add stress test for client disconnect handling ([#83](https://github.com/datagouv/datagouv-mcp/pull/83))


## 0.2.20 (2026-03-04)

- feat: better health check ([#64](https://github.com/datagouv/datagouv-mcp/pull/64))
- feat: remove download_and_parse_resource tool ([#66](https://github.com/datagouv/datagouv-mcp/pull/66))


## 0.2.19 (2026-03-04)

- docs: add TODO
- docs: improve README for instructions about chatbots
- feat: include version in user-agent
- feat: mcp sends a specific user agent to datagouv service
- fix: allow localhost with port in allowed_hosts for local MCP clients
- fix: fix wrong max value
- fix: remove slicing in _parse_json response
- fix(download): harden RAM limits in download_and_parse_resource
- tests: test user-agent


## 0.2.18 (2026-03-03)

- docs: update README with IBM Bob server type from 'http' to 'streamable-http'
- chore: remove unused import in list_dataset_resources
- clean: remove non-IDE-agnostic skills
- docs: add kiro IDE instructions
- docs: add Mistral instructions to README
- docs: fix minor issue in ordering
- docs: fix minor issue in ordering in README
- docs: fix minor ordering issue in README
- docs: fix minor README indentation typo
- docs: fix typo
- docs: improve contributing guidelines in README
- docs: improve README
- docs: minor README indentation fix
- docs: reorder env vars to keep LOG_LEVEL last
- docs: update README.md
- docs: enhance README with image cover
- feat: add LOG_LEVEL support in main logging config
- feat(monitoring): add Sentry error and performance tracking
- fix: address review feedback for LOG_LEVEL
- fix: align docker-compose env with DATAGOUV_ENV
- fix: enable stateless HTTP to fix "Session not found" for most MCP clients
- fix: normalize env var name
- fix: normalize env var names
- fix: Remove 'transport' field for the Gemini CLI configuration
- fix: safer default for MCP_ENV
- fix: use /health for docker compose healthcheck
- fix: validate filter and sort options in query_resource_data
- perf: remove N+1 calls in list_dataset_resources
- perf: use bytearray buffering in resource downloader
- refactor: rename DATAGOUV_ENV to DATAGOUV_API_ENV
- docs: update README with HuggingChat server setup instructions
- docs: update README with IBM Bob MCP configuration details
## 0.2.17 (2026-02-26)

- docs: reformat ChatGPT section
- docs: update README
- feat: add matomo tracking
- fix: fix matomo tracking


## 0.2.16 (2026-02-23)

- chore: update dependency for security
- docs: improve README for contributing section
- feat: add type checking


## 0.2.15 (2026-02-23)

- docs: add disambiguation about dataservices
- docs: update README
- feat: add 3 dataservices tools


## 0.2.14 (2026-01-27)

- fix: upgrade dependencies to fix security issue related to python-multipart


## 0.2.13 (2026-01-23)

- feat: query_resource_data and download_and_parse_data now returns everything as requested by the LLM
- feat(query_resource_data): add filtering and sorting parameters


## 0.2.12 (2026-01-23)

- docs: update Cursor .md docs
- feat: add allowed_origins and MCP_HOST local var to comply with official MCP specs
- feat: upgrade mcp to 1.25 with DNS rebinding protection config
- Revise ChatGPT connection instructions in README


## 0.2.11 (2026-01-13)

- docs: streamline tool docstrings for better LLM efficiency
- fix: add page_size argument for query_resource_data tool with 20 as a default, so that the LLM can preview the resource


## 0.2.10 (2026-01-13)

- chore: revert mcp to 1.22 and update other dependencies
- Revert "fix(server): allow all hosts to prevent 421 Invalid Host header errors"


## 0.2.9 (2026-01-12)

- fix: adapt to new headers in tabular-api which fix tests
- fix: fix issue [#2](https://github.com/datagouv/datagouv-mcp/pull/2): use tabular-api anyway when it's a resource exception
- fix(server): allow all hosts to prevent 421 Invalid Host header errors


## 0.2.8 (2026-01-07)

- chore: fix tag_version.sh for trailing slashes in CHANGELOG
- docs: add Mistral Vibe CLI in README
- docs: update README
- feat: add version in health check


## 0.2.7 (2025-12-09)

- build: use Python 3.14 instead of 3.13 in docker container
- chore: remove wrong logs for tag_version.sh
- chore: update dependencies
- chore: use [dependency-groups] for dev dependencies
- docs: clarify dataset search stop-word handling
- docs: improve README
- docs: improve README
- docs: update README
- feat: search_datasets cleans query and removes stop words before querying API
- fix: fix tag_version.sh for MacOS


## 0.2.6 (2025-12-04)

- fix: fix tag_version.sh to work with MacOS
- docs: improve docstrings

- refactor!: add page parameter and remove limit from query_resource_data
  Add page parameter to enable pagination through large datasets. Remove
  limit parameter and always use maximum page size (200 rows) for better
  efficiency. This simplifies the API and reduces the number of calls
  needed to explore datasets.

  BREAKING CHANGE: limit parameter removed, page parameter added.
  Always returns up to 200 rows per page.

- **refactor!: rename query_dataset_data to query_resource_data, require resource_id
  Rename query_dataset_data to query_resource_data and change parameter
  from dataset_id to resource_id. This enforces a clearer workflow where
  the LLM must explicitly:
  1. Use search_datasets to find datasets
  2. Use list_dataset_resources to explore available resources
  3. Use query_resource_data with a specific resource_id

  This improves separation of concerns and forces better decision-making
  by the LLM when selecting which resource to query.

  BREAKING CHANGE: query_dataset_data renamed to query_resource_data.
  Parameter changed from dataset_id to resource_id. Use list_dataset_resources
  first to find resource IDs.

- refactor!: remove dataset_query parameter from query_dataset_data
  Remove the dataset_query parameter to enforce a two-step workflow:
  1. Use search_datasets to find and compare datasets
  2. Use query_dataset_data with the chosen dataset_id

  This improves separation of concerns and gives LLMs better control
  over dataset selection by allowing them to compare multiple options
  before querying data.

  BREAKING CHANGE: dataset_query parameter removed. dataset_id is now
  required. Use search_datasets tool first to find the appropriate
  dataset ID.

- docs: add doc for AnythingLLM
- docs: update README.md

## 0.2.5 (2025-12-01)

- build: fix optional dependencies
- chore: update packages
- ci: use CircleCI instead of GitHub Actions
- docs: add LICENSE
- docs: update LLM docs
- docs: update README
- docs: update README
- feat: add /health health check endpoint


## 0.2.4 (2025-11-27)

- chore: stop tracking .python-version file
- chore: update dependencies
- clean: use absolute imports
- docs: add docs for Claude code
- docs: minor README improvements
- docs: update README
- fix: fix docker-compose.yaml file for default DATAGOUV_API_ENV
- fix: fix get_metrics get_env logic
- refactor: merge branch related to refactor into separate files for each mcp tool
- refactor: one single logegr instance for the whole codebase
- refactor: replace aiohttp with httpx, which supports HTTP/2 and simplifies the code
- refactor: simplify get_env logic


## 0.2.3 (2025-11-26)

- docs: fix README to add "get_metrics in tools list
- feat: add automatic CSV delimiter detection


## 0.2.2 (2025-11-26)

- docs: update README
- feat: add "get_metrics" MCP tool
- feat: add metrics api client
- feat: default DATAGOUV_API_ENV to prod and update README
- refactor: refactor API clients to share a common env_config


## 0.2.1 (2025-11-26)

- docs: improve docs
- feat: remove edition tool "create_dataset" which needs API key auth
- Revert "ci: separate CI into parallel jobs"
- feat: default DATAGOUV_API_ENV to prod and update README


## 0.2.0 (2025-11-25)

- build: add a Dockerfile and docker compose file
- chore: add logs to tabular_api_client
- ci: add CI file
- ci: separate CI into parallel jobs
- docs: add CHANGELOG
- docs: fix docs for tests
- docs: fix README
- docs: update README
- docs: update README and add tag_version.sh
- feat: add logging configuration
- feat: add MCP tools "get_dataset_info", "list_dataset_resources", "get_resource_info" and "download_and_parse_resource"


## 0.1.0 (2025-11-25)

Initial commit
