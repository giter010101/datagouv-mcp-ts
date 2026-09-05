import { parseArgs } from "node:util";
import { loadConfig, type TransportKind } from "./core/config.js";
import { isDatagouvError } from "./core/errors.js";
import { rootLogger, setLogLevel } from "./core/logger.js";
import { APP_NAME, APP_VERSION } from "./core/version.js";
import { createDeps } from "./server/deps.js";
import { runHttp } from "./server/http.js";
import { runStdio } from "./server/stdio.js";

const HELP = `${APP_NAME} ${APP_VERSION} — MCP server for data.gouv.fr

Usage:
  datagouv-mcp                 stdio transport (default; for IDE / CLI clients)
  datagouv-mcp --http          Streamable HTTP transport on http://MCP_HOST:MCP_PORT/mcp
  datagouv-mcp --http --port 8000 --host 127.0.0.1

Options:
  --http           Use Streamable HTTP (same as MCP_TRANSPORT=http)
  --stdio          Use stdio (same as MCP_TRANSPORT=stdio)
  --port <n>       HTTP port (env MCP_PORT, default 8000)
  --host <addr>    HTTP bind address (env MCP_HOST, default 127.0.0.1)
  -h, --help       Show this help
  -v, --version    Print version

Environment: see .env.example (DATAGOUV_API_ENV=prod|demo, LOG_LEVEL, HTTP_TIMEOUT_MS, ...).
`;

export interface CliOptions {
  transport: TransportKind | undefined;
  port: number | undefined;
  host: string | undefined;
  help: boolean;
  version: boolean;
}

export function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      http: { type: "boolean", default: false },
      stdio: { type: "boolean", default: false },
      port: { type: "string" },
      host: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    throw new Error(`Invalid --port value: ${values.port}`);
  }
  return {
    transport: values.http ? "http" : values.stdio ? "stdio" : undefined,
    port,
    host: values.host,
    help: values.help,
    version: values.version,
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const cli = parseCli(argv);
  if (cli.help) {
    process.stdout.write(HELP);
    return;
  }
  if (cli.version) {
    process.stdout.write(`${APP_VERSION}\n`);
    return;
  }

  const config = loadConfig();
  setLogLevel(config.logLevel);
  const transport = cli.transport ?? config.transport;
  const deps = createDeps(config);

  if (transport === "http") {
    await runHttp(deps, cli.port ?? config.port, cli.host ?? config.host);
    return;
  }
  await runStdio(deps);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  /(^|[\\/])(index\.(js|ts)|datagouv-mcp)$/.test(process.argv[1]);

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = isDatagouvError(error) ? `${error.code}: ${error.message}` : String(error);
    rootLogger.fatal({ err: error }, "startup failed");
    process.stderr.write(`${APP_NAME}: ${message}\n`);
    process.exit(1);
  });
}
