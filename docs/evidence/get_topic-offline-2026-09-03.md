# Evidence: get_topic (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 3 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "topic_id": "68d26d38c8f655382d59e3ac"
}
```

## Output (text, truncated)
```text
Topic: Santé et territoires
ID: 68d26d38c8f655382d59e3ac (slug: sante-et-territoires)
URL: https://www.data.gouv.fr/topics/sante-et-territoires/
Tags: defisdatagouvfr, defisdatagouvfr-saison-saison-4

Description: _Ce défi est proposé par [la Fondation Roche](https://fondationroche.org/), partenaire de l’Open Data University._

**[Lancer ce défi sur un environnement de travail configuré proposé sur le Datalab "SSP Cloud" de l'INSEE](https://datalab.sspcloud.fr/launcher/ide/jupyter-python?autoLaunch=true&name=defis-datagouv&init.personalInit=%C2%ABhttps://raw.githubusercontent.com/datagouv/odu-notebooks/main

Datasets (1):
  1. Population (ID: 53699d0ea3a729239d205b2e) — Institut national de la statistique et des études économiques (Insee) — 8 resource(s)
```

## structuredContent (keys)
- `topic`
- `datasets_count`
- `datasets`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (764 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
