# Skill: Release Process

> **Placeholder** — to be filled when CI/CD pipeline is set up.

## Planned workflow

1. Changesets: `pnpm changeset` for each user-facing change
2. Version bump: `pnpm changeset version`
3. Build: `pnpm build`
4. Test: `pnpm test` + conformance + live smoke (pre-release)
5. Docker: multi-stage build, push to registry
6. Tag: `v<semver>` on merge to main
7. Deploy: update `mcp.data.gouv.fr` (orchestrator/human step)

## Tools

- `@changesets/cli` for versioning
- GitHub Actions for CI/CD
- Docker multi-stage (`node:22-alpine`)

## TODO

- [ ] Set up changesets config
- [ ] Create release GitHub Action workflow
- [ ] Document rollback procedure
- [ ] Document Docker tagging strategy
