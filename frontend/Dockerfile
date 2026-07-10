# Frontend Dockerfile (self-contained, source-to-image) — builds the SPA from
# source and packages it, in one `docker build`. Build context MUST be the
# repo root (npm workspace), e.g. `docker build -f frontend/Dockerfile .`
# — this is what compose.yaml uses.
#
# CesiumJS assets and the workspace packages this app consumes
# (@cesium-ai/chat-element, @cesium-ai/tools-cesium, @cesium-ai/codegen-cesium,
# @cesium-ai/sample-config) are resolved via npm workspaces from the repo
# root, so the frontend image can't be built from the frontend/ folder alone.
# Only manifests for workspaces the frontend actually depends on are copied —
# npm ci is fine with the rest of the `workspaces` glob in the root
# package.json not resolving to anything on disk.
#
# VITE_API_BASE_URL and VITE_CESIUM_ION_ACCESS_TOKEN are baked into the client
# bundle at build time via build args (see below / compose.yaml), so they must
# be passed at `docker build` time — the image is tied to whatever backend /
# Ion token it was built with.

# ---- Stage 1: build ---------------------------------------------------------
FROM node:lts-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
COPY packages/tools-cesium/package.json packages/tools-cesium/package.json
COPY packages/chat-element/package.json packages/chat-element/package.json
COPY packages/codegen-cesium/package.json packages/codegen-cesium/package.json
RUN npm ci

COPY shared shared
COPY packages/tools-cesium packages/tools-cesium
COPY packages/chat-element packages/chat-element
COPY packages/codegen-cesium packages/codegen-cesium
COPY frontend frontend

# Config baked into the bundle at build time. VITE_API_BASE_URL defaults to ""
# so the app calls relative /api/chat (proxied by nginx to the backend).
ARG VITE_API_BASE_URL=""
ARG VITE_CESIUM_ION_ACCESS_TOKEN=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CESIUM_ION_ACCESS_TOKEN=$VITE_CESIUM_ION_ACCESS_TOKEN

# Not `npm run build:packages` — that script also builds @cesium-ai/server,
# which isn't checked out here (backend-only dependency).
RUN npm run build -w @cesium-ai/tools-cesium && npm run build -w @cesium-ai/codegen-cesium && npm run build -w @cesium-ai/sample-config && npm run build -w frontend

# ---- Stage 2: serve ----------------------------------------------------------
FROM nginx:1.27-alpine AS runner

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
