/**
 * Live smoke against production data.gouv.fr.
 * Gated by DATAGOUV_LIVE=1 (alias RUN_LIVE_TESTS=1); run with `pnpm test:live`.
 *
 * Fixture IDs come from research/evidence (Population dataset, gentilés CSV).
 * Assertions stay loose: ids present, totals > 0 — not exact titles (data drift).
 */
export const LIVE = process.env.DATAGOUV_LIVE === "1" || process.env.RUN_LIVE_TESTS === "1";

/** INSEE Population dataset — `.agent/research/02-datagouv-platform-survey.md`. */
export const LIVE_DATASET_ID = "53699d0ea3a729239d205b2e";

/** Tabular CSV (gentilés) — `.agent/research/03-resource-formats-catalog.md`. */
export const LIVE_RESOURCE_ID = "a86ebc34-a979-4d6c-8f2a-9710a43dca93";
