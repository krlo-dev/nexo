# Nexo Agent — Fix: Tool Use / Function Calling

## Estado al terminar la sesión

El agente GLM-5.1 está conectado y responde en español. El problema crítico es que **inventa tiendas** en lugar de consultar la base de datos real.

### Ejemplo del problema (chat real)

El usuario pidió fisioterapia en Medellín. El agente respondió con:
- FisioVida Medellín (inventada)
- Centro de Rehabilitación Integral (inventada)
- Movimiento Libre (inventada)

La única tienda real en Medellín en la DB es **Dr. Martínez Fisioterapia**.

---

## Causa raíz

La arquitectura actual le da al LLM los skills como texto en el system prompt. El skill `skill_buscar_tiendas.md` le dice al modelo que llame a `GET /api/agent/buscar-tiendas`, pero el LLM **no puede hacer llamadas HTTP por sí solo** — solo genera texto. Entonces alucina resultados que suenan plausibles.

Los endpoints `/api/agent/buscar-tiendas`, `/api/agent/disponibilidad` y `/api/agent/agendar` existen y funcionan correctamente, pero **nunca son llamados** durante una conversación.

---

## Fix: Function Calling (Tool Use)

La solución es implementar **function calling** con el SDK de OpenAI apuntado a NVIDIA NIM. El flujo correcto:

```
Usuario: "busco fisioterapia en Medellín"
    ↓
LLM decide llamar la herramienta buscar_tiendas({ servicio: "fisioterapia", ciudad: "Medellín" })
    ↓
Backend ejecuta la query real en PostgreSQL
    ↓
Backend devuelve los resultados reales al LLM
    ↓
LLM genera respuesta final con datos reales
```

### Paso 1 — Definir las herramientas en `agentService.js`

Agregar el array `tools` a la llamada de `client.chat.completions.create`:

```js
const tools = [
  {
    type: 'function',
    function: {
      name: 'buscar_tiendas',
      description: 'Busca tiendas y negocios reales registrados en Nexo según el servicio, ciudad y precio máximo.',
      parameters: {
        type: 'object',
        properties: {
          servicio: { type: 'string', description: 'Tipo de servicio buscado (ej: fisioterapia, corte cabello)' },
          ciudad:   { type: 'string', description: 'Ciudad donde buscar (ej: Medellín, Bogotá)' },
          precioMax:{ type: 'number', description: 'Precio máximo en COP (opcional)' },
        },
        required: ['servicio'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_disponibilidad',
      description: 'Obtiene los slots de horario disponibles de una tienda para un servicio y fecha específicos.',
      parameters: {
        type: 'object',
        properties: {
          storeId:   { type: 'string', description: 'ID UUID de la tienda' },
          serviceId: { type: 'string', description: 'ID UUID del servicio' },
          fecha:     { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        },
        required: ['storeId', 'serviceId', 'fecha'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_cita',
      description: 'Crea una cita para el usuario autenticado.',
      parameters: {
        type: 'object',
        properties: {
          storeId:   { type: 'string', description: 'ID UUID de la tienda' },
          serviceId: { type: 'string', description: 'ID UUID del servicio' },
          startTime: { type: 'string', description: 'Fecha y hora de inicio en ISO 8601 (ej: 2026-05-15T10:00:00Z)' },
          notes:     { type: 'string', description: 'Notas opcionales para el negocio' },
        },
        required: ['storeId', 'serviceId', 'startTime'],
      },
    },
  },
];
```

### Paso 2 — Loop de ejecución de herramientas en `processMessage`

Reemplazar la llamada única al LLM por un loop que soporte tool calls:

```js
async function processMessage(userId, userMessage, conversationHistory = []) {
  const systemPrompt = buildSystemPrompt(userId); // extraer construcción del prompt

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let fullResponse = '';

  // Loop: el LLM puede llamar herramientas múltiples veces antes de responder
  while (true) {
    const completion = await client.chat.completions.create({
      model: process.env.GLM_MODEL || 'z-ai/glm-5.1',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1500,
      temperature: 0.6,
    });

    const choice = completion.choices[0];

    // Si el LLM quiere llamar una herramienta
    if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length > 0) {
      messages.push(choice.message); // agregar respuesta del asistente con tool_calls

      // Ejecutar cada herramienta solicitada
      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args, userId);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      // Continuar el loop para que el LLM procese los resultados
      continue;
    }

    // Si el LLM dio respuesta final
    fullResponse = choice.message.content;
    break;
  }

  // Extraer y guardar memoria
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
```

### Paso 3 — Función `executeTool` en `agentService.js`

Esta función ejecuta las queries reales. Necesita recibir el `userId` para `agendar_cita`.

