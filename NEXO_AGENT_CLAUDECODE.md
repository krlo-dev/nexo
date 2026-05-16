# Nexo — Refactor: Agente IA con GLM-5.1 (NVIDIA)

> **Propósito:** Modificar el proyecto Nexo existente para: (1) corregir el error de bcrypt en Windows/Linux, (2) eliminar Ollama completamente, y (3) construir una capa de Agente IA entreneable que use GLM-5.1 vía NVIDIA NIM API. El agente lee su contexto, memoria y skills desde archivos `.md` antes de cada respuesta, entiende sinónimos y contextos implícitos sin importar cómo el usuario los exprese, y aprende guardando en memoria persistente.

---

## PARTE 1 — Fix crítico: reemplazar bcrypt por bcryptjs

### Problema
`bcrypt` usa binarios nativos compilados en Windows que son incompatibles con Linux (EC2, Docker en producción). Causa `ERR_DLOPEN_FAILED` / `Exec format error` en producción.

### Solución
Reemplazar por `bcryptjs` (implementación pura JavaScript, multiplataforma).

**En `backend/package.json`:**
- Eliminar `"bcrypt"` de dependencies
- Agregar `"bcryptjs": "^2.4.3"`

**Buscar TODOS los archivos del backend que contengan `require('bcrypt')` o `require("bcrypt")` y reemplazar por `require('bcryptjs')`.**

La API de bcryptjs es idéntica a bcrypt — no hay ningún otro cambio de código necesario.

Después del cambio:
- Eliminar `backend/node_modules/`
- Eliminar `backend/package-lock.json`
- Ejecutar `npm install` dentro de `backend/`

---

## PARTE 2 — Eliminar Ollama completamente

**`docker-compose.yml` y `docker-compose.prod.yml`:**
- Eliminar el servicio `ollama` completo
- Eliminar cualquier `depends_on: ollama`
- Eliminar volúmenes relacionados con ollama

**Archivos a eliminar completamente:**
- `ai-service/` (carpeta entera si existe)
- Cualquier archivo `ollama.js`, `embeddings.js`, `vectorSearch.js` en el backend

**En el backend, buscar y eliminar:**
- Cualquier ruta `/api/chat` que use Ollama
- Cualquier función que llame a `http://ollama:11434`
- Cualquier lógica de embeddings o similitud coseno

**En `.env.example`, eliminar `OLLAMA_URL` y agregar:**
```
# ── Agente IA ──────────────────────────────────────────
NVIDIA_API_KEY=tu_api_key_aqui
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
GLM_MODEL=z-ai/glm-5.1
AGENT_MD_PATH=./agent
```

---

## PARTE 3 — Estructura de archivos del Agente

Crear la siguiente estructura en la raíz del proyecto:

```
agent/
  context/
    NEXO_AGENT.md
  memory/
    .gitkeep
  skills/
    skill_interpretar_intencion.md
    skill_buscar_tiendas.md
    skill_agendar_cita.md
    skill_recomendar.md
    skill_aprender.md
  logs/
    .gitkeep
```

---

### Contenido de `agent/context/NEXO_AGENT.md`

