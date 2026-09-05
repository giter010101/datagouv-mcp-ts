# Git Workflow

## Branches

- Feature branches: `cursor/<descriptive-name>-57e0`
- Base branch: `cursor/datagouv-mcp-typescript-refonte-57e0` (or `main` once merged)
- One workstream per branch; orchestrator coordinates to avoid conflicts.

## Commits

- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`
- One logical change per commit.
- Include CHANGELOG entry for user-facing changes (via changesets).
- Commit message body: what + why (not how).

```
feat(tools): add search_datasets tool with pagination

Implements dataset search against data.gouv.fr API v1.
Includes contract tests and evidence report.
```

## Pull requests

- Title: same as commit subject.
- Description template:

```markdown
## Summary
- What changed and why

## Test plan
- [ ] Unit tests pass
- [ ] Contract tests pass
- [ ] Evidence report attached (for tools)
- [ ] Exec-plan milestone updated

## Related
- Exec plan: `.agent/exec-plans/active/<name>.md`
- ADR: `.agent/decisions/NNNN-<title>.md` (if applicable)
```

## What not to commit

- `.env` files with secrets
- `node_modules/`, `dist/`, `docs/evidence/raw/` (large outputs)
- Generated files that CI can reproduce (unless intentional)

## Merge policy

- Agent self-review + automated CI must pass.
- Human review optional for high-throughput agent workflow.
- Follow-up fixes preferred over long-blocking review threads.
