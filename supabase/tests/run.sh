#!/usr/bin/env bash
# Migration'ları ve yetkilendirme testlerini boş bir PostgreSQL veritabanında
# çalıştırır. Kullanım:
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DB="look_test_$$"

createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$DIR/stubs.sql"
for migration in "$DIR"/../migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$migration"
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -o /dev/null -f "$DIR/rls_test.sql"
