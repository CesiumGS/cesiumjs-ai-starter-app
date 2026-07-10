# Backend Dockerfile (self-contained, source-to-image) — compiles the
# TypeScript API from source and packages it, in one `docker build`. Build
# context MUST be the repo root (npm workspace), e.g.
# `docker build -f backend/Dockerfile .` — this is what compose.yaml uses.
#
# This app's workspace packages (@cesium-ai/server, @cesium-ai/tools-cesium,
# @cesium-ai/sample-config) are resolved via npm workspaces from the repo
# root, so the backend image can't be built from the backend/ folder alone.
# Only manifests for workspaces the backend actually depends on are copied —
# npm ci is fine with the rest of the `workspaces` glob in the root
# package.json not resolving to anything on disk.

# ---- Stage 1: build --------------------------------------------------------
FROM node:lts-alpine AS build
WORKDIR /app

# Copy workspace manifests first so `npm ci` is cached across source changes.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/tools-cesium/package.json packages/tools-cesium/package.json
RUN npm ci

COPY shared shared
COPY packages/server packages/server
COPY packages/tools-cesium packages/tools-cesium
COPY backend backend

RUN npm run build:packages && npm run build -w backend

# Strip devDependencies from the installed tree so the runner can reuse it as-is
# (all deps are hoisted to the root node_modules; no per-workspace node_modules).
RUN npm prune --omit=dev && npm cache clean --force

# ---- Stage 2: runner --------------------------------------------------------
FROM node:lts-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Reuse the pruned, production-only dependency tree from the build stage
# instead of re-installing. node_modules holds the hoisted third-party deps
# plus the @cesium-ai/* workspace symlinks; the package.json + dist copies
# below populate those symlink targets so module resolution works at runtime.
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/shared/package.json shared/package.json
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/packages/server/package.json packages/server/package.json
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/tools-cesium/package.json packages/tools-cesium/package.json
COPY --from=build /app/packages/tools-cesium/dist packages/tools-cesium/dist

USER node

# Internal only — not published in compose.yaml, reachable via the Docker
# network from the frontend's reverse proxy.
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/dist/index.js"]
