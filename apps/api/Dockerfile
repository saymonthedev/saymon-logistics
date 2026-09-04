# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN apk add --no-cache openssl

FROM base AS builder
WORKDIR /repo
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace=apps/api --include-workspace-root
COPY apps/api apps/api
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

# Runtime image keeps devDependencies (ts-node, prisma CLI) so the demo
# seed — which the docker-entrypoint runs when SEED_ON_START=true — can
# execute; this is a small/local deployment, not a size-optimized prod image.
FROM base AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/node_modules node_modules
COPY --from=builder /repo/apps/api apps/api

WORKDIR /repo/apps/api
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
