.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help install env setup dev dev-nodb dev-web dev-api dev-docs
.PHONY: db-init db-reset db-migrate db-seed db-generate db-pull db-push db-studio db-snapshot
.PHONY: build test lint typecheck check docs clean deploy

help:
	@echo "Raahi AI Makefile targets:"
	@echo ""
	@echo "Setup:"
	@echo "  make install         Install dependencies with pnpm"
	@echo "  make env             Create .env from .env.example if missing"
	@echo "  make setup           Setup: install + env (configure MONGO_URI)"
	@echo ""
	@echo "Development:"
	@echo "  make dev             Start Mongo-backed web + API dev servers"
	@echo "  make dev-nodb        Alias: start web + API"
	@echo "  make dev-web         Start Vite only (http://localhost:5170)"
	@echo "  make dev-api         Start API only (http://localhost:8780)"
	@echo "  make dev-docs        Start Fumadocs only (http://localhost:5171)"
	@echo ""

install:
	pnpm install

env: install
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	else \
		echo ".env already exists"; \
	fi

setup: install env
	@echo "Setup complete! Run 'make dev' to start development."

dev: env
	@echo "Starting web + api dev servers (Ctrl+C to stop)..."
	@echo "  web  → http://localhost:5170  (proxies /api to :8780)"
	@echo "  api  → http://localhost:8780"
	pnpm dev

dev-nodb: env
	@echo "Starting web + api dev servers with MongoDB (Ctrl+C to stop)..."
	pnpm dev

dev-web: env
	pnpm --filter @opentrip/web dev

dev-api: env
	pnpm --filter @opentrip/api dev

dev-docs:
	pnpm --filter @opentrip/docs dev

db-generate:
	pnpm --filter @opentrip/api db:generate

db-pull:
	pnpm --filter @opentrip/api db:pull

db-snapshot: db-pull
	@echo "Schema snapshot updated in apps/api/prisma/schema.prisma."

db-push:
	pnpm --filter @opentrip/api db:push

db-migrate:
	pnpm db:migrate

db-migrate-dev:
	pnpm --filter @opentrip/api db:migrate-dev

db-seed:
	pnpm db:seed

db-init: db-migrate db-seed
	@echo "Database initialized."

db-reset:
	pnpm db:reset

db-studio:
	pnpm db:studio

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

typecheck:
	pnpm typecheck

check:
	pnpm check

ui:
	pnpm ui:check

docs:
	pnpm docs:check

clean:
	rm -rf apps/web/dist
	rm -rf apps/docs/.next apps/docs/out apps/docs/public/assets
	@echo "Cleaned build artifacts."

deploy:
	@echo "Render deployment setup: deploy/render/README.md"
