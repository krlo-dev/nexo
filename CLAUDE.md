# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: Nexo

SaaS appointment scheduling platform for local businesses (Colombian market, prices in COP). Three roles: **admin**, **emprendedor** (store owner/service provider), **cliente** (consumer).

**Stack:** React 18 + Vite · Node.js 20 / Express · PostgreSQL 15 · Docker Compose

**AI layer:** GLM-5.1 via NVIDIA NIM API (`openai` SDK pointed at `NVIDIA_BASE_URL`). Agent reads context + skills + per-user memory from `agent/*.md` files before every LLM call. Ollama has been fully removed.

---

## Commands

All operations go through `make` (Docker Compose wrappers):

```bash
make dev          # Dev environment: Vite hot-reload (port 5173), nodemon backend
make stg          # Staging: Nginx (port 3000), built frontend, health checks
make prd          # Production: same as stg but no db container (expects RDS via DB_HOST)
make stop         # Stop containers, keep volumes
make reset        # Stop + delete all volumes (full data wipe)
make logs         # Stream all service logs
make logs-backend
make logs-ai
make db-shell     # psql into the running PostgreSQL container
make seed         # Populate DB via backend/scripts/seed.js
make status       # docker-compose ps
```

No test or lint scripts are configured yet. Add them to the respective `package.json` scripts when implementing.

**Ports (dev):** Frontend `5173`, Backend `4000`, Ollama `11434`, DB `5432`

**Seed credentials:**
- Admin: `admin@nexo.app` / `Admin1234!`
- Entrepreneurs: `valentina@nexo.app`, `carlos.martinez@nexo.app`, `andres.lopez@nexo.app` / `Emprendedor123!`
- Client: `cliente1@nexo.app` / `Cliente123!`

---

## Architecture

### Container layout

| Service | Dev | Stg/Prd |
|---------|-----|---------|
| `frontend` | Vite dev server (5173) | Nginx static (3000) |
| `backend` | nodemon (4000) | node src/app.js (4000) |
| `db` | PostgreSQL 15 (5432) | removed in prd (use RDS via `DB_HOST`) |

Compose files: `docker-compose.yml` (base), `docker-compose.dev.yml`, `docker-compose.stg.yml`, `docker-compose.prd.yml`. The `agent/` folder is bind-mounted into the backend container at `/app/agent` in all environments.

### Backend (`backend/src/`)

**CommonJS only** (`require`/`module.exports`) — no ES Modules.

```
app.js              ← Express bootstrap; mounts routes, CORS restricted to FRONTEND_URL, /static uploads
routes/             ← Express Router per resource
controllers/        ← Request handling + express-validator input validation
services/           ← Business logic (availability, recommendations, ollama embedding, chat)
middlewares/        ← auth.js (JWT verify), role.js (role guard)
utils/              ← db.js (pg pool), cosine.js (similarity), haversine.js (distance)
scripts/seed.js     ← One-time seed runner
```

**Response contract — always:**
```js
{ success: true, data: {...} }        // 200/201
{ success: false, error: "message" }  // 4xx/5xx
```

**DB access:** raw `pg` connection pool (`utils/db.js`). No ORM. All primary keys are UUIDs (`uuid-ossp`).

### API Routes

| Path | File |
|------|------|
| `/api/auth` | `routes/auth.routes.js` |
| `/api/stores` | `routes/stores.routes.js` |
| `/api/stores/:storeId/services` | `routes/services.routes.js` |
| `/api/stores/:storeId/hours` | `routes/hours.routes.js` |
| `/api/appointments` | `routes/appointments.routes.js` |
| `/api/reviews` | `routes/reviews.routes.js` |
| `/api/recommendations` | `routes/recommendations.routes.js` |
| `/api/admin` | `routes/admin.routes.js` |
| `/api/upload` | `routes/upload.routes.js` (multer, auth required) |
| `/api/agent/chat` | `routes/agent.js` — conversational agent (POST, JWT required) |
| `/api/agent/buscar-tiendas` | `routes/agent.js` — store search with progressive broadening (GET) |
| `/api/agent/disponibilidad` | `routes/agent.js` — available slots for storeId+serviceId+fecha (GET) |
| `/api/agent/agendar` | `routes/agent.js` — create appointment (POST) |
| `/api/agent/memoria` | `routes/agent.js` — read user memory file (GET, debug) |
| `/api/health` | Inline — returns `{ status: 'ok' }` |

Static uploads served at `/static` → `/app/uploads`.

### Frontend (`frontend/src/`)

```
main.jsx    ← React 18 root; wraps app in QueryClientProvider, BrowserRouter, Toaster
App.jsx     ← All routes; <ProtectedRoute role="..." /> guards authenticated pages
pages/      ← Route-level components grouped by role (public/, auth/, client/, entrepreneur/, admin/)
components/ ← Reusable UI: Navbar, StoreCard, AppointmentCard, BookingModal, ChatBot
lib/
  axios.js  ← Axios instance with JWT interceptor (reads token from localStorage)
  auth.js   ← JWT decode, expiration check, login/logout helpers
  api.js    ← Re-exports axios instance
```

**Data fetching:** React Query v5 for all server state — no direct `fetch` in components.
**Forms:** React Hook Form + Zod schemas.
**Auth token:** stored in `localStorage`, injected via Axios request interceptor.

---

## Key Business Logic

### Availability slots (`services/availability.service.js`)

