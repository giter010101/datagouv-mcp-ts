import { type ServerType, serve } from "@hono/node-server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono, type MiddlewareHandler } from "hono";
import { childLogger } from "../core/logger.js";
import { APP_VERSION } from "../core/version.js";
import type { ServerDeps } from "./deps.js";
import { createMcpServer } from "./mcp-server.js";

const HEALTH_PROBE_TIMEOUT_MS = 10_000;

export interface HealthBody {
  status: "ok" | "mcp_unavailable";
  uptime_since?: string;
  version?: string;
  env?: string;
  data_env?: string;
}

/**
 * DNS-rebinding protection: reject unexpected Host values and, when an Origin
 * header is present (browser-based clients), unexpected origins. Ports are ignored
 * so `localhost:*` works like the legacy configuration.
 */
export function hostOriginGuard(
  allowedHosts: string[],
  allowedOrigins: string[],
): MiddlewareHandler {
  const hosts = new Set(allowedHosts.map((h) => h.toLowerCase()));
  const originsWildcard = allowedOrigins.includes("*");
  const origins = new Set(allowedOrigins.map((o) => o.toLowerCase()));
  return async (c, next) => {
    const host = hostnameOf(c.req.header("host"));
    if (host !== undefined && hosts.size > 0 && !hosts.has(host)) {
      return c.json({ error: "Invalid Host header" }, 421);
    }
    const origin = c.req.header("origin");
    if (origin !== undefined && !originsWildcard) {
      const normalised = originWithoutPort(origin);
      if (normalised === undefined || !origins.has(normalised)) {
        return c.json({ error: "Origin not allowed" }, 403);
      }
    }
    await next();
  };
}

function hostnameOf(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined;
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase().replace(/^\[(.*)\]$/, "[$1]");
  } catch {
    return hostHeader.toLowerCase();
  }
}

function originWithoutPort(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname}`.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Streamable HTTP app: `POST /mcp` (stateless, JSON responses — matches the
 * legacy `stateless_http=True` deployment) and `GET /health` (deep probe that
 * runs a real dataset search in-process, like the legacy server).
 */
export function createHttpApp(deps: ServerDeps): Hono {
  const log = childLogger("http-server");
  const startedAt = new Date().toISOString();
  const app = new Hono();

  app.use("*", hostOriginGuard(deps.config.allowedHosts, deps.config.allowedOrigins));

  app.get("/health", async (c) => {
    const healthy = await probeHealth(deps);
    if (!healthy) {
      return c.json<HealthBody>({ status: "mcp_unavailable" }, 503);
    }
    return c.json<HealthBody>({
      status: "ok",
      uptime_since: startedAt,
      version: APP_VERSION,
      env: deps.config.mcpEnv,
      data_env: deps.config.datagouvApiEnv,
    });
  });

  app.all("/mcp", async (c) => {
    const server = createMcpServer(deps);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } catch (error) {
      log.error({ err: error }, "mcp request failed");
      return c.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
        500,
      );
    } finally {
      // Stateless mode: nothing outlives the request (JSON mode = body already produced).
      void server.close().catch(() => undefined);
    }
  });

  app.notFound((c) => c.json({ error: "Not found", endpoints: ["/mcp", "/health"] }, 404));
  return app;
}

async function probeHealth(deps: ServerDeps): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), HEALTH_PROBE_TIMEOUT_MS);
  });
  try {
    const probe = deps.datagouv
      .searchDatasets({ query: "transport", pageSize: 1 })
      .then((result) => result.items.length > 0)
      .catch(() => false);
    return await Promise.race([probe, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RunningHttpServer {
  server: ServerType;
  port: number;
  close: () => Promise<void>;
}

export function runHttp(
  deps: ServerDeps,
  port = deps.config.port,
  host = deps.config.host,
): Promise<RunningHttpServer> {
  const log = childLogger("http-server");
  const app = createHttpApp(deps);
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
      log.info(
        {
          host: info.address,
          port: info.port,
          version: APP_VERSION,
          dataEnv: deps.config.datagouvApiEnv,
        },
        "streamable http transport ready on /mcp (health on /health)",
      );
      resolve({
        server,
        port: info.port,
        close: () =>
          new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

export { HEALTH_PROBE_TIMEOUT_MS };
