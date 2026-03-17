.PHONY: setup setup-skip-keys setup-skip-db start dev build clean seed

## Run full first-time setup: generate RS256 keys, create DB, push Prisma schema
setup:
	@bash scripts/setup.sh

## Re-run setup but keep existing JWT keys
setup-skip-keys:
	@bash scripts/setup.sh --skip-keys

## Re-run setup but skip database creation (keys only)
setup-skip-db:
	@bash scripts/setup.sh --skip-db

## Start production build (kills any process on PORT first)
start:
	@lsof -ti:$${PORT:-3000} | xargs kill -9 2>/dev/null || true
	npm start

## Start dev server with hot-reload (kills any process on PORT first)
dev:
	@lsof -ti:$${PORT:-3000} | xargs kill -9 2>/dev/null || true
	npm run dev

## Compile TypeScript
build:
	npm run build

## Remove compiled output
clean:
	rm -rf dist

## Seed test organisation and print org access token
seed:
	npx ts-node --project tsconfig.json scripts/seed.ts

## Seed and reset (delete + recreate org)
seed-reset:
	npx ts-node --project tsconfig.json scripts/seed.ts --reset

import-lib:
	cp ../orki-connect-sdk/src/index.ts lib/orki-connect-sdk.ts
