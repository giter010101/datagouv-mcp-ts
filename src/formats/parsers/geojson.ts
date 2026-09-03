import type { Row } from "../../core/types.js";
import { flattenRecord } from "./json.js";

/** GeoJSON → tabular rows (properties + geometry type) with a bounding box. */

export type BBox = [number, number, number, number];

export interface GeoFeatureTable {
  rows: Row[];
  columns: string[];
  featureCount: number;
  geometryTypes: Record<string, number>;
  bbox: BBox | undefined;
  crs: string | undefined;
  truncated: boolean;
}

interface Geometry {
  type: string;
  coordinates?: unknown;
  geometries?: Geometry[];
}

interface Feature {
  type: "Feature";
  properties?: Record<string, unknown> | null;
  geometry?: Geometry | null;
  id?: unknown;
}

function extendBBox(bbox: BBox | undefined, coords: unknown): BBox | undefined {
  if (!Array.isArray(coords)) return bbox;
  if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    const [x, y] = coords as [number, number];
    if (!bbox) return [x, y, x, y];
    return [Math.min(bbox[0], x), Math.min(bbox[1], y), Math.max(bbox[2], x), Math.max(bbox[3], y)];
  }
  let out = bbox;
  for (const c of coords) out = extendBBox(out, c);
  return out;
}

export function geometryBBox(geometry: Geometry | null | undefined, bbox?: BBox): BBox | undefined {
  if (!geometry) return bbox;
  if (geometry.type === "GeometryCollection") {
    let out = bbox;
    for (const g of geometry.geometries ?? []) out = geometryBBox(g, out);
    return out;
  }
  return extendBBox(bbox, geometry.coordinates);
}

export function isGeoJson(doc: unknown): boolean {
  if (doc === null || typeof doc !== "object") return false;
  const type = (doc as { type?: unknown }).type;
  return type === "FeatureCollection" || type === "Feature" || type === "GeometryCollection";
}

function featuresOf(doc: unknown): Feature[] {
  if (doc === null || typeof doc !== "object") return [];
  const rec = doc as Record<string, unknown>;
  if (rec.type === "FeatureCollection" && Array.isArray(rec.features))
    return rec.features as Feature[];
  if (rec.type === "Feature") return [doc as Feature];
  if (typeof rec.type === "string" && ("coordinates" in rec || "geometries" in rec)) {
    return [{ type: "Feature", properties: {}, geometry: doc as Geometry }];
  }
  return [];
}

export function geoJsonToTable(doc: unknown, limit?: number): GeoFeatureTable {
  const features = featuresOf(doc);
  const geometryTypes: Record<string, number> = {};
  let bbox: BBox | undefined;
  const rows: Row[] = [];
  const declaredBBox = (doc as { bbox?: unknown }).bbox;
  features.forEach((feature, index) => {
    const type = feature.geometry?.type ?? "null";
    geometryTypes[type] = (geometryTypes[type] ?? 0) + 1;
    if (!Array.isArray(declaredBBox) && index < 5000) bbox = geometryBBox(feature.geometry, bbox);
    if (limit === undefined || rows.length < limit) {
      const row: Row = flattenRecord(feature.properties ?? {});
      if (feature.id !== undefined) row.feature_id = feature.id;
      row.geometry_type = type;
      rows.push(row);
    }
  });
  if (Array.isArray(declaredBBox) && declaredBBox.length >= 4) {
    const [a, b, c, d] = declaredBBox as number[];
    if ([a, b, c, d].every((n) => typeof n === "number")) {
      bbox = [a as number, b as number, c as number, d as number];
    }
  }
  const columns = new Set<string>();
  for (const row of rows.slice(0, 200)) for (const k of Object.keys(row)) columns.add(k);
  const crsName = (doc as { crs?: { properties?: { name?: unknown } } }).crs?.properties?.name;
  return {
    rows,
    columns: [...columns],
    featureCount: features.length,
    geometryTypes,
    bbox: bbox ? (bbox.map((n) => Math.round(n * 1e6) / 1e6) as BBox) : undefined,
    crs: typeof crsName === "string" ? crsName : undefined,
    truncated: limit !== undefined && features.length > limit,
  };
}
