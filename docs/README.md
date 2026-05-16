# Nexo — Documentación Técnica

Nexo es una plataforma SaaS de agendamiento de citas para negocios locales en Colombia, con búsqueda semántica por lenguaje natural y un asistente de IA integrado.

---

## Documentos disponibles

| # | Archivo | ¿Qué cubre? | ¿Cuándo leerlo? |
|---|---------|-------------|-----------------|
| 01 | [Arquitectura General](./01-arquitectura.md) | Los 4 contenedores, los 3 entornos, la arquitectura en AWS | Primero, siempre — da el panorama completo |
| 02 | [Docker desde Cero](./02-docker.md) | Imágenes, contenedores, Dockerfiles, Compose, volúmenes | Antes de tocar cualquier comando `docker` |
| 03 | [Backend — Node.js y Express](./03-backend.md) | Rutas, controladores, servicios, JWT, disponibilidad, chatbot | Cuando vayas a trabajar en la API |
| 04 | [Frontend — React y Vite](./04-frontend.md) | Routing, autenticación, React Query, formularios, diseño | Cuando vayas a trabajar en la UI |
| 05 | [Base de Datos — PostgreSQL](./05-base-de-datos.md) | Tablas, relaciones, índices, embeddings, seed | Cuando necesites entender el modelo de datos |
| 06 | [Sistema de IA — Ollama](./06-ia.md) | Embeddings, similitud coseno, chatbot, umbral 0.60 | Cuando vayas a tocar el chatbot o recomendaciones |
| 07 | [Despliegue en AWS](./07-despliegue-aws.md) | ECS, RDS, S3, CloudFormation, costos Free Tier | Cuando estés listo para publicar en producción |

---

## Guía de lectura recomendada

**Si eres nuevo en Docker:**
→ Empieza por el [02 — Docker desde Cero](./02-docker.md), luego el [01 — Arquitectura](./01-arquitectura.md), y después sigue en orden.

**Si ya sabes Docker pero no conoces el proyecto:**
→ Empieza por el [01 — Arquitectura](./01-arquitectura.md) y luego ve directamente al documento del área que te interesa (backend, frontend, DB, IA).

**Si quieres desplegar en AWS:**
→ Lee el [01 — Arquitectura](./01-arquitectura.md) y luego ve directo al [07 — Despliegue AWS](./07-despliegue-aws.md).

---

## Levantar el proyecto en 3 pasos

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# 2. Levantar todo (primera vez tarda ~5 min descargando modelos de IA)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# 3. En otra terminal, cargar datos de prueba
docker compose exec backend node scripts/seed.js
```

Frontend en http://localhost:5173 · API en http://localhost:4000
