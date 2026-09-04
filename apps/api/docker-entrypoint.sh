#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "SEED_ON_START=true — seeding demo data (idempotent, safe on every restart)..."
  npm run prisma:seed
fi

exec node dist/main.js
