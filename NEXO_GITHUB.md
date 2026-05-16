# Nexo — Preparación para GitHub Público

> **Propósito:** Preparar el repositorio de Nexo para publicación pública en GitHub. Esto incluye limpiar archivos sensibles, mejorar el .gitignore, crear la estructura de ramas main/develop, y asegurar que no quede ninguna credencial ni rastro de IA visible.

---

## 1. Actualizar `.gitignore`

Reemplazar el contenido actual del `.gitignore` con este:

```gitignore
# ── Entorno ────────────────────────────────────────────
.env
.env.local
.env.development
.env.production
.env.staging
.env.*.local

# ── Dependencias ───────────────────────────────────────
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# ── Builds ─────────────────────────────────────────────
dist/
build/
.next/
out/

# ── Logs ───────────────────────────────────────────────
*.log
logs/
npm-debug.log*
yarn-debug.log*

# ── Uploads y archivos de usuario ──────────────────────
uploads/
*.tmp
*.temp

# ── Docker ─────────────────────────────────────────────
docker-compose.override.yml

# ── Herramientas de desarrollo ─────────────────────────
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
*.swo

# ── Claude Code (herramienta interna de desarrollo) ────
.claude/
NEXO_CLAUDECODE.md
NEXO_CHATBOT.md
NEXO_CHATBOT_FIX.md
NEXO_CHATBOT_THRESHOLD.md
CLAUDE

# ── Ollama (modelos de IA locales, muy pesados) ─────────
ollama_models/
*.gguf
*.bin

# ── Misceláneos ────────────────────────────────────────
*.pem
*.key
*.cert
*.p12
coverage/
.nyc_output/
```

---

## 2. Actualizar `README.md`

Reemplazar el contenido actual del `README.md` con este, que describe el proyecto de forma profesional sin mencionar IA ni Claude Code:

```markdown
# Nexo

Plataforma de agendamiento de citas para negocios locales. Conecta emprendedores con clientes a través de perfiles de tienda estilo red social.

## Características

- Perfiles de tienda con banner, avatar, servicios y reseñas
- Agendamiento de citas con verificación de disponibilidad en tiempo real
- Tres roles: administrador, emprendedor y cliente
- Búsqueda semántica de servicios por lenguaje natural
- Asistente de búsqueda integrado
- Sistema de reseñas y valoraciones

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express + JWT
- **Base de datos:** PostgreSQL 15
- **IA:** Ollama (nomic-embed-text + qwen2.5)
- **Contenedores:** Docker + Docker Compose

## Requisitos

- Docker Desktop instalado y corriendo
- Git

## Instalación y ejecución local

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/nexo.git
cd nexo

# 2. Crear archivo de entorno
cp .env.example .env

# 3. Levantar todos los servicios
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

La primera vez tarda varios minutos porque descarga los modelos de IA (~700MB).

Una vez levantado:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Documentación API: http://localhost:4000/api

## Cargar datos de prueba

```bash
docker compose exec backend node scripts/seed.js
```

Usuarios de prueba creados:
- Admin: `admin@nexo.app` / `Admin1234!`
- Emprendedor: `valentina@nexo.app` / `Emprendedor123!`
- Cliente: `cliente1@nexo.app` / `Cliente123!`

## Entornos

| Entorno | Comando | Descripción |
|---|---|---|
| Desarrollo | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` | Hot reload activo |
| Staging | `docker compose -f docker-compose.yml -f docker-compose.stg.yml up -d` | Build optimizado |
| Producción | `docker compose -f docker-compose.yml -f docker-compose.prd.yml up -d` | Sin DB local, apunta a RDS |

## Apagar los servicios

```bash
docker compose down
```

## Variables de entorno

Copiar `.env.example` a `.env` y configurar los valores según el entorno. Ver `.env.example` para referencia completa.

## Licencia

MIT
```

---

## 3. Verificar que `.env.example` no tenga credenciales reales

Revisar el archivo `.env.example` y asegurarse de que:
- `JWT_SECRET` diga exactamente `your_jwt_secret_here_change_in_production`
- `ADMIN_PASSWORD` diga exactamente `change_this_password`
- `DB_PASSWORD` diga exactamente `changeme_local`
- `AWS_ACCESS_KEY_ID` esté vacío
- `AWS_SECRET_ACCESS_KEY` esté vacío

Si alguno tiene un valor diferente a los anteriores, reemplazarlo con el valor seguro indicado arriba.

El `.env.example` final debe quedar así:

```env
# ── Base de datos ───────────────────────────────────────
DB_HOST=db
DB_PORT=5432
DB_NAME=nexo
DB_USER=nexo_user
DB_PASSWORD=changeme_local

# ── Backend ────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── IA (Ollama) ────────────────────────────────────────
OLLAMA_URL=http://ai-service:11434

# ── Storage ────────────────────────────────────────────
# Opciones: "local" para desarrollo, "s3" para producción
STORAGE_TYPE=local
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# ── Seed inicial ───────────────────────────────────────
ADMIN_EMAIL=admin@nexo.app
ADMIN_PASSWORD=change_this_password
```

---

## 4. Crear archivo `CONTRIBUTING.md`

Crear el archivo `CONTRIBUTING.md` en la raíz con este contenido:

```markdown
# Contribuir a Nexo

## Ramas

- `main` — rama de producción, código estable
- `develop` — rama de desarrollo activo

Toda contribución debe hacerse desde `develop`. No hacer commits directos a `main`.

## Flujo de trabajo

```bash
# Crear rama para tu feature
git checkout develop
git checkout -b feature/nombre-del-feature

# Hacer cambios y commit
git add .
git commit -m "feat: descripción del cambio"

# Push y Pull Request hacia develop
git push origin feature/nombre-del-feature
```

## Convención de commits

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` cambios en documentación
- `style:` cambios de formato
- `refactor:` refactorización de código
- `chore:` tareas de mantenimiento

## Variables de entorno

Nunca commitear archivos `.env`. Usar siempre `.env.example` como referencia.
```

---

## 5. Instrucciones para Claude Code

Implementar en este orden:

1. Reemplazar `.gitignore` con el contenido de la sección 1
2. Reemplazar `README.md` con el contenido de la sección 2
3. Verificar y corregir `.env.example` según la sección 3
4. Crear `CONTRIBUTING.md` con el contenido de la sección 4
5. **NO tocar** ningún archivo de código fuente (backend, frontend, ai-service, infra)
6. **NO eliminar** físicamente los archivos `.md` de Claude — el `.gitignore` los excluirá automáticamente de Git

---

## 6. Pasos manuales después de que Claude Code termine

Estos pasos los harás tú en la terminal, NO los hace Claude Code:

```bash
# 1. Inicializar Git en el proyecto (si no está inicializado)
git init

# 2. Agregar todos los archivos respetando el .gitignore
git add .

# 3. Verificar que ningún archivo sensible está siendo trackeado
# Este comando debe NO mostrar: .env, archivos .md de Claude, carpeta .claude
git status

# 4. Commit inicial
git commit -m "feat: initial commit — Nexo MVP"

# 5. Crear rama develop
git checkout -b develop

# 6. Push a GitHub (reemplazar con tu usuario y nombre de repo)
git remote add origin https://github.com/TU_USUARIO/nexo.git
git push -u origin main
git push -u origin develop
```

**IMPORTANTE antes del paso 2:** Si `git status` muestra el archivo `.env` o cualquier archivo con credenciales, detener inmediatamente y no hacer commit hasta resolverlo.

---

*Nexo GitHub Setup v1.0.0*
