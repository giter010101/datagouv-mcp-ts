## Summary

<!-- What changed and why (one feature = one PR). Title uses Conventional Commits, e.g. `feat(tools): add preview_resource`. -->

## Test plan

- [ ] `pnpm check` is green locally (typecheck, lint, layers, offline tests, build)
- [ ] New/changed tool has an e2e test (`tests/e2e/`) and an evidence report (`pnpm evidence --tool <name> …` → `docs/evidence/`)
- [ ] User-facing change has a changeset (`pnpm changeset`) — skip for docs/CI-only changes
- [ ] Docs updated (`README.md`, `docs/tools.md`, `docs/configuration.md` when env vars change)

## Related

<!-- Exec plan: `.agent/exec-plans/active/<name>.md` · ADR: `.agent/decisions/NNNN-<title>.md` · Issue: #NNN -->

## AI-generated content

**Raw AI-only pull requests (code you have not personally edited, fully understood, and tested) are not allowed and may be closed without discussion.** By submitting, you state you understand this change and can defend it without an AI. Other rules: [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md).

- [ ] I am not submitting raw, unreviewed AI-generated content. I have reviewed, understand, and stand behind this PR.
