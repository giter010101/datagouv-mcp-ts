# Skill: Writing Evidence Reports

Proof-of-function reports demonstrate that a tool works against real (or fixture-replayed) data.

## When required

- Every new MCP tool
- Every changed tool behavior
- Before marking exec-plan milestone as done

## How to generate

```bash
# Automated (preferred)
pnpm evidence --tool <tool_name> --input '<json>'

# Manual template: see rules/testing-and-evidence.md
```

## Report structure

File: `docs/evidence/<tool-name>-<YYYY-MM-DD>.md`

1. **Header**: tool name, date, agent, PASS/FAIL status
2. **Input**: exact JSON parameters used
3. **Output**: truncated response (first ~50 lines)
4. **Assertions**: checklist of what was verified
5. **Full output link**: pointer to `docs/evidence/raw/`

## Assertion guidelines

- Verify response shape (required fields present)
- Verify data plausibility (non-empty for known queries)
- Verify truncation applied when output exceeds limit
- Verify error handling with invalid input (separate report or section)
- Verify pagination metadata when applicable

## Raw output storage

- Full JSON: `docs/evidence/raw/<tool-name>-<date>.json`
- Add `docs/evidence/raw/` to `.gitignore` if files are large (> 100KB)
- Keep truncated evidence in git for PR review

## PR checklist

- [ ] Evidence report committed
- [ ] Status is PASS
- [ ] Path referenced in PR description
- [ ] Re-generated if tool changed since last report
