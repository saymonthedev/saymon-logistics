# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /repo
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=apps/web --include-workspace-root
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
