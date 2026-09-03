# Evidence: get_reuse_info (live stdio)

**Date**: 2026-09-03T16:59:28.411Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 424 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_reuse_info",
  "arguments": {
    "reuse_id": "6a96cc1b2aeed626b1cb300e"
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `get_reuse_info` present

## Output (text, truncated to 80 lines)

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
Tags: choix-localisation, commune-francaise, densite-professionnelle, implantation-entreprise, profession-liberale
Created: 2026-09-01T12:59:07.695000+00:00
Last modified: 2026-09-02T13:39:35.655000+00:00

Datasets used (5):
  - Base Sirene des entreprises et de leurs établissements (SIREN, SIRET) (ID: 5b7ffc618b4c4169d30727e0)
  - Population (ID: 53699d0ea3a729239d205b2e)
  - Code Officiel Géographique (COG) (ID: 58c984b088ee386cdb1261f3)
  - Découpage administratif (ID: 683424208089f77caf78f448)
  - Revenus et pauvreté des ménages aux niveaux national et local - Revenus localisés sociaux et fiscaux (ID: 5b156279c751df40bb588de9)
```

## structuredContent (keys)

- `reuse`

## Assertions

- [x] `tools/list` includes `get_reuse_info`
- [x] Tool returned without `isError`
- [x] Text content present (1465 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_reuse_info` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
