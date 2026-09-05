# Legacy Python implementation (reference only)

This directory contains the original Python MCP server (`datagouv-mcp` 0.2.x, FastMCP + Uvicorn),
moved here unchanged when the TypeScript rewrite started (see `.agent/decisions/0001-package-at-root-legacy-move.md`).

- It is kept **as a behavioural reference** until the TypeScript server reaches full tool parity
  (see `.agent/exec-plans/001-typescript-rewrite.md`, milestone M3).
- It is **not built, tested or released** from this repository anymore. CircleCI config, Dockerfile and
  `docker-compose.yml` here are historical.
- The audit of this implementation lives in `.agent/research/01-existing-python-mcp-audit.md`.

To run it locally (unsupported):

```bash
cd legacy/python
uv sync && uv run main.py
```

This directory will be deleted once parity is reached and documented.
