# Cloudflare / Wrangler (sans secrets dans git)

**English (short):** This MCP is a **Node.js** process (`src/index.ts`: stdio + Streamable HTTP). It is **not** a Cloudflare Worker yet. Use Node/Docker to run it. Use Wrangler on *your* PC for OAuth login and secrets (`wrangler secret put`). Never commit `.dev.vars`, `.env`, or Wrangler auth. `wrangler.jsonc` has **no `main`** so `wrangler deploy` cannot fake a Worker deploy. A real edge port would need a Workers adapter (e.g. Agents SDK / `McpAgent`), not this file as-is.

---

## Deux chemins

| | Chemin | État |
|---|--------|------|
| **A** | Processus Node (stdio / HTTP) ou **conteneur** (`Dockerfile`) | **Recommandé aujourd’hui.** Produit qui démarre. Sur Cloudflare plus tard : Workers **Containers** autour de cette image, pas un Worker JS cassé. |
| **B** | Worker JS (`wrangler deploy` + `nodejs_compat`) | **Pas encore.** Il faudrait un point d’entrée `fetch` + adaptation (pas `@hono/node-server`). Ne lancez pas `wrangler deploy` en pensant publier le MCP. |

Compte Cloudflare : `npx wrangler whoami` en local (pas d’`account_id` dans le dépôt).

---

## 1. Cloner `main`

```bash
git clone https://github.com/giter010101/datagouv-mcp-ts.git
cd datagouv-mcp-ts
git checkout main
```

Node **≥ 22**. pnpm via Corepack : `corepack enable`.

## 2. Installer et builder

```bash
pnpm install
pnpm build
```

## 3. Installer Wrangler (CLI Cloudflare)

Dans le projet (recommandé) :

```bash
pnpm add -D wrangler
```

Ou globalement : `npm i -g wrangler`.

## 4. Login OAuth (jamais dans git)

```bash
npx wrangler login
npx wrangler whoami
```

Le navigateur ouvre OAuth. Le jeton est stocké dans la **config utilisateur** Wrangler (hors dépôt). **Ne commitez jamais** ce token, ni un `CLOUDFLARE_API_TOKEN` dans le repo.

## 5. Variables locales (noms seulement dans git)

```bash
cp .dev.vars.example .dev.vars
# éditer .dev.vars — gitignored
# pour Node sans Wrangler :
cp .env.example .env
```

`.dev.vars` = format Wrangler (`wrangler dev` plus tard). `.env` = `process.env` pour `node dist/index.js`. Mêmes **noms** que `src/core/config.ts`.

## 6. Secrets de production (Worker / Container futurs)

Ne les mettez **jamais** dans `wrangler.jsonc`.

```bash
npx wrangler secret put SENTRY_DSN
npx wrangler secret put MATOMO_AUTH_TOKEN
# autres secrets si vous les utilisez
npx wrangler secret list
```

Valeurs interactives (stdin). Pas de fichier `secrets.json` versionné.

## 7. Lancer le MCP **sans** Cloudflare

**stdio** (IDE / client MCP) :

```bash
pnpm build && node dist/index.js
# équivalent : pnpm exec datagouv-mcp   après build
```

**HTTP** (`POST /mcp`, `GET /health`) :

```bash
pnpm build && node dist/index.js --http
# ou : MCP_TRANSPORT=http MCP_HOST=127.0.0.1 MCP_PORT=8000 node dist/index.js
curl -fsS http://127.0.0.1:8000/health
```

Dev watch : `pnpm dev` / `pnpm dev:http`. Docker : voir [deployment.md](deployment.md).

## 8. Ne pas committer (checklist)

- [ ] `.dev.vars`, `.env`, `.env.local`, `.env.*.local`
- [ ] `.wrangler/` (état local Wrangler)
- [ ] `*.pem`, clés, tokens Matomo, DSN Sentry
- [ ] cookies / credentials Wrangler (`~/.wrangler` ou équivalent, hors repo)
- [ ] `account_id`, `CLOUDFLARE_API_TOKEN` dans `wrangler.jsonc` ou le code

`wrangler.jsonc` versionné = nom + `compatibility_date` + `nodejs_compat` uniquement.