1. Look up `business_hours` for the requested day.
2. `is_open = false` → return `[]`.
3. Split `open_time..close_time` into slots of `service.duration_minutes`.
4. Fetch appointments for that store/date where `status != 'cancelled'`.
5. Mark overlapping slots unavailable.
6. Return `[{ start: "HH:MM", end: "HH:MM", available: boolean }]`.

### Appointment constraints

- `start_time` must be in the future and within business hours.
- No overlap with existing appointments (`status != 'cancelled'`).
- `end_time = start_time + service.duration_minutes`.
- Client can cancel/reschedule only if `status IN ('pending','confirmed')` AND `start_time > NOW() + 2h`.
- Reschedule also requires `allow_reschedule = true` (toggled by entrepreneur).
- Completed appointments are immutable.

### Recommendation engine (`services/recommendation.service.js`)

Scoring is rating + distance only (Ollama semantic component removed):

```
score = 0.3 × (avg_rating / 5)
      + 0.2 × (1 / (1 + haversine_km(user_lat_lon, store_lat_lon)))
```

All active stores are included regardless of whether they have an `embedding` value. The `stores.embedding` column remains in the DB schema for forward-compatibility.

### Agent (`services/agentService.js`, `routes/agent.js`)

Before every LLM call, `agentService.js` builds a system prompt from three layers read off disk:
1. `agent/context/NEXO_AGENT.md` — agent role, capabilities, mandatory process
2. `agent/memory/{userId}.md` — per-user persistent memory (created on first interaction)
3. `agent/skills/*.md` — all skill files sorted alphabetically

The LLM response always ends with a `[MEMORIA_ACTUALIZADA]...[/MEMORIA_ACTUALIZADA]` block that `agentService` extracts, saves to `agent/memory/{userId}.md`, and strips before returning the clean reply to the client.

**Skills loaded (in alphabetical order):**
- `skill_agendar_cita.md` — slot lookup + appointment creation flow
- `skill_aprender.md` — when/what to persist to memory (runs after every response)
- `skill_buscar_tiendas.md` — progressive search via `GET /api/agent/buscar-tiendas`
- `skill_interpretar_intencion.md` — semantic intent resolution (runs first, every message)
- `skill_recomendar.md` — proactive recommendations based on history

Frontend: `<AgentChat />` fixed floating button (bottom-right), 380×520px panel. Hidden on `/auth` and `/admin` routes. Sends `history` array (last 10 messages as `{role, content}`) on each request for multi-turn context.

---

## Database Schema Quick Reference

`infra/init.sql` (PostgreSQL 15, requires `uuid-ossp`):

| Table | Notable columns |
|-------|----------------|
| `users` | `role` ENUM: admin / emprendedor / cliente; `avatar_url TEXT` |
| `stores` | `slug` UNIQUE, `tags TEXT[]`, `lat/lon DECIMAL`, `embedding TEXT` (JSON float array), `banner_url TEXT` |
| `services` | `duration_minutes INT`, `price DECIMAL`, `currency` default `'COP'`, `images TEXT[]`, `description TEXT` |
| `business_hours` | `day_of_week` 0=Monday–6=Sunday; UNIQUE(`store_id`, `day_of_week`) |
| `appointments` | `status`: pending / confirmed / cancelled / completed / rescheduled; `allow_reschedule BOOLEAN`; `notes TEXT`; `cancel_reason TEXT` |
| `reviews` | `appointment_id UNIQUE` (one review per appointment), `rating` 1–5, `comment TEXT` |

Key indexes: `appointments(store_id, start_time)`, `appointments(client_id)`, `stores(category)`, `stores(is_active)`, `stores(lat, lon)`.

---

## Branding Tokens

```css
--nexo-red:        #E8223A   /* primary buttons, CTAs, active nav, spinners, chatbot UI */
--nexo-red-dark:   #C41A2E   /* hover */
--nexo-red-light:  #FDEAED   /* badge/pill backgrounds, bot message bubbles */
--nexo-black:      #0F0F0F
--nexo-gray-light: #F5F5F5   /* page backgrounds */
--nexo-border:     #EBEBEB
--nexo-shadow:     0 2px 12px rgba(232, 34, 58, 0.08)
```

Typography: **Inter** (400/500/600/700). Border radius: 12px cards, 8px inputs, 999px pills.
Tailwind uses a `nexo` color namespace extending these tokens (`tailwind.config.js`).

---

## Environment Variables

Copy `.env.example` to `.env` before running:

```env
DB_HOST=db                         # Container name (dev/stg) or RDS endpoint (prd)
JWT_SECRET=...                     # HS256 signing secret
STORAGE_TYPE=local                 # "local" (Docker volume) or "s3"
FRONTEND_URL=http://localhost:3000 # CORS origin
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
GLM_MODEL=z-ai/glm-5.1
AGENT_MD_PATH=./agent              # resolves to /app/agent inside the container
```

In production: set `DB_HOST` to the RDS endpoint and `STORAGE_TYPE=s3` with S3 credentials.

---

## Git Workflow

Branch structure:
- `main` — production-stable, no direct commits
- `develop` — active development; all feature branches merge here

```bash
git checkout develop
git checkout -b feature/nombre-del-feature
# ... commit, then PR → develop
```

Commit convention: `feat:` / `fix:` / `docs:` / `style:` / `refactor:` / `chore:`

The `NEXO_*.md` spec files and `.claude/` are listed in `.gitignore` — they exist locally but are excluded from the public repo. `CLAUDE.md` is tracked.
