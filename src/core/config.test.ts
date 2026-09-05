import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, resolveBaseUrls } from "./index.js";

describe("loadConfig", () => {
  it("applies defaults with an empty environment", () => {
    const config = loadConfig({});
    expect(config.transport).toBe("stdio");
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8000);
    expect(config.mcpEnv).toBe("local");
    expect(config.datagouvApiEnv).toBe("prod");
    expect(config.logLevel).toBe("info");
    expect(config.http).toEqual({
      timeoutMs: 15_000,
      retries: 2,
      maxDownloadBytes: 50 * 1024 * 1024,
    });
    expect(config.matomo).toBeUndefined();
    expect(config.sentry).toBeUndefined();
    expect(config.baseUrls.datagouvApi).toBe("https://www.data.gouv.fr/api/");
    expect(config.allowedHosts).toContain("mcp.data.gouv.fr");
  });

  it("maps DATAGOUV_API_ENV=demo to demo URLs but keeps metrics on prod", () => {
    const config = loadConfig({ DATAGOUV_API_ENV: "demo" });
    expect(config.baseUrls.datagouvApi).toBe("https://demo.data.gouv.fr/api/");
    expect(config.baseUrls.tabularApi).toBe("https://tabular-api.preprod.data.gouv.fr/api/");
    expect(config.baseUrls.metricsApi).toBe("https://metric-api.data.gouv.fr/api/");
    expect(resolveBaseUrls("demo").crawlerApi).toBe("https://demo-crawler.data.gouv.fr/api/");
  });

  it("falls back to prod for unknown DATAGOUV_API_ENV (legacy behaviour)", () => {
    expect(loadConfig({ DATAGOUV_API_ENV: "staging" }).datagouvApiEnv).toBe("prod");
  });

  it("accepts legacy uppercase Python log levels", () => {
    expect(loadConfig({ LOG_LEVEL: "WARNING" }).logLevel).toBe("warn");
    expect(loadConfig({ LOG_LEVEL: "CRITICAL" }).logLevel).toBe("fatal");
    expect(loadConfig({ LOG_LEVEL: "debug" }).logLevel).toBe("debug");
  });

  it("parses transport, port, matomo and sentry", () => {
    const config = loadConfig({
      MCP_TRANSPORT: "HTTP",
      MCP_PORT: "9090",
      MATOMO_URL: "https://matomo.example.org",
      MATOMO_SITE_ID: "3",
      SENTRY_DSN: "https://key@sentry.io/1",
      SENTRY_SAMPLE_RATE: "0.25",
      MCP_ALLOWED_HOSTS: "a.example, b.example",
    });
    expect(config.transport).toBe("http");
    expect(config.port).toBe(9090);
    expect(config.matomo).toEqual({
      url: "https://matomo.example.org",
      siteId: "3",
      authToken: undefined,
    });
    expect(config.sentry).toEqual({ dsn: "https://key@sentry.io/1", sampleRate: 0.25 });
    expect(config.allowedHosts).toEqual(["a.example", "b.example"]);
  });

  it("ignores Matomo when only one of URL / SITE_ID is set", () => {
    expect(loadConfig({ MATOMO_URL: "https://matomo.example.org" }).matomo).toBeUndefined();
  });

  it("throws ConfigError listing every invalid variable", () => {
    expect(() => loadConfig({ MCP_PORT: "abc", LOG_LEVEL: "loud", MCP_TRANSPORT: "grpc" })).toThrow(
      ConfigError,
    );
    try {
      loadConfig({ MCP_PORT: "70000" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toMatch(/MCP_PORT/);
      expect((error as ConfigError).code).toBe("CONFIG_ERROR");
    }
  });
});