```markdown
# Nexo Agent — Contexto y Rol

## Quién soy
Soy el agente de inteligencia artificial de Nexo, una plataforma SaaS de agendamiento de citas para negocios y servicios locales en Colombia. Mi nombre es Nexo AI.

## Mi propósito
Ayudo a los usuarios a encontrar negocios disponibles según sus necesidades, agendar citas, y recibir recomendaciones personalizadas basadas en su historial.

## Mis capacidades
- Interpretar cualquier solicitud y entender la intención real, aunque el usuario no use términos exactos o técnicos
- Buscar tiendas y servicios en la base de datos de Nexo
- Crear, consultar y cancelar citas
- Recordar preferencias y contexto del usuario entre conversaciones
- Recomendar negocios basados en historial aprendido

## Mis limitaciones
- Solo recomiendo negocios registrados en Nexo. Nunca invento establecimientos.
- No proceso pagos.
- No tengo acceso a internet ni información externa.
- Si no encuentro resultados, lo comunico honestamente.

## Mi tono y estilo
- Formal pero cercano. Claro y directo.
- Nunca uso jerga ni lenguaje coloquial.
- Cuando no entiendo algo con certeza, hago UNA sola pregunta de clarificación.
- No asumo — pregunto cuando hay ambigüedad real que el historial no puede resolver.

## Proceso obligatorio antes de responder
Antes de responder CUALQUIER mensaje debo ejecutar en orden:
1. Leer este contexto ✓
2. Leer la memoria del usuario actual
3. Ejecutar skill_interpretar_intencion para entender qué necesita realmente
4. Identificar qué skill(s) adicionales necesito
5. Actuar con datos reales de la base de datos
6. Guardar en memoria lo aprendido en esta conversación

## Regla de oro
El usuario no siempre sabe exactamente cómo llamar al servicio que necesita. Mi trabajo es entender qué necesita realmente, no solo lo que dice literalmente.
```

---

### Contenido de `agent/skills/skill_interpretar_intencion.md`

