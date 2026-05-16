# 02 — Docker desde Cero

## ¿Qué problema resuelve Docker?

Seguramente has escuchado la frase: **"en mi máquina funciona"**. Es el problema más clásico del desarrollo de software. El código funciona perfectamente en tu laptop, pero cuando lo subes al servidor o se lo pasas a otro desarrollador, falla misteriosamente — porque el servidor tiene una versión diferente de Node.js, o le falta una librería, o tiene una configuración distinta del sistema operativo.

Piénsalo como una planta con tierra específica. Si tienes una orquídea que necesita tierra con pH 5.5, turba y perlita, y la trasplasas a un jardín con tierra arcillosa... se muere. La planta (tu código) necesita un entorno muy específico para vivir.

Docker resuelve esto empaquetando **el código junto con todo su entorno**: la versión exacta de Node.js, las librerías del sistema, la configuración. Donde sea que ejecutes ese paquete, siempre tendrá exactamente el mismo entorno.

---

## Tres conceptos fundamentales

### Imagen — la receta

Una imagen Docker es como una **receta de cocina**. Describe exactamente cómo preparar el entorno: qué sistema operativo base usar, qué dependencias instalar, qué archivos copiar, qué comando ejecutar al inicio. La imagen es un archivo estático — no se ejecuta, no consume recursos, solo existe en disco.

### Contenedor — la receta ejecutada

Un contenedor es la **receta ejecutada**: un proceso corriendo en aislamiento con su propio sistema de archivos, red y recursos. A partir de la misma imagen puedes crear 10 contenedores idénticos, igual que puedes cocinar 10 platos del mismo libro de recetas.

### Dockerfile — donde escribes la receta

El `Dockerfile` es el archivo de texto donde escribes las instrucciones para construir una imagen.

```
Dockerfile  →  (docker build)  →  Imagen  →  (docker run)  →  Contenedor
  receta          hornear          plato           servir          mesa
```

---

## El Dockerfile del backend de Nexo — línea por línea

Este es el `backend/Dockerfile` real del proyecto:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "src/app.js"]
```

Vamos línea por línea:

**`FROM node:20-alpine`**
Empieza con la imagen oficial de Node.js versión 20 sobre Alpine Linux. `alpine` es una distribución Linux ultraligera de ~5MB (vs ~900MB de Ubuntu). Para un servidor que solo necesita correr Node.js, Ubuntu sería como comprar un camión para llevar una caja.

**`WORKDIR /app`**
Establece `/app` como el directorio de trabajo dentro del contenedor. Todos los comandos siguientes se ejecutarán desde ahí. Si la carpeta no existe, Docker la crea.

**`COPY package*.json ./`**
Copia `package.json` y `package-lock.json` al contenedor. ¿Por qué solo estos archivos y no todo el código todavía? Aquí viene un truco importante:

> 💡 **Tip — El truco del caché de Docker:** Docker construye imágenes en capas. Cada instrucción (`FROM`, `COPY`, `RUN`) es una capa. Si una capa no cambió desde el último build, Docker la reutiliza del caché en lugar de ejecutarla de nuevo. Al copiar solo `package.json` primero, la capa del `npm install` solo se invalida cuando cambian las dependencias — no cada vez que modificas un `.js`. En la práctica: si cambias `src/controllers/chat.controller.js`, Docker reutiliza la capa del `npm install` y el rebuild tarda segundos en lugar de minutos.

**`RUN npm ci --omit=dev`**
Instala exactamente las dependencias del `package-lock.json`. `--omit=dev` excluye las dependencias de desarrollo (`nodemon`, etc.) porque en producción no las necesitas. `npm ci` es más estricto que `npm install` — falla si el lock file no está sincronizado con `package.json`, lo que garantiza builds reproducibles.

**`COPY . .`**
Ahora sí copia todo el código fuente. Esto va después del `npm install` por el truco del caché explicado arriba.

**`EXPOSE 4000`**
Documenta que el contenedor escucha en el puerto 4000. No abre el puerto por sí solo — es como un cartel informativo. El puerto se abre realmente en `docker-compose.yml` con `ports: "4000:4000"`.

**`CMD ["node", "src/app.js"]`**
El comando que se ejecuta cuando el contenedor arranca. En producción, Node.js directo — sin nodemon, sin reloads automáticos.

---

## Dockerfile.dev vs Dockerfile — las diferencias

| Aspecto | `Dockerfile` (producción) | `Dockerfile.dev` (desarrollo) |
|---------|--------------------------|-------------------------------|
| `COPY . .` | Sí — copia el código en la imagen | **No** — el código viene por bind mount |
| Instalación | `npm ci --omit=dev` (sin devDependencies) | `npm install` (incluye nodemon) |
| Comando de inicio | `node src/app.js` | `npm run dev` (nodemon) |
| Cuándo se usa | En staging y producción | En local con `make dev` |

**¿Por qué dev no tiene `COPY . .`?**
En desarrollo, el código fuente se monta directamente desde tu máquina al contenedor usando un *bind mount* (configurado en `docker-compose.dev.yml`). Cuando guardas un archivo, nodemon lo detecta y reinicia el servidor — sin necesidad de reconstruir la imagen. Si copiáramos el código en la imagen, tendríamos que hacer `docker build` cada vez que cambiamos un archivo.

---

## ¿Qué es Docker Compose y por qué existe?

Docker solo maneja un contenedor a la vez. Para levantar Nexo sin Compose tendrías que ejecutar 4 comandos largos, definir manualmente la red entre contenedores, gestionar el orden de arranque, y recordar todas las variables de entorno. Un error y nada funciona.

Docker Compose es el **director de orquesta**: un solo archivo `docker-compose.yml` define los 4 contenedores, cómo se conectan entre sí, qué puertos exponen, y qué variables de entorno necesitan. Con un solo comando (`docker compose up`) levanta todo en el orden correcto.

---

## El docker-compose.yml de Nexo — campo por campo

Este es el archivo base real del proyecto:

```yaml
version: '3.9'

