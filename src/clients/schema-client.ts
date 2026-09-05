import type { Cache } from "../core/cache.js";
import type { ApiBaseUrls } from "../core/config.js";
import { ApiError, NotFoundError, ValidationError } from "../core/errors.js";
import { buildUrl, type HttpClient } from "../core/http.js";
import { childLogger } from "../core/logger.js";
import { toSchemaCatalogEntry } from "./mappers/entities.js";
import { parseJsonOrYamlObject } from "./openapi.js";
import {
  schemaCatalogSchema,
  type TableSchemaDocument,
  tableSchemaDocumentSchema,
  validataResponseSchema,
} from "./schemas/schema-catalog.js";
import type { SchemaCatalogEntry, SchemaClient, SchemaField, ValidationReport } from "./types.js";

const CATALOG_TTL_MS = 60 * 60_000;
const SCHEMA_TTL_MS = 60 * 60_000;
const VALIDATION_TTL_MS = 5 * 60_000;
/** Validata downloads and validates the whole file: allow well beyond the default timeout. */
const VALIDATA_TIMEOUT_MS = 60_000;
const MAX_VALIDATION_ERRORS = 20;

export interface SchemaClientDeps {
  http: HttpClient;
  cache: Cache;
  baseUrls: ApiBaseUrls;
}

export class HttpSchemaClient implements SchemaClient {
  private readonly log = childLogger("schema-client");

  constructor(private readonly deps: SchemaClientDeps) {}

  private catalog(): Promise<SchemaCatalogEntry[]> {
    const url = buildUrl(this.deps.baseUrls.schemaCatalog, "schemas/schemas.json");
    return this.deps.cache.getOrLoad(
      "schema:catalog",
      async () => {
        this.log.debug({ url: url.href }, "fetch schema catalogue");
        const body = await this.deps.http.getJson(url, { schema: schemaCatalogSchema });
        return body.schemas.map(toSchemaCatalogEntry);
      },
      { ttlMs: CATALOG_TTL_MS, staleOnError: true },
    );
  }

  async listSchemas(query?: string): Promise<SchemaCatalogEntry[]> {
    const entries = await this.catalog();
    const q = query?.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.name, e.title, e.description].some((s) => s.toLowerCase().includes(q)),
    );
  }

  async getSchema(
    name: string,
    version?: string,
  ): Promise<SchemaCatalogEntry & { fields: SchemaField[]; resolvedUrl: string }> {
    const entries = await this.catalog();
    const wanted = name.trim().toLowerCase();
    const entry = entries.find((e) => e.name.toLowerCase() === wanted);
    if (!entry) {
      throw new NotFoundError(`Schema '${name}' is not in the schema.data.gouv.fr catalogue.`, {
        details: { name },
        hint: "Call list_schemas to browse available schema names (e.g. etalab/schema-irve-statique).",
      });
    }
    if (version !== undefined && !entry.versions.includes(version)) {
      throw new NotFoundError(`Schema '${entry.name}' has no version '${version}'.`, {
        details: { name: entry.name, versions: entry.versions },
      });
    }
    const resolvedUrl =
      version === undefined ? entry.schemaUrl : entry.schemaUrl.replace("/latest/", `/${version}/`);
    if (entry.schemaType === "other") return { ...entry, fields: [], resolvedUrl };

    const fields = await this.deps.cache.getOrLoad(
      `schema:fields:${resolvedUrl}`,
      async () => {
        const text = await this.deps.http.getText(resolvedUrl, {
          notFoundMessage: `Schema file not found at ${resolvedUrl}`,
        });
        const doc = tableSchemaDocumentSchema.parse(
          parseJsonOrYamlObject(text, resolvedUrl, "schema document"),
        );
        return extractFields(doc);
      },
      { ttlMs: SCHEMA_TTL_MS },
    );
    return { ...entry, fields, resolvedUrl };
  }

  validateResource(schemaUrl: string, resourceUrl: string): Promise<ValidationReport> {
    const url = buildUrl(this.deps.baseUrls.validataApi, "validate", {
      schema: schemaUrl,
      url: resourceUrl,
    });
    return this.deps.cache.getOrLoad(
      `schema:validate:${url.search}`,
      async () => {
        this.log.debug({ url: url.href }, "validata request");
        let body: unknown;
        try {
          body = await this.deps.http.getJson(url, {
            schema: validataResponseSchema,
            timeoutMs: VALIDATA_TIMEOUT_MS,
            retries: 0,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) {
            throw new ValidationError(
              `Validata rejected the request: ${validataErrorMessage(error.details?.body)}`,
              { cause: error, details: { schemaUrl, resourceUrl } },
            );
          }
          throw error;
        }
        const parsed = validataResponseSchema.parse(body);
        if (!parsed.report) {
          throw new ApiError(
            `Validata returned no report: ${parsed.error?.message ?? "unknown error"}`,
            { status: 200, url: url.href, details: { schemaUrl, resourceUrl } },
          );
        }
        const report = parsed.report;
        return {
          valid: report.valid ?? false,
          errorCount: report.stats?.errors ?? report.errors?.length ?? 0,
          warningCount: report.stats?.warnings ?? report.warnings?.length ?? 0,
          rows: report.stats?.rows ?? undefined,
          errors: (report.errors ?? []).slice(0, MAX_VALIDATION_ERRORS),
          warnings: (report.warnings ?? []).slice(0, MAX_VALIDATION_ERRORS),
        };
      },
      { ttlMs: VALIDATION_TTL_MS },
    );
  }
}

function validataErrorMessage(body: unknown): string {
  if (typeof body !== "string") return "bad request";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

/** TableSchema `fields[]` or JSON Schema `properties` → `SchemaField[]`. */
export function extractFields(doc: TableSchemaDocument): SchemaField[] {
  if (doc.fields && doc.fields.length > 0) {
    return doc.fields.map((f) => ({
      name: f.name,
      type: f.type ?? "string",
      description: f.description ?? undefined,
      required: f.constraints?.required === true,
      constraints: f.constraints ?? undefined,
    }));
  }
  const required = new Set(doc.required ?? []);
  return Object.entries(doc.properties ?? {}).map(([name, prop]) => ({
    name,
    type: typeof prop.type === "string" ? prop.type : "unknown",
    description: typeof prop.description === "string" ? prop.description : undefined,
    required: required.has(name),
    constraints: undefined,
  }));
}

export function createSchemaClient(deps: SchemaClientDeps): SchemaClient {
  return new HttpSchemaClient(deps);
}