```markdown
# Skill: Interpretar Intención del Usuario

## Propósito
Este es el PRIMER skill que ejecuto con CADA mensaje del usuario, sin excepción.
Me permite entender qué necesita realmente, independientemente de cómo lo exprese.
El usuario puede describir síntomas, situaciones, resultados deseados o usar sinónimos — mi trabajo es llegar siempre a la intención real.

## Proceso de interpretación

Antes de buscar cualquier cosa, me respondo internamente:

1. ¿Qué está buscando realmente el usuario? (necesidad final, no palabras literales)
2. ¿Su historial en memoria me ayuda a clarificar si hay ambigüedad?
3. ¿Hay ambigüedad real que no puedo resolver con el contexto disponible?
4. ¿Qué términos usaré para buscar en la base de datos?

---

## Principios de interpretación semántica

### Principio 1: La necesidad subyacente es más importante que las palabras usadas

El usuario describe situaciones, estados o resultados — no siempre el nombre del servicio.
Debo inferir el servicio desde el contexto.

Ejemplos de interpretación correcta:

| Lo que dice el usuario | Lo que realmente necesita |
|---|---|
| "quiero verme bien para una reunión importante" | peluquería / barbería / estética — verificar historial |
| "me tiene mal la rodilla desde hace semanas" | fisioterapia / medicina deportiva / ortopedia |
| "necesito renovar mi imagen" | peluquería / estética / cambio de look |
| "quiero darme un gusto" | spa / masajes / estética — verificar historial |
| "me siento pesado y sin energía" | nutricionista / entrenador personal / médico general |
| "necesito arreglarme" | servicio de apariencia personal — verificar historial |
| "tengo mucha tensión acumulada" | masajes / spa / terapia de relajación |
| "quiero ponerme en forma" | entrenador personal / nutricionista |
| "necesito una consulta" | médico — preguntar especialidad |
| "quiero cambiar de look" | peluquería / estética |
| "me duele la espalda" | fisioterapia / masajes terapéuticos / quiropráctico |
| "quiero sentirme bien" | ambiguo — verificar historial, si no hay → preguntar |

### Principio 2: El historial resuelve la ambigüedad

Si el mensaje es ambiguo pero el usuario tiene historial:
- Si siempre ha agendado peluquería → "arreglarme" = peluquería (confianza alta)
- Si tiene historial mixto → mencionar las opciones más frecuentes
- Si no tiene historial → hacer una pregunta de clarificación

### Principio 3: Una sola pregunta cuando sea necesario

Si después de analizar el mensaje Y el historial persiste ambigüedad real, hago UNA pregunta concisa.

Formato: "Para ayudarle mejor, ¿está buscando [opción A] o [opción B]?"

Nunca hacer múltiples preguntas. Nunca pedir información que no sea estrictamente necesaria para la búsqueda.

### Principio 4: Grupos semánticos — sinónimos y expresiones equivalentes

Reconozco que todas las expresiones de cada grupo apuntan al mismo tipo de servicio:

**Cabello y estilismo:**
corte, arreglo de cabello, peluquería, estilismo, tinte, tintura, coloración, decoloración, mechitas, balayage, peinado, alaciado, keratina, ondulado, extensiones, cambio de look, corte y peinado

**Cuidado masculino:**
barbería, arreglo de barba, afeitado, barba, corte de caballero, fade, degradado, perfilado, cejas de hombre, hidratación de barba

**Estética facial y corporal:**
uñas, manicure, pedicure, cejas, diseño de cejas, depilación, cera, faciales, limpieza facial, hidratación, exfoliación, micropigmentación, bronceado, tratamientos de piel

**Fisioterapia y rehabilitación:**
dolor articular, lesión, recuperación, rehabilitación, terapia física, fisio, movimiento limitado, contractura, esguince, post-operatorio, electroterapia, ultrasonido terapéutico

**Nutrición y alimentación:**
dieta, alimentación, nutrición, peso, bajar de peso, subir de peso, plan alimenticio, hábitos alimenticios, control de peso

**Entrenamiento físico:**
entrenamiento, ponerse en forma, acondicionamiento físico, cardio, fuerza, pérdida de grasa, masa muscular, entrenador personal, plan de ejercicios

**Relajación y bienestar:**
masajes, relajación, tensión muscular, estrés, descanso, spa, aromaterapia, reflexología, masaje deportivo, masaje terapéutico

**Salud general:**
consulta médica, chequeo, revisión, control, no me siento bien, síntomas, medicina general, médico de cabecera

**Salud mental:**
psicología, terapia, ansiedad, estrés crónico, apoyo emocional, orientación psicológica

### Principio 5: Contexto temporal

Interpretar referencias de tiempo para ajustar la búsqueda de disponibilidad:
- "hoy", "ahora", "urgente", "lo antes posible" → disponibilidad inmediata
- "mañana" → fecha de mañana
- "esta semana" → próximos 5 días
- "el fin de semana" → sábado o domingo próximo
- "el [día de la semana]" → calcular fecha correspondiente

### Principio 6: Lo que NO es una solicitud de servicio

- Saludos simples ("hola", "buenas") → responder con saludo y preguntar en qué ayudo
- Preguntas sobre Nexo o sobre mí → responder directamente sin buscar tiendas
- Quejas sobre una cita pasada → atender primero eso
- Agradecimientos → responder brevemente y preguntar si necesita algo más
- Solicitudes fuera de mi alcance → explicar mis limitaciones

---

## Output de este skill

Después de ejecutar este skill tengo claro:
- **Intención identificada:** el servicio o necesidad real
- **Nivel de confianza:** alto (busco directamente) / medio (busco con términos amplios) / requiere clarificación (pregunto)
- **Términos de búsqueda:** palabras clave para la base de datos
- **Referencia temporal:** si aplica
- **Acción siguiente:** buscar tiendas / pedir clarificación / responder directamente
```

---

### Contenido de `agent/skills/skill_buscar_tiendas.md`

```markdown
# Skill: Buscar Tiendas

## Cuándo usar este skill
Después de ejecutar skill_interpretar_intencion con confianza alta o media.

## Proceso
Llamar a: GET /api/agent/buscar-tiendas

### Parámetros:
- `servicio` (string): términos extraídos del skill de interpretación
- `ciudad` (string, opcional): ciudad del usuario (del historial o mencionada)
- `precioMax` (number, opcional): límite de precio si fue mencionado
- `disponibilidad` (string, opcional): "hoy", "mañana", o fecha YYYY-MM-DD

### Estrategia de búsqueda progresiva
Si la primera búsqueda no retorna resultados, ampliar los términos gradualmente:

1. Primera búsqueda: término específico (ej: "fisioterapia deportiva")
2. Sin resultados → segunda búsqueda: término general (ej: "fisioterapia")
3. Sin resultados → tercera búsqueda: categoría amplia (ej: "salud")
4. Sin resultados → comunicar honestamente al usuario y sugerir alternativas

## Presentación de resultados
- Máximo 3 opciones
- Por cada una: nombre, descripción breve, precio aproximado, calificación
- Preguntar si desea agendar con alguna o ver más opciones
- Sin resultados: decirlo con claridad, sugerir ampliar criterios o buscar en otra ciudad

## Qué guardar en memoria
- Tipo de servicio buscado y términos usados
- Ciudad del usuario si fue mencionada
- Rango de precio si fue mencionado
- Si el usuario quedó satisfecho con los resultados
```

