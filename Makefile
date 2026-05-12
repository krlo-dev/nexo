# ── Development ─────────────────────────────────────────
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# ── Staging ──────────────────────────────────────────────
stg:
	docker-compose -f docker-compose.yml -f docker-compose.stg.yml up -d --build

# ── Production ───────────────────────────────────────────
prd:
	docker-compose -f docker-compose.yml -f docker-compose.prd.yml up -d --build

# ── Stop (keep volumes) ───────────────────────────────────
stop:
	docker-compose down

# ── Reset (wipe all volumes) ──────────────────────────────
reset:
	docker-compose down -v

# ── Logs ──────────────────────────────────────────────────
logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-ai:
	docker-compose logs -f ai-service

# ── Database ──────────────────────────────────────────────
db-shell:
	docker-compose exec db psql -U nexo_user -d nexo

# ── Seed ──────────────────────────────────────────────────
seed:
	docker-compose exec backend node scripts/seed.js

# ── Status ────────────────────────────────────────────────
status:
	docker-compose ps

.PHONY: dev stg prd stop reset logs logs-backend logs-ai db-shell seed status