```js
const pool = require('../utils/db');
const { getAvailableSlots } = require('./availability.service');

async function executeTool(toolName, args, userId) {
  try {
    if (toolName === 'buscar_tiendas') {
      const { servicio, ciudad, precioMax } = args;
      let query = `
        SELECT s.id, s.name, s.slug, s.description, s.city,
               s.avg_rating, s.category, s.phone
        FROM stores s
        WHERE s.is_active = true
      `;
      const params = [];
      if (servicio) {
        params.push(`%${servicio}%`);
        const n = params.length;
        query += ` AND (LOWER(s.name) LIKE LOWER($${n}) OR LOWER(s.description) LIKE LOWER($${n}) OR LOWER(s.category) LIKE LOWER($${n}))`;
      }
      if (ciudad) {
        params.push(`%${ciudad}%`);
        query += ` AND LOWER(s.city) LIKE LOWER($${params.length})`;
      }
      query += ` ORDER BY s.avg_rating DESC LIMIT 5`;
      const storesResult = await pool.query(query, params);

      // Obtener servicios de cada tienda
      const stores = await Promise.all(storesResult.rows.map(async (store) => {
        const svResult = await pool.query(
          'SELECT id, name, price, duration_minutes, currency FROM services WHERE store_id = $1 AND is_active = true ORDER BY price ASC',
          [store.id]
        );
        const services = precioMax
          ? svResult.rows.filter(s => parseFloat(s.price) <= parseFloat(precioMax))
          : svResult.rows;
        return { ...store, services };
      }));

      return stores.length > 0
        ? { found: true, stores }
        : { found: false, message: 'No se encontraron tiendas con esos criterios en Nexo.' };
    }

    if (toolName === 'verificar_disponibilidad') {
      const { storeId, serviceId, fecha } = args;
      const slots = await getAvailableSlots(storeId, fecha, serviceId);
      return slots.length > 0
        ? { available: true, slots }
        : { available: false, message: 'No hay horarios disponibles para esa fecha.' };
    }

    if (toolName === 'agendar_cita') {
      const { storeId, serviceId, startTime, notes } = args;
      const serviceResult = await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
      if (!serviceResult.rows[0]) return { success: false, error: 'Servicio no encontrado.' };

      const start = new Date(startTime);
      const end = new Date(start.getTime() + serviceResult.rows[0].duration_minutes * 60000);

      const conflict = await pool.query(
        `SELECT id FROM appointments WHERE store_id = $1 AND status != 'cancelled' AND start_time < $2 AND end_time > $3`,
        [storeId, end.toISOString(), start.toISOString()]
      );
      if (conflict.rows[0]) return { success: false, error: 'Horario no disponible, ya está reservado.' };

      const result = await pool.query(
        `INSERT INTO appointments (client_id, service_id, store_id, start_time, end_time, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, start_time, end_time, status`,
        [userId, serviceId, storeId, start.toISOString(), end.toISOString(), notes || '']
      );
      return { success: true, appointmentId: result.rows[0].id, message: 'Cita creada exitosamente.' };
    }

    return { error: `Herramienta desconocida: ${toolName}` };
  } catch (err) {
    console.error(`executeTool error (${toolName}):`, err.message);
    return { error: 'Error ejecutando la herramienta. Intente nuevamente.' };
  }
}
```

### Paso 4 — Simplificar los skills

Con function calling, los skills `skill_buscar_tiendas.md`, `skill_agendar_cita.md` y `skill_recomendar.md` ya no necesitan describir los endpoints HTTP — el LLM los llama automáticamente. Simplificar estos archivos para que solo describan **cuándo** usar cada herramienta y **cómo presentar los resultados**, no el mecanismo técnico.

### Paso 5 — Verificar compatibilidad de GLM-5.1 con tool_choice

Antes de implementar, confirmar que el modelo `z-ai/glm-5.1` soporta `tool_calls` en NVIDIA NIM. Si no lo soporta, el fallback es usar `meta/llama-3.1-70b-instruct` o `meta/llama-3.3-70b-instruct` que sí lo soportan.

Test rápido:
```bash
docker-compose exec backend node -e "
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: process.env.NVIDIA_BASE_URL });
client.chat.completions.create({
  model: process.env.GLM_MODEL,
  messages: [{ role: 'user', content: 'busca peluquerías en Bogotá' }],
  tools: [{ type: 'function', function: { name: 'buscar_tiendas', description: 'busca tiendas', parameters: { type: 'object', properties: { ciudad: { type: 'string' } }, required: [] } } }],
  tool_choice: 'auto', max_tokens: 200
}).then(r => console.log(JSON.stringify(r.choices[0]))).catch(e => console.error(e.message));
"
```

Si `finish_reason` es `tool_calls` → el modelo soporta tool use y se puede implementar el fix completo.
Si da error → cambiar el modelo a `meta/llama-3.3-70b-instruct` en el `.env`.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/agentService.js` | Agregar `tools`, loop de tool calls, función `executeTool` |
| `agent/skills/skill_buscar_tiendas.md` | Simplificar (ya no describe endpoints HTTP) |
| `agent/skills/skill_agendar_cita.md` | Simplificar (ya no describe endpoints HTTP) |
| `agent/skills/skill_recomendar.md` | Simplificar (ya no describe endpoints HTTP) |

`agent.js` (routes), `AgentChat.jsx` y el resto del stack **no necesitan cambios**.

---

## Orden de implementación para mañana

1. Correr el test de tool_choice (Paso 5) para confirmar que GLM-5.1 lo soporta
2. Refactorizar `agentService.js` con el loop + `executeTool`
3. Simplificar los 3 skills afectados
4. Reiniciar el backend y probar con el mismo caso: "fisioterapia en Medellín"
5. Verificar que el agente devuelve **Dr. Martínez Fisioterapia** (la única real en la DB)