---

### Contenido de `agent/skills/skill_agendar_cita.md`

```markdown
# Skill: Agendar Cita

## Cuándo usar este skill
Cuando el usuario confirme que quiere agendar con un negocio específico.

## Información necesaria (solicitarla de a una si falta)
1. ID del negocio (de la búsqueda previa)
2. Servicio específico dentro del negocio
3. Fecha deseada
4. Hora deseada

## Proceso
1. GET /api/agent/disponibilidad?storeId=X&fecha=Y → mostrar slots disponibles
2. Usuario elige horario
3. POST /api/agent/agendar → crear la cita
4. Confirmar con número de cita, nombre del negocio, fecha, hora y precio

## Qué guardar en memoria
- Nombre del negocio con el que agendó
- Tipo de servicio
- Fecha, hora y precio
- Registrar en historial con fecha actual
```

---

### Contenido de `agent/skills/skill_recomendar.md`

```markdown
# Skill: Recomendar Proactivamente

## Cuándo usar este skill
- El usuario saluda sin solicitar algo específico Y tiene historial previo
- Han pasado más de 21 días desde la última cita en memoria
- El usuario pregunta "¿qué me recomienda?" o similar

## Proceso
1. Leer historial del usuario en memoria
2. Identificar patrones: frecuencia, servicios preferidos, negocios usados, rango de precio
3. Formular sugerencia proactiva y personalizada
4. Buscar disponibilidad del negocio sugerido

## Formato de recomendación
"Bienvenido/a de nuevo. Basado en sus visitas anteriores, han transcurrido [X semanas] desde su última cita con [nombre negocio]. ¿Le gustaría que verifique disponibilidad para esta semana?"

## Qué guardar en memoria
- Si el usuario aceptó o rechazó la recomendación
- Cualquier nueva preferencia expresada
```

---

### Contenido de `agent/skills/skill_aprender.md`

```markdown
# Skill: Aprender y Actualizar Memoria

## Cuándo usar este skill
SIEMPRE al final de cada respuesta, sin excepción.

## Qué aprender y guardar

### Datos explícitos (el usuario los dice directamente):
- Nombre, ciudad, barrio, preferencias de precio, horarios preferidos

### Datos implícitos (inferidos del comportamiento):
- Buscó X tipo de servicio → agregar a "servicios de interés"
- Rechazó una recomendación → registrar preferencia negativa
- Repite el mismo tipo de servicio → marcarlo como frecuente
- Mencionó experiencia negativa con un negocio → registrarlo

### Aprendizaje semántico del usuario:
Si el usuario usó una expresión particular y el agente la interpretó (o el usuario corrigió la interpretación), guardar la equivalencia:
"El usuario usa '[expresión]' para referirse a [tipo de servicio]"

Esto permite que en conversaciones futuras el agente entienda al usuario de forma más precisa sin necesidad de preguntar.

## Formato del archivo de memoria

Guardar en `agent/memory/{userId}.md`:

```markdown
# Memoria del Usuario {userId}
**Última actualización:** {fecha ISO}

## Datos personales
- Nombre: {si fue mencionado, si no: "no especificado"}
- Ciudad: {ciudad o "no especificada"}
- Barrio: {si fue mencionado}

## Preferencias aprendidas
- Servicios de interés: {lista}
- Precio máximo habitual: {valor o "no especificado"}
- Horarios preferidos: {mañana / tarde / noche / no especificado}
- Negocios favoritos: {lista con razones si las hay}
- Negocios con experiencia negativa: {lista con razones}

