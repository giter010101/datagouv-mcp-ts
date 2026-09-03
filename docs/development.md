# Development

## Prerequisites

- Node.js ≥ 22 (`.nvmrc` → 22; CI also runs 24). `corepack enable` gives you the pinned pnpm
  (`package.json#packageManager`, pnpm 10).
- No Python, no Docker needed for the default workflow. Docker is only used to build the image.

```shell
git clone https://github.com/giter010101/datagouv-mcp-ts.git && cd datagouv-mcp-ts
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env    # optional; every variable has a default
```

## Scripts

| Script | What it does |
|--------|--------------|
| `pnpm dev` | stdio server with hot reload (`tsx watch src/index.ts`) |
| `pnpm dev:http` | Streamable HTTP on `http://127.0.0.1:8000/mcp` with hot reload |
| `pnpm build` | Bundle to `dist/index.js` (tsdown, ESM, shebang; deps stay external) |
| `pnpm typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) |
| `pnpm lint` / `pnpm format` | Biome check / write |
| `pnpm check:layers` | Layer import rules (`core ← clients ← formats ← tools ← server`) |
| `pnpm test` / `pnpm test:watch` | Offline vitest suite (unit + contract + e2e + layering), ~1 s |
| `pnpm test:coverage` | Same with v8 coverage (`coverage/lcov`) |
| `pnpm test:live` | Live smoke tests against data.gouv.fr (`RUN_LIVE_TESTS=1`, `tests/live/**`) |
| `pnpm evidence --tool <name> --input '<json>' [--stdio]` | Executes a tool for real and writes `docs/evidence/<tool>-<date>.md` (+ raw JSON, git-ignored) |
| `pnpm check` | `typecheck && lint && check:layers && test && build` — must be green before every commit |
| `pnpm changeset` / `pnpm version-packages` / `pnpm release` | Release tooling (see [Releasing](#releasing)) |

## Repository layout

```
src/            server code — see docs/architecture.md for the module map
tests/
├── unit/       cross-module unit tests (plus src/**/*.test.ts next to the code)
├── contract/   client tests replaying recorded fixtures
├── e2e/        MCP-level tests: SDK Client over InMemoryTransport and over HTTP loopback
├── live/       *.live.test.ts, network, gated by RUN_LIVE_TESTS=1
├── fixtures/   recorded API payloads (<service>/*.json) and sample files (files/)
└── helpers/    startTestServer, routedFetch, fakes
scripts/        check-layers.ts · evidence.ts · record-fixtures.ts
docs/           this documentation · evidence/ (generated reports)
.agent/         agent harness: AGENTS.md map, rules, skills, exec plans, ADRs, tech debt, journal
.changeset/     pending changesets + config (pre-release mode)
legacy/python/  frozen Python server, deleted at tool parity
```

## Conventions

- TypeScript strict, ESM only, `.js` extensions in relative imports, no default exports, no `any`.
- Files ≤ ~300 lines, one primary export, kebab-case filenames.
- Validation with zod 4 at every boundary: config, upstream payloads (`z.looseObject`), tool inputs
  (raw shapes with `.describe()` on every field — the LLM reads them).
- Errors: throw `DatagouvError` subclasses (`src/core/errors.ts`); never let raw errors reach the transport.
- Logging: `childLogger("module")`, JSON on stderr; never `console.log` (stdout is the stdio protocol).
- Tool handlers receive dependencies through `ToolContext.deps` and never call `fetch`.
- Commits: Conventional Commits (`feat(tools): …`, `fix(clients): …`, `docs: …`), one logical change each.
- Docs are source of truth: update `README.md`/`docs/` in the same PR as the behaviour change.

## Testing

Offline by default: fixtures under `tests/fixtures/` are injected through `fetchImpl`
(`createDeps(config, { fetchImpl: routedFetch(...) })`) or undici `MockAgent`; MCP e2e tests use
`startTestServer()` from `tests/helpers/mcp-client.ts`. `LOG_LEVEL=silent` in vitest; set
`LOG_LEVEL=debug pnpm test` to see server logs.

```shell
pnpm test                                     # everything offline
pnpm test tests/e2e                           # one folder
pnpm test:live                                # real API (slow, may flake with upstream)
DATAGOUV_API_ENV=demo pnpm test:live          # against demo.data.gouv.fr
pnpm tsx scripts/record-fixtures.ts           # re-record fixtures from live IDs (note it in CHANGELOG)
```

Coverage targets ([ADR 0010](../.agent/decisions/0010-testing-and-evidence-strategy.md)):
`core`/`clients`/`formats` ≥ 90 % lines; 100 % of tools have an e2e test (happy path, 404, upstream 5xx)
and an evidence report.

### Evidence reports

Every new or changed tool needs a proof-of-function report generated from a **real** execution:

```shell
pnpm build
EVIDENCE_AGENT=<you> pnpm evidence --tool search_datasets --input '{"query":"population","page_size":3}' --stdio
# → docs/evidence/search_datasets-2026-09-03.md (+ docs/evidence/raw/*.json, git-ignored)
```

`--stdio` runs the built `dist/index.js` through a real stdio client; without it the tool runs in-process.
The nightly workflow regenerates evidence and uploads `docs/evidence/` as an artefact.

### Interactive testing

```shell
pnpm build
npx @modelcontextprotocol/inspector node dist/index.js            # stdio
pnpm dev:http & npx @modelcontextprotocol/inspector --http-url http://127.0.0.1:8000/mcp
```

## Adding a tool

Checklist (details: `.agent/skills/mcp-tool-authoring.md`):

1. `src/tools/<tool-name>.ts` — `defineTool({ name, title, description, inputSchema, annotations: READ_ONLY_TOOL, handler })`.
   Name follows `<verb>_<object>[_<qualifier>]`; legacy names are frozen ([ADR 0007](../.agent/decisions/0007-tool-naming-and-compat.md)).
2. Handler: call `ctx.deps.*` only; return `{ text, structured, howToGetMore }`; paginate; keep text well under `MAX_OUTPUT_CHARS`.
3. Append to `ALL_TOOLS` in `src/tools/index.ts` (after the legacy tools).
4. `tests/e2e/<tool-name>.test.ts`: happy path, 404, upstream 5xx, invalid input.
5. Evidence report; add the tool to the catalogue in `README.md` and to `docs/tools.md`.
6. `pnpm changeset` (minor) + a bullet under `CHANGELOG.md` → `[Unreleased]` → `Added`.

## Continuous integration

| Workflow | Trigger | Does |
|----------|---------|------|
| `ci.yml` | push, PR | Node 22 + 24 matrix: `pnpm install --frozen-lockfile`, typecheck, lint, layers, `test:coverage`, build, bundle smoke; coverage + dist artefacts; Docker build and `/health` probe |
| `nightly-live.yml` | cron 03:17 UTC, manual | `pnpm test:live` + evidence reports (artefact); opens/updates/closes the "Nightly live tests failing" issue |
| `docker.yml` | tags `v*`, push to main | Multi-arch image to GHCR with SBOM and provenance; `/health` smoke |
| `release.yml` | push to main | Changesets version PR; on merge publishes to npm with provenance (needs `NPM_TOKEN`), tags, GitHub release |
| `contribution-reminder.yml` | new issue/PR from non-collaborators | Posts the AI-content policy reminder |

Dependabot (`.github/dependabot.yml`) updates npm, Actions and the Docker base weekly.

## Releasing

Versioning is driven by [changesets](https://github.com/changesets/changesets); the package is in
**alpha pre-release mode** (`.changeset/pre.json`) until `1.0.0`.

1. With your change: `pnpm changeset` → choose `patch`/`minor`/`major`, write a user-facing summary;
   commit the `.changeset/*.md` file. Add a bullet under `CHANGELOG.md` `[Unreleased]`.
2. On merge to `main`, `release.yml` opens/refreshes the PR **chore(release): version packages**
   (`pnpm version-packages` bumps `package.json` to e.g. `1.0.0-alpha.2` and writes the CHANGELOG section).
3. Curate that PR: fold the `[Unreleased]` bullets into the new version section (Added/Changed/Removed/Fixed).
4. Merge it: the workflow runs `pnpm check`, `pnpm release` (`build` + `changeset publish --provenance`),
   creates the `v<version>` tag and GitHub release; `docker.yml` publishes the image.
5. Leaving alpha: `pnpm changeset pre exit`, commit, merge → next version PR is `1.0.0`.

Manual fallback, tagging strategy, rollback: `.agent/skills/release.md`.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `421 Invalid Host header` | Hostname not in `MCP_ALLOWED_HOSTS` — add it (the variable replaces the default list). |
| `403 Origin not allowed` | Browser client with an `Origin` outside `MCP_ALLOWED_ORIGINS`; add it or set `*`. |
| Client shows the server but no tools (stdio) | Something wrote to stdout. Use the logger (stderr), never `console.log`. |
| `CONFIG_ERROR: Invalid configuration` | One of the env vars is out of range; the message lists each issue. |
| tsdown prints "Node.js v22.14.0 is deprecated" | Cosmetic; tsdown 0.21 is pinned for Node 22.14 (TD-003). |
| Live tests fail, offline tests pass | Upstream shape changed — re-record fixtures and update the Zod schema. |
