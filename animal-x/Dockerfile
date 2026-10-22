# Animal X — imagem de produção.
# Debian 13 (trixie) traz o cliente do PostgreSQL 17, usado nos backups.
FROM node:22-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY content ./content
COPY scripts ./scripts
COPY server ./server
COPY web ./web
RUN npm run build && npm prune --omit=dev

FROM node:22-trixie-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production ANIMALX_HOST=0.0.0.0 ANIMALX_PORTA=4310 ANIMALX_DADOS=/dados ANIMALX_BACKUPS=/dados/backups
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY content ./content
COPY scripts ./scripts
COPY server ./server
COPY package.json ./
RUN mkdir -p /dados && chown node:node /dados
USER node
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4310/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/main.js"]
