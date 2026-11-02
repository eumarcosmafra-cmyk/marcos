# Painel editorial MAFRA LABS — imagem de produção (Next.js standalone)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ARG GIT_COMMIT=desconhecido
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PAINEL_COMMIT=$GIT_COMMIT
RUN addgroup -S painel && adduser -S -G painel painel
COPY --from=build --chown=painel:painel /app/.next/standalone ./
COPY --from=build --chown=painel:painel /app/.next/static ./.next/static
COPY --from=build /app/scripts/hash-senha.mjs ./scripts/hash-senha.mjs
USER painel
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
