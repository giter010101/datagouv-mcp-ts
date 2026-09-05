# Documentation Standards

## Principle

Docs in the repo are the **source of truth**. If it's not in the repo, the agent doesn't know it.

## Where to write what

| Content | Location |
|---------|----------|
| Agent entry point | `.agent/AGENTS.md` (short map only) |
| How-to checklists | `.agent/skills/` |
| Standards & rules | `.agent/rules/` |
| Active design work | `.agent/exec-plans/active/<name>.md` |
| Completed plans | `.agent/exec-plans/completed/<name>.md` |
| Architecture decisions | `.agent/decisions/NNNN-<title>.md` |
| Tech debt | `.agent/tech-debt/<id>.md` |
| Session logs | `.agent/journal/YYYY-MM-DD-<agent>-<topic>.md` |
| Research findings | `.agent/research/NN-<topic>.md` |
| User-facing docs | `docs/` (README, API reference, deployment) |
| Tool descriptions | In-code `description` field (written for LLMs) |
| Proof of function | `docs/evidence/<tool>-<date>.md` (generated) |
| Generated artifacts | `docs/generated/` (schema dumps, OpenAPI) |

## ADR format

See `.agent/decisions/README.md`. One file per decision; numbered sequentially.

## When to update docs

- **New tool**: description in code + evidence report + exec-plan milestone.
- **API change**: update client docs + contract test fixtures.
- **Architecture change**: write ADR before implementing.
- **Behavior change**: update relevant skill or rule.

## Style

- English for all `.agent/` and `docs/` content.
- Terse, high signal. Agents have limited context.
- Use tables and bullet lists over prose.
- Link between docs; avoid duplication — reference, don't repeat.

## Doc gardening

- Mark stale sections with `> **STALE**` and date.
- Orchestrator runs periodic review; agents fix stale docs in same PR as code changes.
