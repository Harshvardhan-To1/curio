# syntax=docker/dockerfile:1
# Multi-stage build. Set INSTALL_EMBEDDINGS=true to bundle the server-side
# embedding model deps for fat-server mode (heavy: onnxruntime-node).
ARG NODE_IMAGE=node:20-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package*.json ./
ARG INSTALL_EMBEDDINGS=false
RUN npm ci $( [ "$INSTALL_EMBEDDINGS" = "true" ] && echo "" || echo "--omit=optional" )

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
ARG INSTALL_EMBEDDINGS=false
RUN npm ci --omit=dev $( [ "$INSTALL_EMBEDDINGS" = "true" ] && echo "" || echo "--omit=optional" ) \
    && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8000
USER node
# Default command runs the API; the worker service overrides with dist/worker.js
CMD ["node", "dist/main.js"]
