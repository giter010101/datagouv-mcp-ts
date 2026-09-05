import type { Config } from "../core/config.js";
import type { FetchLike } from "../core/http.js";
import { childLogger, type Logger } from "../core/logger.js";
import type { ToolCallEvent } from "../tools/types.js";

/**
 * Optional Matomo + Sentry observers. The tools registry already swallows
 * hook errors; this module also never throws into the tool path.
 */
export interface Telemetry {
  onToolCall(event: ToolCallEvent): void;
  flush(): Promise<void>;
}

export type TelemetryConfig = Pick<Config, "matomo" | "sentry" | "mcpEnv">;

export interface CreateTelemetryOptions {
  fetchImpl?: FetchLike;
  logger?: Logger;
}

const NOOP: Telemetry = {
  onToolCall() {},
  async flush() {},
};

const MATOMO_TIMEOUT_MS = 1_500;

export function createTelemetry(
  config: TelemetryConfig,
  options: CreateTelemetryOptions = {},
): Telemetry {
  const matomo = config.matomo;
  const sentry = config.sentry;
  if (matomo === undefined && sentry === undefined) return NOOP;

  const log = options.logger ?? childLogger("telemetry");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const inflight = new Set<Promise<void>>();

  if (sentry !== undefined) {
    log.info(
      {
        sentryDsnSet: true,
        environment: config.mcpEnv,
        sampleRate: sentry.sampleRate,
      },
      "sentry telemetry enabled (structured logs only; no SDK)",
    );
  }

  const enqueue = (task: Promise<void>): void => {
    const wrapped = task
      .catch((err: unknown) => {
        log.warn({ err }, "telemetry beacon failed");
      })
      .finally(() => {
        inflight.delete(wrapped);
      });
    inflight.add(wrapped);
  };

  return {
    onToolCall(event: ToolCallEvent): void {
      try {
        if (matomo !== undefined) {
          enqueue(postMatomo(fetchImpl, matomo, event));
        }
        if (sentry !== undefined && !event.ok) {
          log.error(
            {
              sentryDsnSet: true,
              environment: config.mcpEnv,
              sampleRate: sentry.sampleRate,
              tool: event.tool,
              errorCode: event.errorCode,
              durationMs: event.durationMs,
              requestId: event.requestId,
            },
            "tool error (sentry)",
          );
        }
      } catch (err) {
        log.warn({ err }, "telemetry onToolCall failed");
      }
    },
    async flush(): Promise<void> {
      await Promise.allSettled([...inflight]);
    },
  };
}

async function postMatomo(
  fetchImpl: FetchLike,
  matomo: NonNullable<Config["matomo"]>,
  event: ToolCallEvent,
): Promise<void> {
  const endpoint = matomoEndpoint(matomo.url);
  const health = event.tool === "health_check";
  const body = new URLSearchParams({
    idsite: matomo.siteId,
    rec: "1",
    ca: "1",
    e_c: health ? "health_check" : "tools",
    e_a: event.tool,
    e_n: event.ok ? "ok" : "err",
    e_v: String(event.durationMs),
    url: "https://localhost/mcp",
    rand: String(Math.floor(Math.random() * 1e16)),
  });
  if (matomo.authToken !== undefined) {
    body.set("token_auth", matomo.authToken);
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(MATOMO_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`matomo HTTP ${response.status}`);
  }
}

function matomoEndpoint(url: string): string {
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.endsWith("matomo.php") ? trimmed : `${trimmed}/matomo.php`;
}
