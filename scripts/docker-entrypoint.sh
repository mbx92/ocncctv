#!/bin/sh
set -e
echo "[OCN] Menjalankan migrasi…"
node scripts/migrate.js
echo "[OCN] Menjalankan server…"
exec node .output/server/index.mjs