services:
  frontend:
    build: ./frontend          # Construye imagen desde ./frontend/Dockerfile
    ports:
      - "3000:80"              # Puerto 3000 de tu PC → puerto 80 del contenedor
    depends_on:
      - backend                # Arranca backend antes que frontend
    networks:
      - nexo-net

  backend:
    build: ./backend           # Construye imagen desde ./backend/Dockerfile
    ports:
      - "4000:4000"
    env_file: .env             # Inyecta todas las variables de .env al contenedor
    depends_on:
      - db
      - ai-service             # Espera a que db y ai-service arranquen primero
    volumes:
      - uploads:/app/uploads   # Volumen nombrado para imágenes subidas
    networks:
      - nexo-net

  ai-service:
    build: ./ai-service
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama   # Persiste los modelos descargados
    networks:
      - nexo-net

  db:
    image: postgres:15-alpine  # Usa imagen pública de Docker Hub, no Dockerfile propio
    environment:
      POSTGRES_DB: nexo
      POSTGRES_USER: nexo_user
      POSTGRES_PASSWORD: changeme_local
    volumes:
      - postgres_data:/var/lib/postgresql/data          # Datos de la DB
      - ./infra/init.sql:/docker-entrypoint-initdb.d/init.sql  # Script de init
    ports:
      - "5432:5432"
    networks:
      - nexo-net

networks:
  nexo-net:
    driver: bridge

volumes:
  postgres_data:
  uploads:
  ollama_models:
```

### `build` vs `image`

Cuando el servicio es código propio del proyecto (frontend, backend, ai-service), usas `build:` para que Docker construya la imagen desde el Dockerfile. Cuando es un servicio estándar (PostgreSQL), usas `image:` para descargar directamente de Docker Hub sin necesidad de un Dockerfile propio.

### `ports`

El formato es `"puertoTuPC:puertoContenedor"`. El backend usa `"4000:4000"` — el puerto 4000 de tu máquina redirige al puerto 4000 del contenedor. Podrías escribir `"9999:4000"` y acceder a la API en `localhost:9999`. Útil cuando tienes conflictos de puertos.

### `depends_on`

Define el **orden de arranque**. El backend necesita que la DB y Ollama estén corriendo antes de intentar conectarse. Sin esto, el backend arrancaría y fallaría al intentar conectarse a una base de datos que todavía no existe.

> 📝 **Nota:** `depends_on` garantiza que el contenedor *arrancó*, no que el servicio dentro *está listo*. PostgreSQL puede tardar unos segundos en estar listo para aceptar conexiones aunque el contenedor ya esté corriendo. Por eso el backend tiene lógica de reconexión.

### `env_file`

Inyecta todas las variables del archivo `.env` al contenedor en tiempo de ejecución. El backend puede leer `process.env.JWT_SECRET` porque esta línea lo hace disponible — sin esta configuración, `process.env.JWT_SECRET` sería `undefined` dentro del contenedor.

### `networks`

Crea una red privada llamada `nexo-net`. Dentro de esta red, cada contenedor puede comunicarse con los demás usando el **nombre del servicio como hostname**. El backend llama a Ollama en `http://ai-service:11434` — `ai-service` se resuelve automáticamente a la IP del contenedor correspondiente. Sin red compartida, los contenedores son islas sin comunicación.

---

## Sistema de overrides — cómo dev/stg/prd modifican el archivo base

