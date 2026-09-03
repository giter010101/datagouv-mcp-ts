# Security policy

## Scope

`datagouv-mcp` is a read-only MCP server: it proxies public, unauthenticated data.gouv.fr APIs and
downloads public files for bounded in-process parsing. It stores no credentials, no user data and
no state beyond an in-memory cache. Relevant risks are therefore: denial of service (unbounded
downloads or outputs), DNS rebinding / cross-origin abuse of a local HTTP instance, prompt-injection
vectors through data returned to the LLM, and supply-chain issues in dependencies or the Docker image.

## Supported versions

| Version | Supported |
|---------|-----------|
| latest `1.x` release (and current `1.0.0-alpha.N`) | yes |
| Python `0.2.x` (`legacy/python/`) | no — frozen reference, not deployed from this repository |

## Reporting a vulnerability

Please **do not open a public issue**. Use one of:

1. GitHub private vulnerability reporting: *Security* tab → *Report a vulnerability* on this repository.
2. The data.gouv.fr team contact: <https://www.data.gouv.fr/support> (mention "MCP server").

Include the version (`datagouv-mcp --version` or the `version` field of `GET /health`), the transport
(stdio / HTTP / Docker), reproduction steps and impact. You should receive an acknowledgement within
5 working days. Fixes ship as a patch release with a `Fixed` entry in `CHANGELOG.md`; we credit
reporters unless they prefer otherwise.

## Hardening built in

- Host/Origin guard on the HTTP transport (`MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`), default bind `127.0.0.1`.
- Upstream timeouts and bounded retries; `MAX_DOWNLOAD_BYTES` for file parsing; `MAX_OUTPUT_CHARS` per result;
  file bytes never written to disk or cached.
- Exact dependency pins, `pnpm install --frozen-lockfile`, weekly Dependabot, npm publish with provenance,
  Docker image as non-root with SBOM and build attestation.

Deployment guidance: [docs/deployment.md#security](docs/deployment.md#security).
