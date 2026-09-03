# Evidence: get_topic (live stdio)

**Date**: 2026-09-03T16:59:29.101Z
**Version**: 1.0.0-alpha.0
**Agent**: Composer (live evidence batch 2)
**Status**: **PASS**
**Transport**: stdio (`node dist/index.js`)
**Duration**: 204 ms
**Data env**: prod (live data.gouv.fr API)

## Tool call

```json
{
  "name": "get_topic",
  "arguments": {
    "topic_id": "6a9767b730e2eeddc825f377"
  }
}
```

## Preconditions

- `pnpm build` completed successfully
- Evidence harness: `/tmp/evidence-live-batch2.mjs` (raw JSON-RPC over stdio)
- `tools/list` returned **21** tools; `get_topic` present

## Output (text, truncated to 80 lines)

```text
Topic: Inoé
ID: 6a9767b730e2eeddc825f377 (slug: inoe)
URL: https://www.data.gouv.fr/topics/inoe/
Tags: simplifions-v2, simplifions-v2-dag-generated, simplifions-v2-solutions, simplifions-v2-solutions-160, simplifions-v2-types-de-simplification-dlnuf, simplifions-v2-fournisseurs-de-service-tout-collectivites-territoires, simplifions-v2-categorie-de-solution-logiciel-metier, simplifions-v2-fournisseurs-de-service-tout-acteurs-publics, simplifions-v2-fournisseurs-de-service-communes

Description: Portail famille permettant aux collectivités de centraliser la gestion et la facturation : 
- des activités scolaires, périscolaires, de loisirs ;
- des établissements d'accueil du jeune enfant (EAJE). 
Les collectivités ont également la possibilité d'utiliser le logiciel en back-office, pour les familles qui ne peuvent pas passer par le portail famille. 
Ce logiciel récupère automatiquement le quotient familial et les informations nécessaires pour la tarification des EAJE pour appliquer les ...

Datasets (0):
```

## structuredContent (keys)

- `topic`
- `datasets_count`
- `datasets`

## Assertions

- [x] `tools/list` includes `get_topic`
- [x] Tool returned without `isError`
- [x] Text content present (1014 chars)
- [x] `structuredContent` present with expected keys

## Verdict

**PASS** — live stdio call to `get_topic` succeeded against production API.

## Reproduce

```bash
pnpm build
node /tmp/evidence-live-batch2.mjs
```
