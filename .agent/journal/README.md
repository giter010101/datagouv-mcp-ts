# Journal

Per-session progress logs. One file per significant agent session.

## Format

Filename: `YYYY-MM-DD-<agent-name>-<topic>.md`

```markdown
# Session: <topic>

**Date**: YYYY-MM-DD
**Agent**: <agent-name>
**Duration**: ~Xh
**Branch**: cursor/<name>-57e0

## What was done

- Bullet list of completed work

## Files touched

- `path/to/file.ts` — created/modified
- `path/to/test.ts` — added tests

## Decisions

- Chose X because Y (or: see ADR NNNN)

## Blockers

- None / description

## Next steps

- [ ] Task for next session
- [ ] Task for another agent
```

## Rules

- Write a journal entry when finishing a session with meaningful progress.
- Keep entries terse; link to exec-plans and ADRs for detail.
- Orchestrator reads recent journals to coordinate agents.
