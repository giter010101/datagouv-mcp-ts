# Exec Plans

Living design documents for active workstreams. First-class artifacts — not optional.

## Lifecycle

1. Copy `TEMPLATE.md` → `active/<name>.md`
2. Set status to `active`, assign owner
3. Work against milestones; log progress
4. When done: move to `completed/`, set status to `done`

## When to create

- Any multi-step feature (new tool, client, format parser)
- Cross-cutting changes (auth, caching, transport migration)
- Not needed for single-file typo fixes

## Rules

- One exec plan per workstream
- Update progress log after each session
- Decisions made during work → log in plan or write ADR
- Open questions → escalate to orchestrator, don't guess

## Directory

```
exec-plans/
├── README.md                    # this file
├── TEMPLATE.md                  # copy to start
├── 001-typescript-rewrite.md    # MASTER plan (architecture, tools, milestones, workstreams A–E)
├── active/                      # one plan per workstream (e.g. active/ws-a-clients.md)
└── completed/                   # finished plans (archive)
```

Workstream plans in `active/` reference the master plan's milestone they implement and must not
redefine architecture decided in `001-typescript-rewrite.md` / `decisions/` (propose an ADR instead).
