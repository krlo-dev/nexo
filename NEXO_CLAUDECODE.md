# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: Nexo

SaaS MVP — appointment scheduling platform with social-network-style store profiles. Connects local entrepreneurs (service providers) with clients (service consumers). The codebase starts from zero; this document is the build spec.

**Stack:** React 18 + Vite · Node.js 20 / Express · PostgreSQL 15 · Ollama (`nomic-embed-text`) · Docker Compose

---

## Commands

All operations run via `make` (Docker Compose wrappers):

```bash
make dev        # Start dev environment (hot-reload, Vite dev server)
make stg        # Start staging (Nginx, no source mounts)
make prd        # Start production (optimized build, no db container)
make stop       # Stop containers (keep volumes)
make reset      # Stop and delete all volumes (data wipe)
make logs       # Stream all logs
make logs-backend
make logs-ai
make db-shell   # psql into the PostgreSQL container
make seed       # Run backend/scripts/seed.js
make status     # docker-compose ps
```

There are no test or lint scripts defined yet — add them to the respective `package.json` files when implementing each service.

---

## Architecture

### Container layout

```
docker-compose.yml            # Base config (4 services)
docker-compose.dev.yml        # Overrides: Vite dev server, nodemon, source mounts
docker-compose.stg.yml        # Overrides: Nginx, restart:unless-stopped, health checks
docker-compose.prd.yml        # Overrides: optimized build, db service removed (use RDS)
```

| Service | Role |
|---------|------|
| `frontend` | React + Vite (dev) / Nginx static (stg/prd) — port 3000 |
| `backend` | Express API — port 4000 |
| `ai-service` | Ollama with `nomic-embed-text` — port 11434 |
| `db` | PostgreSQL 15 — port 5432 (dev/stg only; prd uses `DB_HOST` env var pointing to RDS) |

The frontend never calls the AI service directly; all calls go through the backend.

### Backend code structure (`backend/src/`)

```
controllers/
services/
middlewares/
routes/
utils/
app.js
```

- **CommonJS only** (`require`/`module.exports`). No ES Modules.
- CORS is restricted to `FRONTEND_URL` env var.
- All API responses: `{ success: true, data: {...} }` or `{ success: false, error: "message" }`.
- Input validation: `express-validator`. Passwords: `bcrypt` (saltRounds: 10). Auth: JWT. Uploads: `multer`.
- DB access: `pg` connection pool.

### Frontend conventions

- **React Query** for all data fetching (no direct fetch in components).
- **React Hook Form + Zod** for all forms.
- **Axios** with a JWT interceptor that reads the token from `localStorage`.
- `<ProtectedRoute role="..." />` wraps all authenticated routes.
- Loading spinners use `--nexo-red`; error toasts use `--nexo-red`; success toasts use soft green.

---

## Branding & Design Tokens

```css
--nexo-red:        #E8223A   /* primary buttons, CTAs, active nav */
--nexo-red-dark:   #C41A2E   /* hover states */
--nexo-red-light:  #FDEAED   /* badge/pill backgrounds */
--nexo-red-mid:    #F26070   /* secondary icons */
--nexo-black:      #0F0F0F
--nexo-gray-dark:  #3D3D3D
--nexo-gray-mid:   #8A8A8A
--nexo-gray-light: #F5F5F5   /* page backgrounds */
--nexo-white:      #FFFFFF
--nexo-border:     #EBEBEB
--nexo-shadow:     0 2px 12px rgba(232, 34, 58, 0.08)
```

Typography: **Inter** (400/500/600/700). Border radius: 12px cards, 8px inputs, 999px pills.

Tailwind must extend with a `nexo` color namespace and `font-sans: ['Inter']` — see section 7 of the original spec.

---

## Database Schema

File: `infra/init.sql`. Requires `uuid-ossp` extension.

| Table | Key columns |
|-------|-------------|
| `users` | `id UUID`, `email`, `password_hash`, `role` (admin/emprendedor/cliente) |
| `stores` | `owner_id`, `slug` (unique), `category`, `tags TEXT[]`, `lat/lon`, `avg_rating`, `embedding TEXT` (JSON float array) |
| `services` | `store_id`, `duration_minutes`, `price`, `currency` (default COP) |
| `business_hours` | `store_id`, `day_of_week` (0=Monday–6=Sunday), `open_time`, `close_time`, `is_open` |
| `appointments` | `client_id`, `service_id`, `store_id`, `start_time`, `end_time`, `status`, `allow_reschedule` |
| `reviews` | `appointment_id UNIQUE` (one review per appointment), `rating` (1–5) |

Indexes: `appointments(store_id, start_time)`, `stores(category)`, `stores(lat, lon)`, `stores(is_active)`.

---

## API Endpoints

Base path: `/api`