`docker-compose.dev.yml` no reemplaza el archivo base — lo **fusiona (merge)**. Solo necesitas especificar lo que cambia. Por ejemplo, en el override de dev el frontend se reemplaza para usar `Dockerfile.dev`, agregar un bind mount, y cambiar el puerto:

```yaml
# docker-compose.dev.yml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev  # Override: diferente Dockerfile
    ports:
      - "5173:5173"               # Override: diferente puerto
    volumes:
      - ./frontend:/app           # Bind mount del código fuente
      - /app/node_modules         # Preserva node_modules del contenedor
```

Lo que no aparece en el override (como `networks`) se hereda del archivo base. Esto evita duplicar toda la configuración en cada entorno — solo describes lo que cambia.

```bash
# Comando completo que usa Docker internamente cuando haces `make dev`
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Volúmenes en detalle

Los contenedores son **efímeros** — cuando se eliminan, todo lo que estaban guardando dentro desaparece. Los volúmenes son almacenamiento que vive *fuera* del contenedor y persiste entre reinicios.

### Sin volumen en PostgreSQL

Cada vez que hicieras `docker compose down` perderías **todos los datos** de la base de datos. El contenedor se destruiría junto con todo su contenido.

### Volúmenes nombrados

`postgres_data`, `uploads`, `ollama_models` son volúmenes nombrados. Docker los gestiona en una ubicación interna del sistema. Persisten aunque el contenedor se elimine.

```bash
# Ver volúmenes existentes
docker volume ls

# Eliminar un volumen específico
docker volume rm saas_nexo_postgres_data
```

### Bind mounts

`./infra/init.sql:/docker-entrypoint-initdb.d/init.sql` es un bind mount: conecta un archivo específico de tu máquina a una ruta dentro del contenedor. PostgreSQL tiene una convención: ejecuta automáticamente todos los `.sql` que encuentre en `/docker-entrypoint-initdb.d/` al arrancar por primera vez. Así se inicializa el schema sin hacer nada manual.

En dev, el código fuente también se monta así (`./backend:/app`) para que nodemon vea los cambios en tiempo real.

> ⚠️ **Importante:** El flag `-v` en `docker compose down -v` elimina los volúmenes nombrados. Úsalo solo cuando quieras un reset completo (borrar todos los datos de la DB, borrar los modelos de Ollama descargados).

---

## Comandos Docker del día a día

```bash
# ── Levantar el proyecto ─────────────────────────────────────────────────

# Primera vez o si cambiaron los Dockerfiles: construye las imágenes y levanta
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Arranques siguientes: reutiliza imágenes ya construidas (más rápido)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# ── Apagar ───────────────────────────────────────────────────────────────

# Apagar todo y conservar datos (la DB mantiene sus datos)
docker compose down

# Apagar y borrar todos los datos — reset completo, úsalo con cuidado
docker compose down -v

# ── Diagnóstico ──────────────────────────────────────────────────────────

# Ver logs de todos los servicios en tiempo real
docker compose logs -f

# Ver logs solo del backend
docker compose logs -f backend

# Ver logs del ai-service (útil para saber si Ollama terminó de cargar modelos)
docker compose logs -f ai-service

# Ver estado actual de cada contenedor
docker compose ps

# ── Interacción con contenedores corriendo ───────────────────────────────

# Abrir una terminal dentro del contenedor del backend
docker compose exec backend sh

# Conectarse a PostgreSQL con psql
docker compose exec db psql -U nexo_user -d nexo

# Cargar datos de prueba en la DB
docker compose exec backend node scripts/seed.js

# ── Builds selectivos ────────────────────────────────────────────────────

# Reconstruir solo el backend sin afectar los demás contenedores
docker compose up --build backend

# Reiniciar el backend (aplica cambios de env vars sin rebuild completo)
docker compose restart backend

# ── Limpieza de espacio en disco ─────────────────────────────────────────

# Eliminar imágenes, contenedores parados y redes no usadas (seguro)
docker system prune

# Eliminar TODO incluyendo volúmenes — peligroso, borra datos de DB y modelos
docker system prune -a --volumes
```

---

## Cómo apagar todo para no consumir recursos

Cuando terminas de trabajar:

```bash
# Apaga los contenedores, mantiene imágenes y datos en disco
docker compose down
```

Los contenedores parados **no consumen CPU ni RAM** — solo ocupan espacio en disco (las imágenes). Para liberar ese espacio: `docker system prune`.

En AWS, la estrategia es diferente: eliminar el CloudFormation stack elimina todas las instancias EC2 y el costo vuelve a $0. Ver [07 — Despliegue AWS](./07-despliegue-aws.md).

---

## ¿Qué sigue?

Con Docker claro, es hora de entender qué hace el servidor → [03 — Backend](./03-backend.md)
