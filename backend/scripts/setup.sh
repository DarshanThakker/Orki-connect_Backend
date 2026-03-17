#!/usr/bin/env bash
# ─── Orki Connect — One-shot environment setup ────────────────────────────────
# Usage:
#   ./scripts/setup.sh              # full setup (keys + DB)
#   ./scripts/setup.sh --skip-keys  # skip key generation (reuse existing)
#   ./scripts/setup.sh --skip-db    # skip database creation
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
KEYS_DIR="$BACKEND_DIR/.keys"

SKIP_KEYS=false
SKIP_DB=false
for arg in "$@"; do
  case $arg in
    --skip-keys) SKIP_KEYS=true ;;
    --skip-db)   SKIP_DB=true  ;;
  esac
done

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[setup]${NC} $*"; }
warn()    { echo -e "${YELLOW}[setup]${NC} $*"; }
error()   { echo -e "${RED}[setup]${NC} $*" >&2; exit 1; }

# ── Dependency checks ──────────────────────────────────────────────────────────
command -v openssl >/dev/null 2>&1 || error "openssl is required but not installed."
command -v node    >/dev/null 2>&1 || error "node is required but not installed."
command -v npx     >/dev/null 2>&1 || error "npx is required but not installed."

# ── Ensure .env exists ─────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$BACKEND_DIR/.env.example" ]; then
    cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
    info "Created .env from .env.example"
  else
    error ".env not found and no .env.example to copy from."
  fi
fi

# ── Helper: update or add a key in .env ───────────────────────────────────────
# Uses Python to safely handle values with slashes, newlines, and special chars.
set_env() {
  local key="$1"
  local value="$2"
  python3 - "$ENV_FILE" "$key" "$value" <<'PYEOF'
import sys, re

env_file, key, value = sys.argv[1], sys.argv[2], sys.argv[3]

with open(env_file, 'r') as f:
    lines = f.readlines()

pattern = re.compile(r'^' + re.escape(key) + r'=.*\n?$')
new_line = f"{key}={value}\n"
found = False

for i, line in enumerate(lines):
    if pattern.match(line):
        lines[i] = new_line
        found = True
        break

if not found:
    lines.append(new_line)

with open(env_file, 'w') as f:
    f.writelines(lines)
PYEOF
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. RS256 KEY PAIR
# ─────────────────────────────────────────────────────────────────────────────
if [ "$SKIP_KEYS" = false ]; then
  info "Generating RS256 key pair…"
  mkdir -p "$KEYS_DIR"

  # Generate 2048-bit RSA private key
  openssl genrsa -out "$KEYS_DIR/private.pem" 2048 2>/dev/null
  # Derive public key
  openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem" 2>/dev/null

  info "Keys written to $KEYS_DIR/"

  # ── Write paths to .env (jwt.service.ts reads the file at runtime) ──────────
  # Paths are relative to the backend directory (where the process runs from)
  set_env "JWT_PRIVATE_KEY" ".keys/private.pem"
  set_env "JWT_PUBLIC_KEY"  ".keys/public.pem"

  # ── Extract RSA modulus in base64url (for JWKS n value) ───────────────────
  # openssl outputs hex modulus; convert to binary then base64url
  MODULUS_HEX=$(openssl rsa -pubin -in "$KEYS_DIR/public.pem" -modulus -noout 2>/dev/null | sed 's/Modulus=//')
  # Strip leading zero byte that openssl sometimes prepends for sign bit
  MODULUS_HEX=$(echo "$MODULUS_HEX" | sed 's/^00//')
  JWKS_N=$(printf '%s' "$MODULUS_HEX" | xxd -r -p | base64 | tr '+/' '-_' | tr -d '=\n')

  # ── Extract RSA public exponent in base64url (for JWKS e value) ────────────
  EXPONENT_DEC=$(openssl rsa -pubin -in "$KEYS_DIR/public.pem" -text -noout 2>/dev/null \
    | grep "Exponent:" | grep -oE '[0-9]+' | head -1)
  # Convert decimal exponent to hex, then binary, then base64url
  EXPONENT_HEX=$(printf '%x' "$EXPONENT_DEC")
  # Ensure even length
  [ $((${#EXPONENT_HEX} % 2)) -eq 1 ] && EXPONENT_HEX="0$EXPONENT_HEX"
  JWKS_E=$(printf '%s' "$EXPONENT_HEX" | xxd -r -p | base64 | tr '+/' '-_' | tr -d '=\n')

  set_env "JWKS_PUBLIC_KEY_N" "$JWKS_N"
  set_env "JWKS_PUBLIC_KEY_E" "$JWKS_E"

  info "JWT keys written to .env"
  info "  Modulus (n): ${JWKS_N:0:32}…"
  info "  Exponent (e): $JWKS_E"
else
  warn "Skipping key generation (--skip-keys)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. DATABASE SETUP
# ─────────────────────────────────────────────────────────────────────────────
if [ "$SKIP_DB" = false ]; then
  command -v psql >/dev/null 2>&1 || error "psql is required for database setup. Install PostgreSQL client tools."

  # Read DATABASE_URL from .env
  DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
  [ -z "$DATABASE_URL" ] && error "DATABASE_URL is not set in .env"

  # Parse components from postgresql://user:pass@host:port/dbname
  DB_REGEX='^postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)$'
  if [[ "$DATABASE_URL" =~ $DB_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
  else
    error "Could not parse DATABASE_URL. Expected: postgresql://user:pass@host:port/dbname"
  fi

  info "Database: $DB_NAME on $DB_HOST:$DB_PORT (user: $DB_USER)"

  # Connect to postgres database to create the target db
  ADMIN_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/postgres"

  # Create role if it doesn't exist
  info "Ensuring database user '$DB_USER' exists…"
  PGPASSWORD="$DB_PASS" psql "$ADMIN_URL" \
    -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN CREATE ROLE \"${DB_USER}\" LOGIN PASSWORD '${DB_PASS}'; END IF; END \$\$;" \
    >/dev/null 2>&1 || warn "Could not create role (may already exist or need superuser)"

  # Create database if it doesn't exist
  info "Ensuring database '$DB_NAME' exists…"
  DB_EXISTS=$(PGPASSWORD="$DB_PASS" psql "$ADMIN_URL" -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" 2>/dev/null || echo "")

  if [ "$DB_EXISTS" = "1" ]; then
    warn "Database '$DB_NAME' already exists — skipping creation"
  else
    PGPASSWORD="$DB_PASS" psql "$ADMIN_URL" \
      -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";" >/dev/null
    info "Database '$DB_NAME' created"
  fi

  # ── Run Prisma schema push ─────────────────────────────────────────────────
  info "Pushing Prisma schema to database…"
  cd "$BACKEND_DIR"
  DATABASE_URL="$DATABASE_URL" npx prisma db push 2>&1 | sed "s/^/  /"

  info "Generating Prisma client…"
  DATABASE_URL="$DATABASE_URL" npx prisma generate 2>&1 | tail -3 | sed "s/^/  /"
else
  warn "Skipping database setup (--skip-db)"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Setup complete.${NC}"
echo ""
echo "  Next steps:"
echo "    make start          — start the API server"
echo "    make start          — or: cd backend && npm run dev"
echo ""
echo "  Keys stored at:  $KEYS_DIR/"
echo "  Config file:     $ENV_FILE"
echo ""
