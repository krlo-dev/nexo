# Nexo

SaaS de agendamiento de citas para negocios locales.

## Requisitos

- Docker & Docker Compose
- make

## Levantar en desarrollo

```bash
cp .env.example .env
make dev
```

El frontend estará en `http://localhost:5173` y el backend en `http://localhost:4000`.

La primera vez que levantes, el ai-service descargará el modelo `nomic-embed-text` (~270MB). Espera a que aparezca `success` en los logs antes de usar recomendaciones:

```bash
make logs-ai
```

## Cargar datos de prueba

```bash
make seed
```

**Cuentas creadas por el seed:**

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@nexo.app | Admin1234! |
| Emprendedor | valentina@nexo.app | Emprendedor123! |
| Emprendedor | martinez@nexo.app | Emprendedor123! |
| Emprendedor | techfix@nexo.app | Emprendedor123! |
| Cliente | cliente1@nexo.app | Cliente123! |

## Comandos disponibles

```bash
make dev          # Desarrollo (hot-reload)
make stg          # Staging
make prd          # Producción
make stop         # Parar contenedores
make reset        # Parar + borrar volúmenes
make logs         # Logs en tiempo real
make db-shell     # psql interactivo
make seed         # Insertar datos de prueba
make status       # Estado de contenedores
```

## Estructura

```
nexo/
├── frontend/     # React 18 + Vite + Tailwind
├── backend/      # Node.js + Express API
├── ai-service/   # Ollama (nomic-embed-text)
├── infra/        # Schema SQL
└── docker-compose*.yml
```

## Despliegue en producción (AWS)

Cambia las variables de entorno en `.env` para apuntar a RDS y S3:

```env
DB_HOST=<rds-endpoint>
STORAGE_TYPE=s3
S3_BUCKET=<tu-bucket>
```

Luego: `make prd`
