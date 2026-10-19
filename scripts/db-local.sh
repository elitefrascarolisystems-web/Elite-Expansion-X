#!/usr/bin/env bash
# Cria ou atualiza o banco D1 local usado pelo `npm run dev` (fica em .wrangler/state).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "${root}/.wrangler"
config="${root}/.wrangler/db-local.json"

# Mesmo banco que o vite.config.ts declara para o desenvolvimento local.
cat > "${config}" <<JSON
{"name":"elite-expansion-x","compatibility_date":"2026-05-15",
 "d1_databases":[{"binding":"DB","database_name":"site-creator-d1","database_id":"00000000-0000-4000-8000-000000000000","migrations_dir":"${root}/drizzle"}]}
JSON

cd "${root}"
yes | npx wrangler d1 migrations apply DB --local -c "${config}" --persist-to .wrangler/state
