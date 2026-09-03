import { describe, expect, it } from "vitest";
import { loadConfig } from "../../../src/core/config.js";
import type { FetchLike } from "../../../src/core/http.js";
import type { Logger } from "../../../src/core/logger.js";
import { createTelemetry } from "../../../src/server/telemetry.js";
import { registerTools } from "../../../src/tools/registry.js";
import type { AnyToolDefinition } from "../../../src/tools/types.js";

function fakeFetch(handler: FetchLike): FetchLike & {
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fn: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    return handler(input, init);
  };
  return Object.assign(fn, { calls });
}

function fakeLogger() {
  const calls: Array<{ level: string; obj: unknown; msg: string | undefined }> = [];
  const logger = {
    info: (obj: unknown, msg?: string) => calls.push({ level: "info", obj, msg }),
    warn: (obj: unknown, msg?: string) => calls.push({ level: "warn", obj, msg }),
    error: (obj: unknown, msg?: string) => calls.push({ level: "error", obj, msg }),
  } as unknown as Logger;
  return { logger, calls };
}

const matomoConfig = () =>
  loadConfig({
    MATOMO_URL: "https://matomo.example.org",
    MATOMO_SITE_ID: "7",
  });

describe("createTelemetry", () => {
  it("is a no-op when Matomo and Sentry are unset", async () => {
    const fetchImpl = fakeFetch(async () => new Response("ok"));
    const telemetry = createTelemetry(loadConfig({}), { fetchImpl });
    telemetry.onToolCall({ tool: "search_datasets", durationMs: 12, ok: true });
    await telemetry.flush();
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("POSTs a Matomo event with site id, tool name, ok/err and duration", async () => {
    const fetchImpl = fakeFetch(async () => new Response("ok", { status: 204 }));
    const telemetry = createTelemetry(matomoConfig(), { fetchImpl });
    telemetry.onToolCall({ tool: "search_datasets", durationMs: 42, ok: true });
    await telemetry.flush();

    expect(fetchImpl.calls).toHaveLength(1);
    const call = fetchImpl.calls[0];
    expect(call?.url).toBe("https://matomo.example.org/matomo.php");
    expect(call?.init?.method).toBe("POST");
    const body = String(call?.init?.body);
    const params = new URLSearchParams(body);
    expect(params.get("idsite")).toBe("7");
    expect(params.get("e_c")).toBe("tools");
    expect(params.get("e_a")).toBe("search_datasets");
    expect(params.get("e_n")).toBe("ok");
    expect(params.get("e_v")).toBe("42");
    expect(params.get("token_auth")).toBeNull();
  });

  it("marks failed tools as err and includes the auth token when set", async () => {
    const fetchImpl = fakeFetch(async () => new Response("ok"));
    const telemetry = createTelemetry(
      loadConfig({
        MATOMO_URL: "https://matomo.example.org/",
        MATOMO_SITE_ID: "3",
        MATOMO_AUTH_TOKEN: "secret",
      }),
      { fetchImpl },
    );
    telemetry.onToolCall({
      tool: "health_check",
      durationMs: 9,
      ok: false,
      errorCode: "TIMEOUT",
    });
    await telemetry.flush();
    const params = new URLSearchParams(String(fetchImpl.calls[0]?.init?.body));
    expect(params.get("e_c")).toBe("health_check");
    expect(params.get("e_n")).toBe("err");
    expect(params.get("token_auth")).toBe("secret");
  });

  it("never throws when the Matomo beacon fails", async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new Error("network down");
    });
    const { logger, calls } = fakeLogger();
    const telemetry = createTelemetry(matomoConfig(), { fetchImpl, logger });
    expect(() =>
      telemetry.onToolCall({ tool: "search_datasets", durationMs: 1, ok: true }),
    ).not.toThrow();
    await telemetry.flush();
    expect(calls.some((c) => c.level === "warn")).toBe(true);
  });

  it("logs Sentry context on tool errors without sending the DSN", async () => {
    const fetchImpl = fakeFetch(async () => new Response("ok"));
    const { logger, calls } = fakeLogger();
    const telemetry = createTelemetry(
      loadConfig({ SENTRY_DSN: "https://key@sentry.io/1", MCP_ENV: "prod" }),
      { fetchImpl, logger },
    );
    telemetry.onToolCall({ tool: "get_dataset_info", durationMs: 5, ok: true });
    telemetry.onToolCall({
      tool: "get_dataset_info",
      durationMs: 8,
      ok: false,
      errorCode: "NOT_FOUND",
    });
    await telemetry.flush();
    expect(fetchImpl.calls).toHaveLength(0);
    const errors = calls.filter((c) => c.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.obj).toMatchObject({
      sentryDsnSet: true,
      environment: "prod",
      tool: "get_dataset_info",
      errorCode: "NOT_FOUND",
    });
    expect(JSON.stringify(errors[0]?.obj)).not.toContain("key@sentry.io");
  });
});

