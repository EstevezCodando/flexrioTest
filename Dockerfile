# Rio Flex — imagem única: API (Express + SQLite) servindo o frontend compilado na mesma origem.
# Build:  docker build -t rioflex .
# Run:    docker run -p 8080:8080 -v rioflex-data:/data --env-file deploy/aws/rioflex.env rioflex

# ---------- 1. dependências e build do frontend ----------
FROM node:24-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN npm install -g pnpm@10.34.5 && pnpm --version
WORKDIR /app

# Manifestos primeiro: a camada de dependências só é refeita quando eles mudam.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/rio-flex/package.json artifacts/rio-flex/
RUN pnpm install --frozen-lockfile

COPY lib lib
COPY scripts scripts
COPY artifacts artifacts
RUN pnpm --filter @workspace/rio-flex run build \
 && pnpm --filter @workspace/api-server run typecheck \
 && rm -rf artifacts/api-server/data/*.db* artifacts/rio-flex/src artifacts/rio-flex/node_modules/.vite

# ---------- 2. runtime ----------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/rioflex.db \
    WEB_DIST=/app/artifacts/rio-flex/dist \
    LOG_LEVEL=info
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/artifacts/api-server ./artifacts/api-server
COPY --from=build --chown=node:node /app/artifacts/rio-flex/dist ./artifacts/rio-flex/dist
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/artifacts/api-server
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# tsx executa o TypeScript direto (o mesmo código validado pelo typecheck no build).
CMD ["node", "--import", "tsx", "src/index.ts"]
