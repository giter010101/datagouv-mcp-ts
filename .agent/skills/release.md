# Skill: Release Process

Owner: workstream E. Tooling: `@changesets/cli` (pre-release mode `alpha` until 1.0.0),
GitHub Actions `release.yml` + `docker.yml`. User-facing doc: `docs/development.md#releasing`.

## Every user-facing change (dev agents)

1. Implement + tests + evidence (`rules/testing-and-evidence.md`).
2. `pnpm changeset` → pick `patch` | `minor` | `major`, write a one-paragraph summary for users
   (what changed, migration note if any). Commit the generated `.changeset/<name>.md` with the code.
   Docs/CI-only changes: no changeset.
3. Append a bullet under `CHANGELOG.md` → `[Unreleased]` → `Added` / `Changed` / `Removed` / `Fixed`.
   Re-read the file right before editing (other agents append concurrently); never rewrite other bullets.

## Cutting a version (release agent / maintainer)

Automated by `.github/workflows/release.yml` on every push to `main`:

| Step | What happens |
|------|--------------|
| Version PR | `changesets/action` runs `pnpm version-packages` (= `changeset version`): bumps `package.json`, prepends a `## <version>` section to `CHANGELOG.md` from the pending changesets, deletes them, opens/refreshes PR **"chore(release): version packages"**. |
| Curate | On that PR: move the `[Unreleased]` bullets into the new `## <version>` section (keep the Added/Changed/Removed/Fixed grouping), leave `[Unreleased]` with empty groups, set the date. Run `pnpm check`. |
| Publish | Merging the PR re-runs the workflow: `pnpm check` → `pnpm release` (= `pnpm build && changeset publish`) publishes to npm **with provenance** (`NPM_CONFIG_PROVENANCE=true`, `id-token: write`), creates tag `v<version>` and a GitHub release whose body is the CHANGELOG section. Publishing is skipped (version PR only) when the `NPM_TOKEN` secret is absent. |
| Image | The `v*` tag triggers `docker.yml`: multi-arch image pushed to `ghcr.io/<owner>/datagouv-mcp:<version>` (+ `latest` for stable, `edge` for main), SBOM + provenance attestation, `/health` smoke. |
| Deploy | `mcp.data.gouv.fr` / preprod pull the new tag (human/ops step; see `docs/deployment.md`). |

Manual fallback (no Actions): `pnpm version-packages && git commit -am "chore(release): version packages"`, then
`pnpm release` with `NODE_AUTH_TOKEN` set, `git tag v$(node -p "require('./package.json').version") && git push --tags`.

## Pre-release mode

- `.changeset/pre.json` = `{ "mode": "pre", "tag": "alpha" }` → versions are `1.0.0-alpha.N`, npm dist-tag `alpha`
  (`npx datagouv-mcp@alpha`). `latest` is not moved.
- Promote to `1.0.0`: `pnpm changeset pre exit`, commit `.changeset/pre.json`, merge; next version PR produces `1.0.0`.
- Beta phase if needed: `pnpm changeset pre enter beta`.

## Docker tagging strategy

| Git ref | Image tags |
|---------|------------|
| `v1.2.3` | `1.2.3`, `1.2`, `1`, `latest`, `sha-<short>` |
| `v1.0.0-alpha.1` | `1.0.0-alpha.1`, `sha-<short>` (no `latest`, no floating major/minor) |
| `main` push | `edge`, `sha-<short>` |

## Rollback

- **npm**: `npm deprecate datagouv-mcp@<bad> "use <good>"`; if within 72 h and no dependents, `npm unpublish datagouv-mcp@<bad>`.
  Move the dist-tag back: `npm dist-tag add datagouv-mcp@<good> latest` (or `alpha`).
- **Docker**: redeploy the previous immutable tag (`ghcr.io/<owner>/datagouv-mcp:<good>`); never re-push an existing semver tag.
- **Git**: never delete a published tag; ship a `fix:` changeset and a new patch version instead.
- Record the incident and cause in `CHANGELOG.md` (`Fixed`) and in a journal entry.

## Checklist before merging the version PR

- [ ] `pnpm check` green on the PR and CI green on `main`
- [ ] `[Unreleased]` folded into the version section; groups Added/Changed/Removed/Fixed; date set
- [ ] Evidence reports exist for every registered tool (`docs/evidence/`), nightly live green
- [ ] `README.md` tool catalogue and `docs/tools.md` match `src/tools/index.ts` (`ALL_TOOLS`)
- [ ] `docs/configuration.md` matches `src/core/config.ts`
- [ ] For `1.0.0`: `legacy/python/` deleted (TD-004), `pre.json` exited
