#!/usr/bin/env bash
set -euo pipefail

# Load DATABASE_URL from .env if not present.
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f ".env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
  elif [[ -f "../.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "../.env"
    set +a
  fi
fi

shadow_url="${SHADOW_DATABASE_URL:-}"
shadow_db_name=""
admin_url=""

if [[ -z "${shadow_url}" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Either SHADOW_DATABASE_URL or DATABASE_URL is required." >&2
    exit 1
  fi

  # Derive a disposable shadow DB URL from DATABASE_URL by suffixing database name with _shadow.
  shadow_url="$(node -e 'const u=new URL(process.env.DATABASE_URL); const db=u.pathname.replace(/^\//,""); if(!db){process.exit(1)}; u.pathname="/"+db+"_shadow"; console.log(u.toString());')"
  shadow_db_name="$(node -e 'const u=new URL(process.env.DATABASE_URL); const db=u.pathname.replace(/^\//,""); process.stdout.write(db+"_shadow");')"
  admin_url="$(node -e 'const u=new URL(process.env.DATABASE_URL); u.pathname="/postgres"; console.log(u.toString());')"

  cleanup() {
    if [[ -n "${shadow_db_name}" ]]; then
      psql "${admin_url}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${shadow_db_name}\";" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT

  # Recreate shadow DB to ensure clean state.
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${shadow_db_name}\";" >/dev/null
  psql "${admin_url}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${shadow_db_name}\";" >/dev/null
fi

prisma validate
prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "${shadow_url}" \
  --exit-code

