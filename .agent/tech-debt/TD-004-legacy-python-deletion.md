# TD-004: Delete `legacy/python/` after tool parity

**Status**: scheduled (milestone M3 → M6)
**Impact**: low
**Created**: 2026-09-03
**Owner**: orchestrator

## Description

The Python server is kept under `legacy/python/` purely as a behavioural reference (ADR 0001). It carries an outdated `uv.lock`, a CircleCI config that no longer runs and a Dockerfile that could be mistaken for the current one.

## Impact

Confusion for newcomers and dependency-scanner noise (Python CVEs against dead code).

## Proposed fix

When all 10 legacy tools have passing evidence reports (`docs/evidence/`), `git rm -r legacy/python`, drop the Python section of `.gitignore`, note it in CHANGELOG. The audit (`research/01`) remains the historical record.
