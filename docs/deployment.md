# Deployment

How to run `datagouv-mcp` as a shared Streamable HTTP endpoint. For local IDE use prefer stdio
(`npx -y datagouv-mcp`, see the [README](../README.md#connect-your-client)).

## Endpoints

| Method / path | Purpose |
|---------------|---------|
| `POST /mcp` | MCP Streamable HTTP, **stateless** (a fresh server per request, JSON responses). `Accept: application/json, text/event-stream` as sent by every MCP client. |
| `GET /health` | Deep probe: runs `search_datasets("transport", page_size 1)` in-process (no recursive HTTP), 10 s cap. `200 {"status":"ok","uptime_since":"<ISO>","version":"<semver>","env":"<MCP_ENV>","data_env":"prod|demo"}` or `503 {"status":"mcp_unavailable"}`. |
| anything else | `404 {"error":"Not found","endpoints":["/mcp","/health"]}` |

No SSE endpoint, no `GET /mcp` stream, no authentication (read-only public data).

## Docker (recommended)

Image: multi-stage `node:22-slim`, production `node_modules` only, runs as the unprivileged `node`
user, `ENV MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=8000`, `HEALTHCHECK` every 60 s on `/health`.

```shell
# published image (GHCR): <version>, <major>.<minor>, latest (stable), edge (main), sha-<commit>
docker run -d --name datagouv-mcp --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  -e MCP_ENV=prod -e MCP_ALLOWED_HOSTS=mcp.example.org,localhost,127.0.0.1 \
  ghcr.io/giter010101/datagouv-mcp:latest

# build locally
docker build -t datagouv-mcp .
docker run --rm -p 8000:8000 datagouv-mcp
curl -fsS http://127.0.0.1:8000/health
```

Pre-releases (`1.0.0-alpha.N`) are tagged with their exact version only, never `latest`.

### docker compose

[`docker-compose.yml`](../docker-compose.yml) builds the image and passes every variable of
[configuration.md](configuration.md) through with defaults, binds to `127.0.0.1` on the host
(`MCP_BIND_ADDRESS=0.0.0.0` to expose), runs read-only with `no-new-privileges`, and declares the
same health check.

```shell
docker compose up -d
MCP_PORT=8007 DATAGOUV_API_ENV=demo LOG_LEVEL=debug docker compose up -d
docker compose logs -f
docker compose ps           # State should read "healthy" after ~15 s
docker compose down
```

Put overrides in a `.env` file next to the compose file (compose reads it automatically; never commit it).

## Node.js (no container)

```shell
npm i -g datagouv-mcp                # or pnpm add -g / npx -y datagouv-mcp --http
MCP_TRANSPORT=http MCP_HOST=0.0.0.0 MCP_PORT=8000 MCP_ENV=prod datagouv-mcp
```

systemd unit sketch:

```ini
[Service]
ExecStart=/usr/bin/env datagouv-mcp --http --host 127.0.0.1 --port 8000
Environment=MCP_ENV=prod LOG_LEVEL=info MCP_ALLOWED_HOSTS=mcp.example.org,localhost,127.0.0.1
User=datagouv-mcp
Restart=always
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
```

Logs are JSON on stderr → journald. Pretty-print with `journalctl -u datagouv-mcp -o cat | npx pino-pretty`.

## Reverse proxy

Terminate TLS at the proxy, forward `Host` unchanged (or set `MCP_ALLOWED_HOSTS` to the internal
hostname), forward `X-Forwarded-For` if you use Matomo with `MATOMO_AUTH_TOKEN`. Responses are plain
JSON, so no special buffering/timeout tuning is needed beyond allowing ~30 s for slow upstream queries.

Caddy:

```caddyfile
mcp.example.org {
    reverse_proxy 127.0.0.1:8000
}
```

Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name mcp.example.org;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Traefik labels (compose):

```yaml
labels:
  - traefik.http.routers.datagouv-mcp.rule=Host(`mcp.example.org`)
  - traefik.http.services.datagouv-mcp.loadbalancer.server.port=8000
  - traefik.http.services.datagouv-mcp.loadbalancer.healthcheck.path=/health
```

Then set `MCP_ALLOWED_HOSTS=mcp.example.org,localhost,127.0.0.1` and, if browser-based clients will
call it, `MCP_ALLOWED_ORIGINS=https://mcp.example.org` (or `*`).

## Health, readiness, monitoring

- Liveness/readiness: `GET /health` — 200 only when the whole stack (tools + data.gouv.fr API) answers.
  Because it performs a real upstream call, poll it every 30–60 s, not every second; the probe itself is
  cached-free by design.
- Docker `HEALTHCHECK` and compose `healthcheck` use the same URL; `docker ps` shows `healthy`.
- Structured logs: every tool call emits `tool called` / `tool completed {ms}` / `tool failed {code}`.
- Optional: Matomo tool events (`MATOMO_URL` + `MATOMO_SITE_ID`), Sentry (`SENTRY_DSN`). No Prometheus endpoint in 1.0.

## Security

| Topic | Behaviour |
|-------|-----------|
| Read-only | Every tool has `readOnlyHint: true`; the server never writes to data.gouv.fr and holds no credentials. |
| DNS rebinding | `hostOriginGuard` middleware: `Host` must be in `MCP_ALLOWED_HOSTS` (default: production, preprod, localhost; ports ignored) → otherwise `421`. When a browser sends `Origin`, it must be in `MCP_ALLOWED_ORIGINS` → otherwise `403`. `*` disables the origin check only. |
| Bind address | Default `127.0.0.1`; only Docker sets `0.0.0.0`. Publish the container port on `127.0.0.1` and put a proxy in front. |
| Resource limits | Upstream timeouts (`HTTP_TIMEOUT_MS`), bounded retries, `MAX_DOWNLOAD_BYTES` for file parsing, ≤ 5 concurrent upstream calls per tool, `MAX_OUTPUT_CHARS` per result. File bytes are never cached or written to disk. |
| Container | Non-root `node` user, `read_only` root FS + `tmpfs /tmp`, `no-new-privileges`, no shell entrypoint, minimal `node:22-slim` base; SBOM and provenance attestation published with each image. |
| Rate limiting / auth | Not built in (public read-only data). Add them at the proxy if you expose a shared instance. |
| Supply chain | Exact dependency pins, `pnpm install --frozen-lockfile`, npm publish with provenance, Dependabot weekly. |

Report vulnerabilities per [SECURITY.md](../SECURITY.md).

## Upgrading and rollback

Images are immutable per version tag: deploy `ghcr.io/…/datagouv-mcp:<new>`, check `/health`, and
roll back by redeploying `<previous>`. The server keeps no state (in-memory cache only), so
instances can be replaced or scaled horizontally freely. Release notes: [CHANGELOG.md](../CHANGELOG.md).

## Sizing

Single instance, default settings: ~80–120 MB RSS idle; CPU-light (I/O bound). Memory peaks are bounded
by `MAX_DOWNLOAD_BYTES` × concurrent parsing calls plus the LRU (`CACHE_MAX_ENTRIES` × small JSON).
DuckDB (`ENABLE_DUCKDB=1`) adds ~100 MB and its own working memory.