| Group | Endpoints |
|-------|-----------|
| `/auth` | POST register, POST login, GET me |
| `/stores` | GET (public, filters: category/city/q), GET :slug, POST, PUT :id, DELETE :id |
| `/stores/:storeId/services` | GET, POST, PUT :id, DELETE :id |
| `/stores/:storeId/hours` | GET, PUT (full 7-day array), GET availability?date=&serviceId= |
| `/appointments` | GET (scoped by role), POST, PUT :id, DELETE :id, PATCH :id/status, PATCH :id/reschedule-toggle |
| `/reviews` | POST, GET store/:storeId |
| `/recommendations` | GET ?lat=&lon=&limit= (JWT required) |
| `/admin` | GET/PATCH users and stores |
| `/upload/image` | POST multipart — returns `{ url }` |

Uploads in dev/stg: saved to `/app/uploads`, served at `/static/`. In production: set `STORAGE_TYPE=s3`.

---

## Key Business Logic

### Availability slots (`services/availability.service.js`)

1. Look up `business_hours` for the requested day.
2. If `is_open = false` → return `[]`.
3. Split `open_time..close_time` into slots of `service.duration_minutes`.
4. Fetch appointments for that store/date where `status != 'cancelled'`.
5. Mark slots that overlap any existing appointment as unavailable.
6. Return `[{ start: "HH:MM", end: "HH:MM", available: boolean }]`.

### Appointment validation (create + reschedule)

- `start_time` must be in the future.
- Must fall within business hours for that day.
- Must not overlap existing appointments (`status != 'cancelled'`).
- `end_time = start_time + service.duration_minutes`.

### Cancellation / reschedule rules

- Client can **cancel** if: `status IN ('pending','confirmed')` AND `start_time > NOW() + 2 hours`.
- Client can **reschedule** if: above AND `allow_reschedule = true`.
- Entrepreneur can toggle `allow_reschedule` at any time.
- Completed appointments are immutable.

---

## AI Recommendation Engine (`services/recommendation.service.js`)

Embedding model: `nomic-embed-text` (768 dimensions) via Ollama at `http://ai-service:11434/api/embeddings`.

Text embedded per store: `"${name} ${category} ${tags.join(' ')} ${description}"`.

Embeddings stored as JSON text in `stores.embedding`. If Ollama is unavailable, catch the error and set `embedding = null`; those stores are excluded from recommendations.

**Score formula:**
```
score = 0.5 × cosine_similarity(user_history_embedding, store_embedding)
      + 0.3 × (store.avg_rating / 5)
      + 0.2 × (1 / (1 + haversine_km(user_lat_lon, store_lat_lon)))
```

User history embedding: generated from the categories of the user's past appointments.

Cosine similarity util lives in `backend/src/utils/cosine.js`.

---

## Environment Variables (`.env.example`)

```env
DB_HOST=db
DB_PORT=5432
DB_NAME=nexo
DB_USER=nexo_user
DB_PASSWORD=changeme_local

JWT_SECRET=super_secret_key_change_in_production
JWT_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

OLLAMA_URL=http://ai-service:11434

STORAGE_TYPE=local          # "local" or "s3"
S3_BUCKET=nexo-uploads
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

ADMIN_EMAIL=admin@nexo.app
ADMIN_PASSWORD=Admin1234!
```

---

## Implementation Order

Build in this exact sequence to avoid dependency issues:

1. Root config files: `docker-compose.yml`, all overrides, `Makefile`, `.env.example`
2. `infra/init.sql` — full DB schema
3. `backend/` — Express app, all routes, middlewares, services (including recommendation + availability)
4. `ai-service/` — `Dockerfile` + `entrypoint.sh` (starts Ollama and pulls `nomic-embed-text`)
5. `frontend/` — React app, Tailwind config, all routes and components
6. Service `Dockerfile`s (frontend and backend)
7. `backend/scripts/seed.js` — seed data (see below)
8. `README.md`

### Seed data (`backend/scripts/seed.js`)

- 1 admin (`admin@nexo.app` / `Admin1234!`)
- 3 entrepreneurs + stores: "Salón Valentina" (belleza/Bogotá), "Dr. Martínez Fisioterapia" (salud/Medellín), "TechFix Reparaciones" (tecnología/Cali)
- 5 client accounts
- Each store: 3 services, Mon–Sat 9:00–18:00 hours, Sunday closed
- Images: `https://picsum.photos/400/300?random=N`
- Embeddings: generate via Ollama if available, else 768-dimension zero array
- 10 appointments in mixed statuses, 8 reviews on completed appointments (ratings 3–5)

---

## AWS Deployment Reference (future phase)

The code is already AWS-ready via env vars. No code changes needed to deploy.

| Component | AWS Free Tier | Local |
|-----------|--------------|-------|
| Frontend | S3 + CloudFront | Nginx container |
| Backend | EC2 t2.micro | Node container |
| Database | RDS PostgreSQL t3.micro | PostgreSQL container |
| Images | S3 | Docker volume |
| Ollama | EC2 t2.micro (co-located with backend) | Ollama container |

To stop AWS resources without deleting: `aws ec2 stop-instances`, `aws rds stop-db-instance`. For full teardown: delete the CloudFormation stack.