## Vocabulario particular del usuario
- "{expresión usada por este usuario}" → {tipo de servicio que significa para él/ella}

## Historial de interacciones
- {fecha}: Buscó "{servicio}" — resultado: {satisfecho / insatisfecho / sin resultados}
- {fecha}: Agendó cita con {negocio} para {servicio} el {fecha cita} a las {hora}
- {fecha}: Recomendación proactiva → {aceptada / rechazada}

## Notas adicionales
- {cualquier dato relevante no categorizado}
```

## Reglas críticas
- NUNCA eliminar entradas anteriores — solo agregar y actualizar
- Si un dato cambia (cambió de ciudad, etc.), actualizar el campo y añadir nota en historial
- La memoria es lo que convierte al agente en un asistente que realmente conoce al usuario
- Mantener el formato exacto para que futuras sesiones puedan leerla correctamente
```

---

## PARTE 4 — Backend: Servicio del Agente

### Crear `backend/src/services/agentService.js`

```javascript
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'
});

const AGENT_PATH = process.env.AGENT_MD_PATH
  ? path.resolve(process.env.AGENT_MD_PATH)
  : path.join(__dirname, '../../../agent');

function readMd(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  } catch (e) {
    return '';
  }
}

function readAllSkills() {
  const skillsPath = path.join(AGENT_PATH, 'skills');
  try {
    const files = fs.readdirSync(skillsPath)
      .filter(f => f.endsWith('.md'))
      .sort();
    return files
      .map(f => `## ${f}\n\n${readMd(path.join(skillsPath, f))}`)
      .join('\n\n---\n\n');
  } catch (e) {
    return '';
  }
}

function readUserMemory(userId) {
  const memoryPath = path.join(AGENT_PATH, 'memory', `${userId}.md`);
  return readMd(memoryPath);
}

function saveUserMemory(userId, content) {
  const memoryDir = path.join(AGENT_PATH, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }
  fs.writeFileSync(path.join(memoryDir, `${userId}.md`), content, 'utf-8');
}

function logActivity(userId, action, detail) {
  const logDir = path.join(AGENT_PATH, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const entry = `[${new Date().toISOString()}] USER:${userId} | ${action} | ${detail}\n`;
  fs.appendFileSync(path.join(logDir, 'agent_activity.log'), entry, 'utf-8');
}

async function processMessage(userId, userMessage, conversationHistory = []) {
  const agentContext = readMd(path.join(AGENT_PATH, 'context', 'NEXO_AGENT.md'));
  const userMemory = readUserMemory(userId);
  const skills = readAllSkills();

  const systemPrompt = `
${agentContext}

---

## MEMORIA DEL USUARIO ACTUAL (userId: ${userId})
${userMemory || 'Sin historial previo. Primera interacción con este usuario.'}

---

## SKILLS DISPONIBLES — LEER TODOS ANTES DE RESPONDER
${skills}

---

## INSTRUCCIONES DE FORMATO

Tu respuesta tiene dos partes:

PARTE 1 (visible para el usuario): tu respuesta normal, profesional y clara.

PARTE 2 (invisible para el usuario): el bloque de memoria actualizada, siempre al final, con este formato exacto:

[MEMORIA_ACTUALIZADA]
{contenido completo actualizado del archivo de memoria, integrando todo lo anterior más lo nuevo aprendido, usando el formato de skill_aprender.md}
[/MEMORIA_ACTUALIZADA]

Si no hay nada nuevo que aprender, incluir de todas formas la memoria actual sin cambios.
`.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const response = await client.chat.completions.create({
    model: process.env.GLM_MODEL || 'z-ai/glm-5.1',
    messages,
    max_tokens: 1500,
    temperature: 0.6
  });

  const fullResponse = response.choices[0].message.content;

  const memoryMatch = fullResponse.match(/\[MEMORIA_ACTUALIZADA\]([\s\S]*?)\[\/MEMORIA_ACTUALIZADA\]/);
  if (memoryMatch && memoryMatch[1].trim()) {
    saveUserMemory(userId, memoryMatch[1].trim());
    logActivity(userId, 'MEMORY_UPDATED', 'Memoria actualizada');
  }

  const cleanResponse = fullResponse
    .replace(/\[MEMORIA_ACTUALIZADA\][\s\S]*?\[\/MEMORIA_ACTUALIZADA\]/g, '')
    .trim();

  logActivity(userId, 'MESSAGE_PROCESSED', `"${userMessage.substring(0, 60)}"`);

  return { response: cleanResponse, memoryUpdated: !!memoryMatch };
}

module.exports = { processMessage, readUserMemory, saveUserMemory };
```

---

## PARTE 5 — Backend: Endpoints del Agente

### Crear `backend/src/routes/agent.js`

```javascript
const express = require('express');
const router = express.Router();
const { processMessage, readUserMemory } = require('../services/agentService');
const { authenticateToken } = require('../middlewares/auth');
const pool = require('../db');

router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, history = [] } = req.body;
    if (!message || message.trim() === '') {
      return res.json({ success: false, error: 'El mensaje no puede estar vacío' });
    }
    const result = await processMessage(userId, message, history);
    res.json({ success: true, data: { response: result.response, memoryUpdated: result.memoryUpdated } });
  } catch (error) {
    console.error('Error en agente:', error);
    res.json({ success: false, error: 'Error procesando el mensaje. Intente nuevamente.' });
  }
});

