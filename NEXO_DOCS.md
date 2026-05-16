# Nexo — Documentación Completa del Proyecto

> **Propósito:** Generar documentación técnica completa del proyecto Nexo dentro de una carpeta `docs/`. La documentación debe ser accesible para alguien aprendiendo AWS y Docker simultáneamente. Tono de mentor paciente, no de manual frío. Explicar siempre el PORQUÉ antes del CÓMO.

---

## Instrucciones generales de formato

- Usar Markdown con headers claros (# ## ###)
- Diagramas en formato Mermaid donde aporten claridad
- Bloques de código con syntax highlighting para todos los comandos
- Tablas para comparaciones
- Usar `> ⚠️ **Importante:**` para advertencias críticas
- Usar `> 💡 **Tip:**` para consejos útiles
- Usar `> 📝 **Nota:**` para aclaraciones
- Lenguaje simple, cada término técnico nuevo debe explicarse con una analogía antes de la definición
- Los comandos deben tener comentarios explicando qué hacen
- Indicar claramente cuando algo es específico de Windows vs Mac/Linux
- Al final de cada archivo incluir sección "¿Qué sigue?" con link al siguiente documento

---

## Archivos a generar

Crear todos estos archivos dentro de la carpeta `docs/`:

---

### `docs/README.md`

Índice general con:
- Descripción de una línea de qué es Nexo
- Tabla con los 7 documentos, su propósito y cuándo leerlo
- Guía de lectura recomendada: si eres nuevo en Docker empieza por el 02, si ya sabes Docker empieza por el 03
- Links a cada archivo

---

### `docs/01-arquitectura.md`

**Título:** Arquitectura General de Nexo

Contenido:

1. **Qué es Nexo** — descripción del producto en 3 párrafos: qué problema resuelve, quiénes lo usan (3 roles: admin, emprendedor, cliente), qué hace diferente (búsqueda semántica + chatbot integrado)

2. **Los 4 contenedores** — tabla y descripción de cada uno:
   - `frontend` — React 18 + Vite + Tailwind, servido por Nginx en producción
   - `backend` — Node.js 20 + Express, JWT, lógica de negocio
   - `ai-service` — Ollama con nomic-embed-text y qwen2.5:0.5b
   - `db` — PostgreSQL 15 (solo en dev/stg, en producción es RDS)

3. **Diagrama de comunicación** en Mermaid mostrando quién llama a quién:
   - Usuario → frontend → backend → db
   - Usuario → frontend → backend → ai-service
   - backend → S3 (en producción)

4. **Por qué contenedores separados** — explicar con analogía de departamentos en una empresa: cada uno tiene su responsabilidad, si uno falla no afecta a los otros, se pueden escalar independientemente

5. **Los 3 entornos** — tabla comparativa:

| Característica | DEV | STG | PRD |
|---|---|---|---|
| Frontend | Vite dev server (hot reload) | Nginx + build | Nginx + build |
| Backend | Nodemon (hot reload) | Node directo | Node directo |
| DB | Contenedor Docker | Contenedor Docker | AWS RDS |
| Storage | Volumen local | Volumen local | AWS S3 |
| AI | Ollama local | Ollama local | Ollama en EC2 separado |
| Cómo levantar | make dev | make stg | make prd |

6. **Arquitectura AWS en producción** — diagrama Mermaid mostrando:
   - CloudFormation Stack contiene todo
   - EC2 #1 (t2.micro) con ECS: frontend + backend
   - EC2 #2 (t2.micro) con ECS: ai-service Ollama
   - RDS PostgreSQL t3.micro
   - S3 bucket para uploads
   - Explicar que con un comando se crea todo y con otro se elimina todo (ahorro de costos)

7. **Tabla de costos Free Tier** — qué es gratis y por cuánto tiempo:

| Servicio | Free Tier | Límite |
|---|---|---|
| EC2 t2.micro | 750 horas/mes | 12 meses |
| RDS t3.micro | 750 horas/mes | 12 meses |
| S3 | 5 GB almacenamiento | 12 meses |
| ECS | Gratis (pagas la EC2) | Siempre |
| ECR | 500 MB | Siempre |
| CloudFormation | Gratis | Siempre |

---

### `docs/02-docker.md`

**Título:** Docker desde Cero — Guía para Principiantes

Contenido:

1. **¿Qué problema resuelve Docker?**
   - Analogía: "en mi máquina funciona" — el problema clásico del desarrollo
   - Explicar que Docker empaqueta el código junto con todo su entorno
   - Analogía de la planta con su tierra específica: si la mueves a otro jardín con condiciones diferentes, se muere. Docker evita eso.

2. **Tres conceptos fundamentales**
   - **Imagen** — la receta. Archivo estático con instrucciones. Analogía: receta de cocina. No es la comida, son las instrucciones para hacerla.
   - **Contenedor** — la receta ejecutada. Proceso corriendo en aislamiento. Analogía: el plato cocinado. Puedes hacer 10 platos de la misma receta.
   - **Dockerfile** — el archivo donde escribes la receta
   - Diagrama en texto: `Dockerfile → (docker build) → Imagen → (docker run) → Contenedor`

3. **El Dockerfile del backend de Nexo — línea por línea**
   Mostrar el archivo completo y explicar CADA línea con contexto:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY . .
   EXPOSE 4000
   CMD ["node", "src/app.js"]
   ```
   - Explicar el sistema de capas y caché de Docker
   - Explicar con ejemplo concreto POR QUÉ `package.json` se copia antes que el código (si cambias un .js, Docker reutiliza la capa de `npm install` del caché → rebuild en segundos en lugar de minutos)
   - Explicar que `WORKDIR` crea la carpeta si no existe, no hace falta que venga con la imagen base
   - Explicar qué es `alpine` y por qué se usa (Linux ultraligero, ~5MB vs ~900MB de ubuntu)

4. **Dockerfile.dev vs Dockerfile — las diferencias**
   Tabla comparando los dos lado a lado y explicando cada diferencia:
   - Por qué dev no tiene `COPY . .` (se usa bind mount para hot reload en su lugar)
   - Por qué dev usa `npm install` completo en lugar de `--omit=dev` (necesita nodemon)
   - Por qué dev usa `npm run dev` (nodemon) y producción usa `node` directo

5. **¿Qué es Docker Compose y por qué existe?**
   - Problema: Docker solo maneja un contenedor a la vez. Para levantar Nexo necesitarías 4 comandos largos y complejos, conectarlos manualmente.
   - Compose es el director de orquesta: un solo archivo define los 4 contenedores y cómo se relacionan
   - Un solo comando levanta todo: `docker compose up`

6. **El docker-compose.yml de Nexo — campo por campo**
   Mostrar el archivo completo y explicar cada sección con contexto real:
   - `build` vs `image`: cuándo construyes tu propia imagen (frontend, backend, ai-service) vs cuándo usas una pública de Docker Hub (db usa `image: postgres:15-alpine` directamente)
   - `ports`: formato `"puertoPC:puertoContenedor"`. Ejemplo: `"4000:4000"` significa que el puerto 4000 de tu PC redirige al puerto 4000 del contenedor. Podrías usar `"9999:4000"` y acceder por localhost:9999
   - `depends_on`: orden de arranque. El backend depende de `db` y `ai-service`, Docker los arranca primero. Sin esto, el backend intentaría conectarse a una DB que no existe aún.
   - `env_file`: inyecta todas las variables del archivo `.env` al contenedor. Por eso el backend puede leer `JWT_SECRET` sin que esté hardcodeado en el código.
   - `networks`: crea una red privada `nexo-net`. Dentro de esta red cada contenedor es accesible por su nombre de servicio. El backend llama a `http://ai-service:11434` usando el nombre `ai-service` como hostname. Sin red compartida los contenedores son islas.
   - `volumes`: dos tipos explicados en detalle (ver sección siguiente)

7. **Sistema de overrides — cómo dev/stg/prd modifican el archivo base**
   - Explicar que `docker-compose.dev.yml` no reemplaza el base sino que lo FUSIONA (merge)
   - Qué campos se pueden override: command, volumes, environment, ports
   - Ejemplo concreto: el frontend en el base usa Nginx (puerto 80), en el dev override usa Vite (puerto 5173)
   - Por qué este sistema: evita duplicar configuración. Lo que es igual en todos los entornos va en el base, lo que cambia va en el override.
   - Comando completo: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

8. **Volúmenes en detalle**
   - Por qué existen: los contenedores son efímeros. Si el contenedor se elimina, todo lo que estaba dentro desaparece. Los volúmenes son almacenamiento que persiste fuera del contenedor.
   - Ejemplo concreto: sin volumen en PostgreSQL, cada `docker compose down` borraría TODOS los datos de la DB
   - **Volúmenes nombrados** (`postgres_data`, `uploads`, `ollama_models`): Docker los gestiona internamente en una ubicación del sistema. Persisten entre reinicios.
   - **Bind mounts** (`./infra/init.sql:/docker-entrypoint-initdb.d/init.sql`): montan un archivo o carpeta específica de tu PC dentro del contenedor. En dev, el código fuente se monta así para el hot reload.
   - El flag `-v` en `docker compose down -v` elimina los volúmenes nombrados (reset completo de datos)

9. **Comandos Docker del día a día** con ejemplos reales de Nexo y comentarios explicativos:

```bash
# ── Levantar el proyecto ─────────────────────────────────────────

# Desarrollo: con hot reload, primera vez o si cambiaron los Dockerfiles
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Desarrollo: sin rebuild (más rápido si solo cambiaste código)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# ── Apagar ───────────────────────────────────────────────────────

# Apagar todo (conserva volúmenes — los datos de la DB se mantienen)
docker compose down

# Apagar y eliminar todos los datos (reset completo — cuidado!)
docker compose down -v

# ── Diagnóstico ──────────────────────────────────────────────────

# Ver logs de todos los contenedores en tiempo real
docker compose logs -f

# Ver logs solo del backend (útil para debuggear la API)
docker compose logs -f backend

# Ver logs del ai-service (útil para ver si Ollama descargó los modelos)
docker compose logs -f ai-service

# Ver estado de los contenedores (running, exited, etc.)
docker compose ps

# ── Interacción con contenedores ─────────────────────────────────

# Entrar a la terminal del backend (para correr scripts manualmente)
docker compose exec backend sh

# Entrar a la DB con psql
docker compose exec db psql -U nexo_user -d nexo

# Cargar datos de prueba
docker compose exec backend node scripts/seed.js

# ── Builds selectivos ────────────────────────────────────────────

# Rebuild solo del backend sin afectar los otros contenedores
docker compose up --build backend

# Reiniciar el backend sin rebuild (aplica cambios de código en dev)
docker compose restart backend

# ── Limpieza de espacio ──────────────────────────────────────────

# Eliminar imágenes, contenedores y redes no usados
docker system prune

# Eliminar TODO incluyendo volúmenes (peligroso, borra datos)
docker system prune -a --volumes
```

10. **Cómo apagar todo para no consumir recursos**
    - `docker compose down` apaga contenedores pero mantiene imágenes en disco
    - Las imágenes no consumen CPU ni RAM cuando están paradas, solo espacio en disco
    - Para liberar espacio en disco: `docker system prune`
    - En AWS: eliminar el CloudFormation stack elimina TODO y el costo vuelve a $0

---

### `docs/03-backend.md`

**Título:** Backend — Node.js y Express

Contenido:

1. **Estructura de carpetas y responsabilidad de cada una**
```
backend/src/
├── controllers/   # Reciben petición HTTP, llaman al service, retornan respuesta JSON
├── services/      # Lógica de negocio pura, sin saber nada de HTTP
├── routes/        # Mapean URLs a controllers (GET /api/stores → stores.controller)
├── middlewares/   # Funciones que se ejecutan ANTES del controller (auth, validación)
└── utils/         # Funciones reutilizables (cosine.js, haversine.js, db.js)
```
Analogía de restaurante: routes=recepción (te dice a qué mesa ir), middleware=seguridad (verifica que puedes entrar), controller=mesero (toma el pedido y lo lleva), service=cocina (prepara la comida), db=despensa (ingredientes)

2. **Flujo completo de una petición HTTP** con diagrama Mermaid:
   `Request → Router → Middleware Auth → Middleware Validación → Controller → Service → DB → Response`

3. **Autenticación JWT — qué es y cómo funciona**
   - JWT tiene 3 partes separadas por puntos: `header.payload.signature`
   - El payload contiene datos legibles (id del usuario, rol) pero la firma verifica que no fue alterado
   - Analogía: como un pasaporte — cualquiera puede ver los datos pero no puede falsificar el sello
   - Flujo completo en Nexo: login → servidor genera token con `JWT_SECRET` → cliente guarda en localStorage → cliente envía en cada request como `Authorization: Bearer <token>` → servidor valida la firma
   - Por qué expira en 7 días: seguridad, si alguien roba el token solo lo puede usar una semana

4. **Los 3 roles y protección de rutas**
   - El middleware `auth.js` verifica el token y extrae el rol del usuario
   - Rutas protegidas por rol: solo `emprendedor` puede crear servicios, solo `admin` puede cambiar roles
   - Ejemplo de cómo se ve en el código: `router.post('/', authenticateToken, requireRole('emprendedor'), createService)`

5. **Conexión a PostgreSQL con pool de conexiones**
   - Sin pool: cada request abre y cierra una conexión nueva → lento y costoso
   - Con pool: se mantienen N conexiones abiertas y se reutilizan → rápido
   - Configurado en `utils/db.js` con la librería `pg`

6. **Lógica de slots de disponibilidad — la más importante del negocio**
   Pseudocódigo paso a paso:
   ```
   1. Obtener horario del día (business_hours donde day_of_week = día solicitado)
   2. Si is_open = false → retornar [] (tienda cerrada ese día)
   3. Dividir open_time..close_time en slots de service.duration_minutes minutos
      Ej: 9:00-18:00 con servicio de 45min → [9:00-9:45, 9:45-10:30, 10:30-11:15, ...]
   4. Consultar citas existentes del día con status != 'cancelled'
   5. Para cada slot verificar si se cruza con alguna cita existente
   6. Retornar array: [{ start: "09:00", end: "09:45", available: true/false }]
   ```

7. **El chatbot — flujo técnico completo**
   - Paso 1: qwen2.5:0.5b normaliza "acicalarme" → `{ searchText: "corte cabello arreglo personal", city: null }`
   - Paso 2: nomic-embed-text genera embedding del searchText → vector de 768 números
   - Paso 3: se compara contra embeddings de todas las tiendas activas con similitud coseno
   - Paso 4: umbral 0.60 — solo pasan tiendas con score ≥ 0.60 (calibrado con mediciones reales)
   - Paso 5: si no hay resultados → mensaje hardcodeado, sin llamar a qwen
   - Paso 6: si hay resultados → qwen redacta respuesta SOLO con los datos reales filtrados

8. **Variables de entorno — para qué sirve cada una** (tabla completa)

9. **Sistema de uploads — local en dev, S3 en producción**
   - Solo cambiando `STORAGE_TYPE=s3` en `.env` el backend sube a S3 en lugar de guardar local
   - Implementado con multer (manejo de multipart/form-data) + AWS SDK para S3

---

### `docs/04-frontend.md`

**Título:** Frontend — React y Vite

Contenido:

1. **Por qué React y Vite** — ventajas concretas para Nexo

2. **Estructura de carpetas**
```
frontend/src/
├── pages/
│   ├── public/        # Landing, Explore, StoreProfile — sin autenticación
│   ├── auth/          # Login, Register
│   ├── client/        # Dashboard, Appointments — rol cliente
│   ├── entrepreneur/  # Dashboard, Store, Services — rol emprendedor
│   └── admin/         # Dashboard, Users, Stores — rol admin
├── components/        # Reutilizables: StoreCard, ChatBot, BookingModal, etc.
└── lib/
    ├── axios.js       # Cliente HTTP con interceptor JWT
    ├── api.js         # Funciones que llaman a cada endpoint
    └── auth.js        # Helpers: getToken, setToken, getUser, logout
```

3. **Routing con React Router v6 y rutas protegidas**
   - Cómo funciona `<ProtectedRoute role="emprendedor" />`: verifica token y rol, si no cumple redirige a login
   - El problema del refresh en SPAs: al refrescar `/store/mi-tienda`, el servidor no conoce esa ruta
   - Solución en `nginx.conf`: `try_files $uri $uri/ /index.html` → Nginx siempre sirve index.html y React Router maneja la ruta

4. **Autenticación en el frontend**
   - JWT guardado en `localStorage` bajo la clave `nexo_token`
   - Interceptor de Axios en `lib/axios.js`: antes de cada request agrega automáticamente `Authorization: Bearer <token>`
   - Cuando el servidor responde 401 (token expirado): el interceptor hace logout automático y redirige a login

5. **React Query — qué problema resuelve**
   - Sin React Query: en cada componente hay que manejar manualmente `loading`, `error`, `data`, refetch
   - Con React Query: cache automático, estados de carga integrados, revalidación en background
   - Ejemplos de uso en Nexo: `useQuery` para cargar tiendas en la landing, `useMutation` para crear una cita

6. **Formularios con React Hook Form + Zod**
   - Por qué no usar `useState` para formularios: un estado por campo = demasiados re-renders
   - React Hook Form: accede a los valores del DOM directamente, sin re-renders innecesarios
   - Zod: define la forma y validación del formulario como un schema tipado, genera mensajes de error automáticamente

7. **Sistema de diseño Nexo — colores y componentes**
   - Los colores en `tailwind.config.js`: `nexo-red` (#E8223A), `nexo-red-dark`, `nexo-red-light`, etc.
   - Cómo se usan: `className="bg-nexo-red text-white"` en lugar de estilos inline
   - Componentes principales y su propósito: StoreCard, BookingModal, TimeSlotGrid, AppointmentCard, ChatBot

8. **El componente ChatBot — estado y lógica**
   - Estado: `isOpen` (abre/cierra el panel), `messages` (historial), `isLoading` (spinner), `stores` (cards a mostrar)
   - Por qué `stores.length > 0` es crítico: evita mostrar cards vacías cuando no hay resultados
   - Cómo mantiene el historial: array local de `{ role: 'user'|'bot', content: string }`, envía los últimos 4 mensajes al backend en cada request

9. **DEV vs Producción**
   - DEV: Vite dev server con HMR (Hot Module Replacement) — cambias un componente, se actualiza en el navegador sin refrescar
   - PRD: `npm run build` genera la carpeta `/dist` con archivos minificados y optimizados, Nginx los sirve como archivos estáticos

---

### `docs/05-base-de-datos.md`

**Título:** Base de Datos — PostgreSQL

Contenido:

1. **Las 6 tablas y su propósito** — descripción de cada una con columnas más importantes

2. **Diagrama ERD en Mermaid** con las 6 tablas y sus relaciones y cardinalidades

3. **Por qué UUID en lugar de INTEGER para los IDs**
   - IDs numéricos exponen información: si tu ID es 47, un atacante sabe que hay 46 usuarios
   - UUIDs son impredecibles: `c0d90521-1c24-4623-9357-35a1af5fff27`
   - Permiten generar IDs en el cliente sin consultar la DB primero

4. **Índices — qué son y cuáles tiene Nexo**
   - Analogía: índice de un libro vs leer página por página
   - Los 4 índices de Nexo y por qué cada uno existe (qué consulta frecuente optimizan)

5. **La columna `embedding` en stores**
   - Qué guarda: array JSON de 768 números flotantes (el "mapa semántico" de la tienda)
   - Cómo se genera: nomic-embed-text procesa `name + category + tags + description`
   - Cómo se usa: similitud coseno en el chatbot

6. **Constraints importantes y qué protegen** — tabla con cada constraint y su propósito

7. **Cómo se inicializa la DB automáticamente** — por qué PostgreSQL ejecuta `init.sql` al arrancar

8. **El script de seed** — qué crea y cuándo usarlo

9. **Comandos psql útiles** con ejemplos reales de Nexo

10. **Buenas prácticas implementadas** — soft delete, timestamps, validación en DB y backend

---

### `docs/06-ia.md`

**Título:** Sistema de Inteligencia Artificial — Ollama

Contenido:

1. **¿Qué es Ollama y por qué se eligió?**
   - Corre modelos de IA open source localmente, en Docker, sin costo por token
   - Comparación: OpenAI API (costo), Hugging Face (complejo), Ollama (simple, gratis, privado)

2. **Los dos modelos de Nexo y para qué sirve cada uno**

   **`nomic-embed-text`** (~270MB):
   - Genera embeddings: representaciones matemáticas del significado de un texto
   - Analogía del mapa: cada texto tiene coordenadas en un espacio de 768 dimensiones. Textos con significado similar quedan cerca. "Corte de cabello" y "peluquería" están cerca. "Pizza" y "fisioterapia" están lejos.
   - Se usa al: crear/actualizar tiendas (genera su embedding) y en búsquedas del chatbot

   **`qwen2.5:0.5b`** (~400MB):
   - LLM pequeño: entiende lenguaje natural y genera respuestas coherentes
   - Limitaciones: memoria corta, razonamiento simple. Por eso en Nexo solo hace DOS cosas muy específicas: normalizar intención y redactar respuesta con datos reales.

3. **Cómo funciona la búsqueda semántica — paso a paso con ejemplo real**
   Ejemplo concreto "quiero acicalarme en Bogotá":
   - Paso 1 → qwen: `{ searchText: "arreglo personal corte cabello", city: "bogotá" }`
   - Paso 2 → nomic: genera vector de "arreglo personal corte cabello"
   - Paso 3 → Node.js: similitud coseno contra todas las tiendas
   - Paso 4 → umbral: solo tiendas con score ≥ 0.60
   - Paso 5 → si vacío: mensaje hardcodeado, fin
   - Paso 6 → qwen: redacta respuesta con los datos reales de las tiendas que pasaron

4. **Similitud coseno — sin fórmulas matemáticas**
   - Analogía de dos personas apuntando: misma dirección = similares (1.0), opuestas = diferentes (-1.0), ángulo recto = sin relación (0.0)
   - Por qué 0.60: fue calibrado midiendo scores reales en el proyecto:
     - "fisioterapia" vs Dr. Martínez: **0.6628** ✅ (pasa)
     - "corte cabello" vs Salón Valentina: **0.7633** ✅ (pasa)
     - "fisioterapia" vs Salón Valentina: **0.4648** ❌ (no pasa)
     - "xbox" vs cualquier tienda: máximo **0.5839** ❌ (no pasa)

5. **Por qué el chatbot no alucina**
   - Regla de oro: si ninguna tienda supera 0.60 → mensaje hardcodeado, qwen no se llama
   - qwen solo recibe datos ya filtrados y verificados, con instrucción explícita de no inventar

6. **Limitaciones y mejoras futuras**
   - qwen2.5:0.5b puede fallar en mensajes muy ambiguos o coloquiales extremos
   - Para producción con más recursos: `llama3.2:3b` razona mejor
   - Mejora futura: regenerar embeddings de tiendas automáticamente cuando el dueño actualiza su perfil

7. **Consideraciones de producción**
   - RAM total necesaria: ~1GB solo para los modelos → Ollama necesita su propia EC2 t2.micro
   - Los modelos se descargan una vez y quedan en el volumen `ollama_models`
   - Cold start: primera petición ~5-10s, siguientes ~1-3s

---

### `docs/07-despliegue-aws.md`

**Título:** Despliegue en AWS — Guía Paso a Paso

Contenido:

1. **Arquitectura final en AWS** — diagrama Mermaid mostrando:
   - CloudFormation Stack como contenedor de todo
   - ECS Cluster con EC2 launch type
   - EC2 #1 (t2.micro): Task Definitions para frontend + backend
   - EC2 #2 (t2.micro): Task Definition para ai-service (Ollama)
   - RDS PostgreSQL t3.micro (fuera de ECS, gestionado por AWS)
   - S3 Bucket para uploads
   - Security Groups controlando el tráfico entre servicios
   - ECR guardando las imágenes Docker

2. **¿Qué es ECS y por qué usarlo en lugar de Docker Compose directo?**
   - ECS = Elastic Container Service: AWS gestiona tus contenedores
   - Con Docker Compose directo en EC2: si el contenedor falla, no se reinicia solo
   - Con ECS: si un contenedor falla, ECS lo reinicia automáticamente
   - ECS con EC2 launch type: usas una EC2 normal (gratis en Free Tier) pero ECS la gestiona
   - Conceptos clave de ECS:
     - **Task Definition**: el equivalente a un servicio en docker-compose (imagen, CPU, RAM, variables de entorno)
     - **Service**: cuántas instancias de una Task Definition correr y cómo mantenerlas
     - **Cluster**: el grupo de EC2 donde corren las Tasks

3. **Servicios AWS que se usarán** — tabla completa con propósito y límites Free Tier

4. **Preparación de la cuenta AWS**
   - Por qué NUNCA usar el usuario root
   - Crear usuario IAM con permisos de administrador
   - Configurar AWS CLI: `aws configure` (access key, secret key, región)
   - Configurar alerta de billing a $1 para no tener sorpresas
   - Verificar región: us-east-1 recomendado

5. **Paso 1 — Construir y subir imágenes a ECR**
   - Qué es ECR: Docker Hub pero privado y dentro de tu cuenta AWS
   - Crear repositorios en ECR (uno por servicio: frontend, backend, ai-service)
   - Comandos completos con comentarios:
   ```bash
   # Autenticarse en ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin \
     TU_CUENTA_ID.dkr.ecr.us-east-1.amazonaws.com

   # Build de la imagen del backend
   docker build -t nexo-backend ./backend

   # Etiquetar para ECR
   docker tag nexo-backend:latest \
     TU_CUENTA_ID.dkr.ecr.us-east-1.amazonaws.com/nexo-backend:latest

   # Push a ECR
   docker push \
     TU_CUENTA_ID.dkr.ecr.us-east-1.amazonaws.com/nexo-backend:latest
   ```
   Repetir para frontend y ai-service.

6. **Paso 2 — La plantilla CloudFormation**
   - Qué es CloudFormation: describes toda tu infraestructura en un archivo YAML y AWS la crea automáticamente
   - Analogía: como un `docker-compose.yml` pero para servicios de AWS completos
   - La plantilla de Nexo crea en orden:
     1. VPC y subnets (la red privada)
     2. Security Groups (las reglas de firewall)
     3. RDS PostgreSQL (la base de datos)
     4. S3 Bucket (almacenamiento de imágenes)
     5. ECS Cluster (el agrupador de contenedores)
     6. EC2 #1 con ECS Agent (para frontend + backend)
     7. EC2 #2 con ECS Agent (para ai-service)
     8. Task Definitions (la configuración de cada contenedor)
     9. ECS Services (cuántas instancias de cada Task correr)
   - La plantilla acepta parámetros: DBPassword, JWTSecret, S3BucketName

7. **Paso 3 — Desplegar el stack completo**
   ```bash
   # Crear o actualizar el stack completo con un solo comando
   aws cloudformation deploy \
     --template-file infra/aws/nexo-stack.yml \
     --stack-name nexo-prd \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       DBPassword=MiPasswordSeguro123! \
       JWTSecret=MiJWTSecretSuperSeguro

   # Monitorear el progreso (puede tardar 5-10 minutos)
   aws cloudformation describe-stack-events \
     --stack-name nexo-prd \
     --query 'StackEvents[*].[ResourceStatus,ResourceType,ResourceStatusReason]' \
     --output table

   # Ver las URLs y datos de conexión cuando termine
   aws cloudformation describe-stacks \
     --stack-name nexo-prd \
     --query 'Stacks[0].Outputs' \
     --output table
   ```

8. **Paso 4 — Inicializar la base de datos en RDS**
   - Conectarse a RDS y ejecutar `init.sql`
   - Ejecutar el seed para tener datos de prueba
   - Comandos completos

9. **Paso 5 — Verificar que todo funciona**
   - Checklist: frontend accesible, API respondiendo, chatbot funcionando
   - Cómo ver logs de ECS desde la terminal
   - Comandos para diagnosticar problemas comunes

10. **⚠️ Apagar todo para no generar costos — MUY IMPORTANTE**
    ```bash
    # ELIMINAR el stack completo
    # Esto elimina: EC2, RDS, S3 (contenido incluido), ECS, todo
    # COSTO VUELVE A $0 inmediatamente
    aws cloudformation delete-stack --stack-name nexo-prd

    # Verificar que se está eliminando (puede tardar 5-10 minutos)
    aws cloudformation describe-stacks --stack-name nexo-prd

    # Cuando el stack se elimine, verificar que no quedan recursos huérfanos
    # Un RDS olvidado puede seguir generando costos aunque no lo uses
    aws ec2 describe-instances \
      --filters "Name=instance-state-name,Values=running" \
      --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name]'

    aws rds describe-db-instances \
      --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus]'
    ```

    > ⚠️ **Importante:** Después de hacer delete-stack, siempre verificar en la consola web de AWS (console.aws.amazon.com) que no queden instancias EC2 ni RDS corriendo. CloudFormation a veces falla en eliminar recursos y los deja huérfanos generando costos.

11. **Diferencias entre dev local y producción AWS** — tabla comparativa completa

12. **Flujo de trabajo recomendado para el proyecto**
    ```
    Desarrollo diario → local con Docker (make dev)
    Cuando quieras probar en AWS → aws cloudformation deploy (5-10 min)
    Cuando termines la prueba → aws cloudformation delete-stack (5-10 min)
    Costo generado en 10 minutos de prueba → aproximadamente $0.003 USD
    ```

---

## Nota final para Claude Code

Generar todos los archivos con contenido completo y detallado. No generar esqueletos o placeholders — cada sección debe tener el contenido real descrito. Los diagramas Mermaid deben ser sintácticamente correctos. Los bloques de código deben ser ejecutables con comentarios explicativos en español. El tono debe ser de mentor paciente: explicar el porqué de cada decisión, no solo el cómo.
