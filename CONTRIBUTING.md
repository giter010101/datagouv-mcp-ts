# Contributing

Thanks for helping make data.gouv.fr easier to use from AI assistants. This project is developed
largely by autonomous agents following the harness described in [`.agent/AGENTS.md`](.agent/AGENTS.md);
humans and agents follow the same rules.

## Ground rules

- **Human review and accountability.** Issues and pull requests must not be raw, unreviewed AI output.
  You must have read, fully understood and (for code) tested what you submit. By opening an issue or a
  PR you certify you could explain and defend it in review without relying on an AI assistant.
- **One feature = one PR.** Small, focused changes; follow-up PRs over long review threads.
- **Conventional Commits** for commit messages and PR titles: `feat(tools): add preview_resource`,
  `fix(clients): handle empty search page`, `docs: …`, `test: …`, `chore: …`, `ci: …`, `build: …`.
  Breaking changes use `!` (`feat(tools)!: …`) and a `BREAKING CHANGE:` footer.
- **Read-only server.** No tool may write to data.gouv.fr or require credentials.
- **Legacy compatibility.** Tool names, parameters, defaults and messages of the 10 legacy tools are frozen
  ([ADR 0007](.agent/decisions/0007-tool-naming-and-compat.md)); parameters may be added, never removed.

## Workflow

1. Open an issue (bug or feature form) unless the change is trivial.
2. Fork/branch from `main` (`cursor/<topic>` for agent branches).
3. Read `.agent/AGENTS.md`, `.agent/ownership.md` and the relevant ADRs / exec plan before touching code;
   respect the layering `core ← clients ← formats ← tools ← server`.
4. Implement with tests. Offline tests only in `pnpm test`; live calls go to `tests/live/`.
5. For a new or changed tool: e2e test + evidence report (`pnpm evidence --tool <name> …`) + `docs/tools.md`
   regenerated (`pnpm docs:tools`) + README catalogue row.
6. `pnpm check` must be green (typecheck, Biome lint/format, layering, tests, build).
7. User-facing change → `pnpm changeset` + a bullet under `CHANGELOG.md` `[Unreleased]`.
8. Open the PR with the template filled in. CI (`ci.yml`) must pass; a maintainer reviews and merges.
   Merged changes reach [preprod](https://mcp.preprod.data.gouv.fr/) before production.

Developer guide (scripts, layout, conventions, adding a tool, releasing): [docs/development.md](docs/development.md).

## Code style

Enforced by Biome (`pnpm lint`, `pnpm format`) and `tsc --strict`: ESM, no default exports, no `any`,
`import type`, kebab-case files ≤ ~300 lines, zod 4 at every boundary, pino logger on stderr (never
`console.log`). `.editorconfig` covers indentation and line endings for other editors.

## Documentation

Docs are the source of truth: update `README.md`, `docs/` and the relevant `.agent/` file in the same
PR as the behaviour change. English everywhere (a short French intro lives in the README).

## Security

See [SECURITY.md](SECURITY.md). Do not open public issues for vulnerabilities.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