router.get('/buscar-tiendas', authenticateToken, async (req, res) => {
  try {
    const { servicio, ciudad, precioMax } = req.query;
    let query = `
      SELECT s.id, s.name, s.description, s.city, s.address,
             s.average_rating, s.price_range_min, s.price_range_max,
             u.name as owner_name
      FROM stores s
      JOIN users u ON s.owner_id = u.id
      WHERE s.is_active = true
    `;
    const params = [];
    if (servicio) {
      params.push(`%${servicio}%`);
      query += ` AND (LOWER(s.name) LIKE LOWER($${params.length}) OR LOWER(s.description) LIKE LOWER($${params.length}) OR LOWER(s.category) LIKE LOWER($${params.length}))`;
    }
    if (ciudad) {
      params.push(`%${ciudad}%`);
      query += ` AND LOWER(s.city) LIKE LOWER($${params.length})`;
    }
    if (precioMax) {
      params.push(Number(precioMax));
      query += ` AND s.price_range_min <= $${params.length}`;
    }
    query += ` ORDER BY s.average_rating DESC LIMIT 5`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.json({ success: false, error: 'Error en la búsqueda' });
  }
});

router.get('/disponibilidad', authenticateToken, async (req, res) => {
  try {
    const { storeId, fecha } = req.query;
    const result = await pool.query(`
      SELECT sa.id, sa.start_time, sa.end_time,
             sv.name as service_name, sv.price, sv.duration_minutes
      FROM store_availability sa
      JOIN services sv ON sa.service_id = sv.id
      WHERE sa.store_id = $1 AND DATE(sa.start_time) = $2 AND sa.is_available = true
      ORDER BY sa.start_time ASC
    `, [storeId, fecha]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.json({ success: false, error: 'Error obteniendo disponibilidad' });
  }
});

router.post('/agendar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeId, serviceId, availabilityId, notes } = req.body;
    await pool.query(`UPDATE store_availability SET is_available = false WHERE id = $1`, [availabilityId]);
    const result = await pool.query(`
      INSERT INTO appointments (client_id, store_id, service_id, availability_id, notes, status)
      VALUES ($1, $2, $3, $4, $5, 'confirmed') RETURNING id, created_at
    `, [userId, storeId, serviceId, availabilityId, notes || '']);
    res.json({ success: true, data: { appointmentId: result.rows[0].id, message: 'Cita agendada exitosamente' } });
  } catch (error) {
    res.json({ success: false, error: 'Error al agendar la cita' });
  }
});

