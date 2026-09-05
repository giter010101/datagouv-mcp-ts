/**
 * Generic French words users add to searches but that rarely appear in
 * dataset metadata. udata search uses AND logic, so they yield zero results.
 * Ported verbatim from the legacy server (`tools/search_datasets.py`).
 */
export const SEARCH_STOP_WORDS: ReadonlySet<string> = new Set([
  "données",
  "donnee",
  "donnees",
  "fichier",
  "fichiers",
  "fichier de",
  "fichiers de",
  "tableau",
  "tableaux",
  "csv",
  "excel",
  "xlsx",
  "json",
  "xml",
]);

/** Remove stop words (case-insensitive) and collapse whitespace. */
export function cleanSearchQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter((word) => word !== "" && !SEARCH_STOP_WORDS.has(word.toLowerCase().trim()))
    .join(" ");
}
