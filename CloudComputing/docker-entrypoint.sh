#!/bin/sh
set -e

# jaga-jaga first boot: kalau belum ada file migration, lanjut tanpa deploy
if [ -d prisma/migrations ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "No prisma/migrations found — skipping migrate deploy"
fi

exec node server.js