describe("registry wiring", () => {
  it("does not fail the tool when telemetry throws synchronously", async () => {
    const definition: AnyToolDefinition<{ tag: string }> = {
      name: "ping",
      title: "Ping",
      description: "ping",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      async handler() {
        return { text: "pong" };
      },
    };
    const registered: Array<{
      handler: (args: unknown, extra: { requestId?: string }) => Promise<{ content: unknown }>;
    }> = [];
    const server = {
      registerTool: (_name: string, _meta: unknown, handler: (typeof registered)[0]["handler"]) => {
        registered.push({ handler });
      },
    };
    const telemetry = {
      onToolCall: () => {
        throw new Error("boom");
      },
      flush: async () => {},
    };
    registerTools(
      server as never,
      [definition],
      { tag: "x" },
      {
        maxOutputChars: 1000,
        onToolCall: (event) => telemetry.onToolCall(event),
      },
    );
    const first = registered[0];
    expect(first).toBeDefined();
    const result = await first?.handler({}, { requestId: "1" });
    expect(result).toMatchObject({ content: [{ type: "text", text: "pong" }] });
  });

  it("does not fail the tool when the Matomo fetch rejects", async () => {
    const definition: AnyToolDefinition<Record<string, never>> = {
      name: "ping",
      title: "Ping",
      description: "ping",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      async handler() {
        return { text: "pong" };
      },
    };
    const registered: Array<{
      handler: (args: unknown, extra: { requestId?: string }) => Promise<{ content: unknown }>;
    }> = [];
    const server = {
      registerTool: (_name: string, _meta: unknown, handler: (typeof registered)[0]["handler"]) => {
        registered.push({ handler });
      },
    };
    const fetchImpl = fakeFetch(async () => {
      throw new Error("matomo down");
    });
    const telemetry = createTelemetry(matomoConfig(), { fetchImpl });
    registerTools(
      server as never,
      [definition],
      {},
      {
        maxOutputChars: 1000,
        onToolCall: (event) => telemetry.onToolCall(event),
      },
    );
    const first = registered[0];
    expect(first).toBeDefined();
    const result = await first?.handler({}, {});
    expect(result).toMatchObject({ content: [{ type: "text", text: "pong" }] });
    await telemetry.flush();
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe("createTelemetry fetch status errors", () => {
  it("swallows non-OK Matomo responses", async () => {
    const fetchImpl = fakeFetch(async () => new Response("nope", { status: 500 }));
    const { logger, calls } = fakeLogger();
    const telemetry = createTelemetry(matomoConfig(), { fetchImpl, logger });
    telemetry.onToolCall({ tool: "suggest", durationMs: 2, ok: true });
    await telemetry.flush();
    expect(calls.some((c) => c.level === "warn" && String(c.msg).includes("beacon"))).toBe(true);
  });
});
