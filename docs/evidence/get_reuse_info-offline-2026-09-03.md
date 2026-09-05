# Evidence: get_reuse_info (offline fixtures)

**Date**: 2026-09-03
**Agent**: Composer (evidence coverage)
**Status**: PASS
**Transport**: in-process MCP (`startTestServer` + `mockDatagouv`)
**Duration**: 2 ms
**Data env**: fixtures (recorded under `tests/fixtures/api`)

## Input
```json
{
  "reuse_id": "6a96cc1b2aeed626b1cb300e"
}
```

## Output (text, truncated)
```text
Reuse: Zonelo - Trop ou pas assez de professionnels ? 

ID: 6a96cc1b2aeed626b1cb300e
Slug: zonelo-trop-ou-pas-assez-de-professionnels
URL: https://www.data.gouv.fr/reuses/zonelo-trop-ou-pas-assez-de-professionnels
Type: application
Topic: economy_and_business
Organization: Zonelo (ID: 6a96afccb93002cd80fe86c9)

Description: Zonelo est un outil gratuit qui aide les artisans, commerçants et professionnels libéraux à choisir la commune où s'installer.

Pour chaque métier (plombier, coiffeur, infirmier libéral, garagiste, restaurateur…) et chaque commune de France, le site indique si le métier est déjà très présent ou au contraire sous-représenté par rapport à la population locale. Une note sur 100 synthétise cette densité, accompagnée du nombre de professionnels en activité, de la population de la commune et d'une ...
Tags: choix-localisation, commune-francaise
Created: 2026-09-01T12:59:07.695000+00:00
Last modified: 2026-09-02T13:39:35.655000+00:00

Datasets used (2):
  - Base Sirene des entreprises et de leurs établissements (SIREN, SIRET) (ID: 5b7ffc618b4c4169d30727e0)
  - Population (ID: 53699d0ea3a729239d205b2e)
```

## structuredContent (keys)
- `reuse`

## Assertions
- [x] Tool returned without `isError`
- [x] Text content present (1131 chars)
- [x] `structuredContent` present

## Reproduce
```bash
EVIDENCE_WRITE=1 pnpm exec vitest run tests/e2e/all-tools-offline.test.ts
```