router.get('/memoria', authenticateToken, async (req, res) => {
  try {
    const memory = readUserMemory(req.user.id);
    res.json({ success: true, data: { memory: memory || 'Sin memoria registrada aún' } });
  } catch (error) {
    res.json({ success: false, error: 'Error leyendo memoria' });
  }
});

module.exports = router;
```

### Registrar en `backend/src/index.js` o `backend/src/app.js`:
```javascript
const agentRoutes = require('./routes/agent');
app.use('/api/agent', agentRoutes);
```

---

## PARTE 6 — Frontend: Componente AgentChat

### Crear `frontend/src/components/AgentChat.jsx`

Implementar con:
- Burbuja flotante en esquina inferior derecha, color `#E8223A`, ícono de chat
- Clic abre panel: 380px ancho, 520px alto, sombra pronunciada, bordes redondeados
- Header: "Nexo AI" + ícono de robot + punto verde animado ("En línea")
- Mensajes usuario: fondo `#E8223A`, texto blanco, alineados derecha, bordes redondeados
- Mensajes agente: fondo `#F3F4F6`, texto `#111827`, alineados izquierda, bordes redondeados
- Indicador de escritura: tres puntos animados mientras espera respuesta del API
- Input con botón enviar; Enter también envía; deshabilitar input mientras carga
- Scroll automático al último mensaje
- Historial en estado local del componente
- Error de API: "Hubo un problema. Por favor intente nuevamente."
- Mensaje inicial (sin llamar API): "Bienvenido a Nexo AI. ¿En qué puedo ayudarle hoy?"
- Visible solo cuando el usuario está autenticado

```javascript
// Llamada a la API desde el frontend:
const response = await fetch('/api/agent/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: userInput,
    history: conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  })
});
```

### Agregar `<AgentChat />` en App.jsx o layout principal, renderizado solo si el usuario tiene sesión activa.

---

## PARTE 7 — Variables de entorno

### Agregar a `.env` local:
```
NVIDIA_API_KEY=tu_key_real_aqui
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
GLM_MODEL=z-ai/glm-5.1
AGENT_MD_PATH=./agent
```

### Agregar a `.env.example`:
```
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
GLM_MODEL=z-ai/glm-5.1
AGENT_MD_PATH=./agent
```

---

## PARTE 8 — Actualizar .gitignore

```
# Agente IA — datos privados de usuarios
agent/memory/*.md
agent/logs/*.log
```

Asegurarse que `agent/memory/` y `agent/logs/` tengan `.gitkeep` para preservar las carpetas en git.

---

## PARTE 9 — Verificación final

```bash
docker compose down
docker compose up --build
```

Verificar:
1. Sin errores de `bcrypt` en logs del backend ✓
2. Sin contenedor `ollama` en `docker ps` ✓
3. `POST /api/agent/chat` responde con texto del agente ✓
4. Tras el primer mensaje existe `agent/memory/{userId}.md` ✓
5. Chat flotante visible en el frontend para usuarios autenticados ✓

---

## Resumen de cambios

1. ✅ Fix bcrypt → bcryptjs (Windows/Linux)
2. ✅ Elimina Ollama completamente
3. ✅ Crea `agent/` con context + 5 skills + memory + logs
4. ✅ `skill_interpretar_intencion.md` — razonamiento semántico profundo: sinónimos, contexto implícito, grupos de equivalencia, estrategia de búsqueda progresiva, clarificación con una sola pregunta
5. ✅ `agentService.js` — lee las 3 capas de `.md` antes de cada respuesta, llama a GLM-5.1, extrae y persiste memoria automáticamente
6. ✅ Endpoints del agente con búsqueda progresiva por términos
7. ✅ Componente de chat flotante en frontend
8. ✅ Variables de entorno y .gitignore actualizados

---

*Archivo generado para Claude Code · Nexo Agent v1.1 · Modelo: GLM-5.1 vía NVIDIA NIM*
