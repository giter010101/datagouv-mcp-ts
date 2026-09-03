# syntax=docker/dockerfile:1.7
#
# datagouv-mcp — multi-stage image.
#   build : install all deps, bundle with tsdown
#   prod  : production node_modules only
#   final : node:22-slim, non-root, Streamable HTTP on 0.0.0.0:8000
#
# Build:  docker build -t datagouv-mcp .
# Run:    docker run --rm -p 8000:8000 datagouv-mcp
# Health: curl -f http://127.0.0.1:8000/health

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.33.3

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./

# ---------------------------------------------------------------------------
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY tsconfig.json tsdown.config.ts ./
COPY src ./src
RUN pnpm build

# ---------------------------------------------------------------------------
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS final
LABEL org.opencontainers.image.title="datagouv-mcp" \
      org.opencontainers.image.description="MCP server for data.gouv.fr (Streamable HTTP + stdio)" \
      org.opencontainers.image.source="https://github.com/giter010101/datagouv-mcp-ts" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=8000 \
    MCP_ENV=docker \
    LOG_LEVEL=info

WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json LICENSE README.md ./

USER node
EXPOSE 8000

# Deep probe: /health runs search_datasets in-process against data.gouv.fr.
HEALTHCHECK --interval=60s --timeout=15s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.MCP_PORT ?? 8000}/health`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--http"]
