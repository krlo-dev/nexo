# Nexo — Corrección del Chatbot con Búsqueda Semántica

> **Propósito:** Reescribir completamente la lógica del chatbot de Nexo para que use búsqueda semántica real con `nomic-embed-text` + `qwen2.5:0.5b`. El chatbot NUNCA debe mostrar información incorrecta o tiendas que no correspondan a lo que el usuario pide. Si no hay resultados relevantes, SIEMPRE debe decirlo claramente.

---

## Regla de Oro (leer antes de implementar)

**NUNCA se llama al modelo qwen ni se muestran tiendas si el score de similitud semántica no supera el umbral mínimo de 0.35.**

Si ninguna tienda supera ese umbral → retornar mensaje hardcodeado de "no encontré nada", sin excepciones, sin fallbacks que muestren tiendas random.

---

## 1. Arquitectura del Flujo

```
Usuario: "quiero acicalarme en Bogotá"
         │
         ▼
[PASO 1] qwen2.5:0.5b — Normalización de intención
         Convierte lenguaje coloquial a términos de búsqueda estándar
         Output: { searchText: "arreglo personal corte cabello", city: "bogotá", maxPrice: null, isAppointmentRelated: true }
         │
         ▼
[PASO 2] nomic-embed-text — Embedding de la búsqueda
         Genera vector del searchText
         │
         ▼
[PASO 3] Node.js — Similitud coseno contra embeddings de tiendas en DB
         Compara el vector de búsqueda contra embedding de cada tienda activa
         Filtra adicionalmente por city si se proporcionó
         Filtra adicionalmente por maxPrice si se proporcionó
         UMBRAL: score >= 0.35 para considerar una tienda relevante
         │
         ▼
[PASO 4A] Si NINGUNA tienda supera 0.35:
          → Retornar mensaje hardcodeado SIN llamar a qwen
          → NO mostrar ninguna tienda
          FIN
         │
[PASO 4B] Si HAY tiendas que superan 0.35:
          → Ordenar por score descendente
          → Tomar máximo las 3 mejores
          → Llamar a qwen2.5:0.5b SOLO para redactar respuesta natural
          → qwen recibe ÚNICAMENTE los datos reales de esas tiendas
          FIN
```

---

## 2. Archivos a Reescribir Completamente

### `backend/src/services/chat.service.js`

Reescribir con exactamente estas funciones:

```js
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ai-service:11434';
const SIMILARITY_THRESHOLD = 0.35;
const MAX_RESULTS = 3;

/**
 * PASO 1: Normalizar la intención del usuario con qwen2.5:0.5b
 * qwen convierte lenguaje coloquial a términos de búsqueda estándar
 * y extrae ciudad y precio si se mencionan
 */
const normalizeIntent = async (message) => {
  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are a search intent extractor for a Colombian appointment booking platform.
Extract search parameters from the user message and return ONLY a JSON object.

Rules:
- "searchText": normalize the service the user wants into standard Spanish service terms (2-5 words max). Examples: "acicalarme" → "corte cabello arreglo personal", "ponerme bonita" → "belleza maquillaje cabello", "que me vean los dientes" → "odontología dental", "arreglar mi cel" → "reparación celular"
- "city": extract city name if mentioned, normalize to standard name (e.g. "bogotá", "medellín", "cali", "barranquilla"). null if not mentioned.
- "maxPrice": extract maximum price as integer if mentioned (e.g. "menos de 50000" → 50000). null if not mentioned.
- "isAppointmentRelated": true if the message is about finding a local service or business to visit. false if the message is about something completely unrelated (weather, math, jokes, etc.)

Today: ${today}
User message: "${message}"

Respond ONLY with valid JSON, no explanation:`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:0.5b',
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 120 }
      })
    });

    const data = await res.json();
    const jsonMatch = data.response && data.response.match(/\{[\s\S]*?\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        searchText: parsed.searchText || null,
        city: parsed.city ? parsed.city.toLowerCase().trim() : null,
        maxPrice: parsed.maxPrice ? parseInt(parsed.maxPrice) : null,
        isAppointmentRelated: parsed.isAppointmentRelated !== false
      };
    }
  } catch (e) {
    console.error('normalizeIntent error:', e.message);
  }

  // Fallback seguro si qwen falla
  return { searchText: null, city: null, maxPrice: null, isAppointmentRelated: true };
};

/**
 * PASO 2: Generar embedding de texto con nomic-embed-text
 */
const generateEmbedding = async (text) => {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  });

  const data = await res.json();
  return data.embedding; // array de floats
};

/**
 * PASO 3: Similitud coseno entre dos vectores
 */
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

/**
 * PASO 4B: Generar respuesta natural con qwen2.5:0.5b
 * Solo se llama cuando HAY tiendas reales que mostrar
 * qwen recibe únicamente los datos reales, nunca inventa
 */
const generateNaturalResponse = async (userMessage, stores) => {
  // Construir contexto con SOLO los datos reales de las tiendas encontradas
  let context = '';
  stores.forEach((store, i) => {
    context += `${i + 1}. ${store.name} (${store.city})`;
    if (store.avg_rating) context += ` — Rating: ${store.avg_rating}/5`;
    context += '\n';
    if (store.matchedServices && store.matchedServices.length > 0) {
      store.matchedServices.forEach(sv => {
        const precio = sv.price
          ? `$${parseInt(sv.price).toLocaleString('es-CO')} ${sv.currency || 'COP'}`
          : 'precio a consultar';
        context += `   • ${sv.name}: ${precio}, ${sv.duration_minutes} min\n`;
      });
    }
  });

  const prompt = `You are "Asistente Nexo", a helpful assistant for a Colombian appointment booking app.

STRICT RULES — you MUST follow these without exception:
1. Use ONLY the store information provided in the DATA section below.
2. Do NOT invent, add or assume any store name, service, price or detail not present in DATA.
3. Respond in friendly conversational Spanish, maximum 2-3 sentences.
4. Mention the store names and at least one service with its price from DATA.
5. End by inviting the user to visit the store profile to book an appointment.

User asked: "${userMessage}"

DATA (real stores found in Nexo):
${context}

Your response (in Spanish, using only the data above):`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:0.5b',
        prompt,
        stream: false,
        options: { temperature: 0.5, num_predict: 200 }
      })
    });

    const data = await res.json();
    return data.response ? data.response.trim() : null;
  } catch (e) {
    console.error('generateNaturalResponse error:', e.message);
    return null;
  }
};

module.exports = {
  normalizeIntent,
  generateEmbedding,
  cosineSimilarity,
  generateNaturalResponse,
  SIMILARITY_THRESHOLD,
  MAX_RESULTS
};
```

---

### `backend/src/controllers/chat.controller.js`

Reescribir completamente con esta lógica:

```js
const pool = require('../db');
const {
  normalizeIntent,
  generateEmbedding,
  cosineSimilarity,
  generateNaturalResponse,
  SIMILARITY_THRESHOLD,
  MAX_RESULTS
} = require('../services/chat.service');

const chat = async (req, res) => {
  try {
    const { message } = req.body;

    // Validación básica del mensaje
    if (!message || message.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          response: 'Por favor escribe qué servicio estás buscando.',
          stores: []
        }
      });
    }

    // ── PASO 1: Normalizar intención con qwen ──────────────────────────
    const intent = await normalizeIntent(message.trim());

    // Si el mensaje no tiene nada que ver con agendar citas o servicios locales
    if (!intent.isAppointmentRelated || !intent.searchText) {
      return res.json({
        success: true,
        data: {
          response: 'Solo puedo ayudarte a encontrar servicios y negocios locales en Nexo. ¿Qué servicio estás buscando?',
          stores: []
        }
      });
    }

    // ── PASO 2: Generar embedding del searchText ───────────────────────
    let searchEmbedding;
    try {
      searchEmbedding = await generateEmbedding(intent.searchText);
    } catch (e) {
      console.error('Embedding generation failed:', e.message);
      return res.json({
        success: true,
        data: {
          response: 'El asistente está iniciando. Por favor intenta en unos segundos.',
          stores: []
        }
      });
    }

    if (!searchEmbedding || searchEmbedding.length === 0) {
      return res.json({
        success: true,
        data: {
          response: 'El asistente está iniciando. Por favor intenta en unos segundos.',
          stores: []
        }
      });
    }

    // ── PASO 3: Obtener tiendas activas con embedding y servicios ──────
    let storeQuery = `
      SELECT
        s.id,
        s.name,
        s.slug,
        s.city,
        s.avg_rating,
        s.avatar_url,
        s.embedding,
        json_agg(
          json_build_object(
            'id', sv.id,
            'name', sv.name,
            'price', sv.price,
            'duration_minutes', sv.duration_minutes,
            'currency', sv.currency
          )
        ) FILTER (WHERE sv.id IS NOT NULL AND sv.is_active = true) as services
      FROM stores s
      LEFT JOIN services sv ON sv.store_id = s.id AND sv.is_active = true
      WHERE s.is_active = true AND s.embedding IS NOT NULL
    `;

    const params = [];

    // Filtro por ciudad si se detectó
    if (intent.city) {
      params.push(`%${intent.city}%`);
      storeQuery += ` AND LOWER(s.city) ILIKE $${params.length}`;
    }

    storeQuery += ` GROUP BY s.id`;

    const storesResult = await pool.query(storeQuery, params);

    if (storesResult.rows.length === 0) {
      // No hay tiendas en esa ciudad
      const cityMsg = intent.city ? ` en ${intent.city}` : '';
      return res.json({
        success: true,
        data: {
          response: `No encontré negocios disponibles${cityMsg} en Nexo por el momento. Puedes explorar todas las tiendas en /explore.`,
          stores: []
        }
      });
    }

    // ── PASO 4: Calcular similitud coseno y aplicar umbral ─────────────
    const scoredStores = storesResult.rows
      .map(store => {
        let storeEmbedding;
        try {
          storeEmbedding = typeof store.embedding === 'string'
            ? JSON.parse(store.embedding)
            : store.embedding;
        } catch (e) {
          return null; // ignorar tiendas con embedding corrupto
        }

        const score = cosineSimilarity(searchEmbedding, storeEmbedding);
        return { ...store, score };
      })
      .filter(store => store !== null)
      // ── UMBRAL ESTRICTO: descartar todo lo que no sea relevante ──────
      .filter(store => store.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);

    // ── PASO 4A: Sin resultados relevantes → mensaje claro, sin tiendas ─
    if (scoredStores.length === 0) {
      const serviceMsg = intent.searchText || 'ese servicio';
      const cityMsg = intent.city ? ` en ${intent.city}` : '';
      return res.json({
        success: true,
        data: {
          response: `No encontré "${serviceMsg}"${cityMsg} en Nexo. Te invito a explorar todas las tiendas disponibles en /explore para ver qué servicios tenemos.`,
          stores: []
        }
      });
    }

    // ── PASO 4B: Hay resultados → preparar datos reales para qwen ──────

    // Para cada tienda encontrada, filtrar servicios por precio si aplica
    // y marcar cuáles servicios son los más relevantes para mostrar
    const storesForResponse = scoredStores.map(store => {
      let services = store.services || [];

      // Filtrar por precio máximo si se indicó
      if (intent.maxPrice) {
        services = services.filter(sv =>
          !sv.price || parseFloat(sv.price) <= intent.maxPrice
        );
      }

      // Tomar máximo 3 servicios por tienda para no saturar el contexto de qwen
      const matchedServices = services.slice(0, 3);

      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        city: store.city,
        avg_rating: store.avg_rating,
        avatar_url: store.avatar_url,
        score: store.score,
        matchedServices
      };
    });

    // Filtrar tiendas donde quedaron 0 servicios después del filtro de precio
    const finalStores = storesForResponse.filter(store =>
      store.matchedServices && store.matchedServices.length > 0
    );

    // Si tras filtrar por precio no quedó nada
    if (finalStores.length === 0) {
      const priceMsg = intent.maxPrice
        ? ` con precio menor a $${parseInt(intent.maxPrice).toLocaleString('es-CO')}`
        : '';
      return res.json({
        success: true,
        data: {
          response: `Encontré tiendas relacionadas pero ninguna tiene servicios${priceMsg}. Prueba aumentando el presupuesto o explora en /explore.`,
          stores: []
        }
      });
    }

    // ── PASO 5: qwen genera respuesta natural con datos reales ──────────
    let naturalResponse = await generateNaturalResponse(message, finalStores);

    // Si qwen falla por algún motivo, usar respuesta de fallback estructurada
    // basada en los datos reales (nunca inventada)
    if (!naturalResponse) {
      const names = finalStores.map(s => s.name).join(', ');
      naturalResponse = `Encontré ${finalStores.length} opción(es) para ti en Nexo: ${names}. Revisa los perfiles para ver disponibilidad y agendar tu cita.`;
    }

    return res.json({
      success: true,
      data: {
        response: naturalResponse,
        stores: finalStores
      }
    });

  } catch (err) {
    console.error('Chat controller error:', err);
    return res.json({
      success: false,
      error: 'Ocurrió un error procesando tu consulta. Por favor intenta de nuevo.'
    });
  }
};

module.exports = { chat };
```

---

## 3. Verificar que el Frontend Muestra Solo lo que Llega

En `frontend/src/components/ChatBot.jsx`, verificar que:

1. Las mini-cards de tiendas se renderizan **únicamente** cuando `stores` es un array con al menos 1 elemento
2. Si `stores` llega vacío (`[]`) → no renderizar ninguna card, solo el texto de respuesta
3. El texto de respuesta siempre se muestra (viene del backend, nunca del frontend)

El código de renderizado de stores debe ser exactamente así:
```jsx
{msg.stores && msg.stores.length > 0 && (
  <div className="mt-2 space-y-2">
    {msg.stores.map(store => (
      <StoreCard key={store.id} store={store} />
    ))}
  </div>
)}
```

Si ya está así, no tocar. Si no, corregirlo.

---

## 4. Casos de Prueba Esperados

Después de implementar, estos son los comportamientos esperados:

| Usuario dice | Comportamiento esperado |
|---|---|
| "quiero cortarme el cabello en Bogotá" | Muestra Salón Valentina con sus servicios |
| "quiero acicalarme" | Muestra Salón Valentina (similitud semántica) |
| "busco fisioterapia" | Muestra Dr. Martínez Fisioterapia |
| "quiero arreglar mi celular" | Muestra TechFix Reparaciones |
| "venta de xbox 360" | Respuesta: "No encontré ese servicio en Nexo" — sin tiendas |
| "quiero pizza" | Respuesta: "No encontré ese servicio en Nexo" — sin tiendas |
| "cuánto es 2+2" | Respuesta: "Solo puedo ayudarte con servicios locales" |
| "quiero cortarme el cabello en Barranquilla" | Respuesta: "No encontré en Barranquilla" (no hay tiendas allá en el seed) |

---

## 5. Notas Importantes para Claude Code

- **No cambiar** `ai-service/entrypoint.sh` ni agregar nuevos modelos. `nomic-embed-text` y `qwen2.5:0.5b` ya están descargados.
- **No cambiar** el schema de la DB. La columna `embedding` en `stores` ya existe y tiene datos del seed.
- **No cambiar** `chat.routes.js` ni el registro de la ruta en `app.js`.
- El `SIMILARITY_THRESHOLD = 0.35` es el valor mínimo. Si en pruebas los resultados siguen siendo malos, se puede ajustar subiendo a 0.40 o bajando a 0.30, pero implementar con 0.35.
- El fallback de `generateNaturalResponse` cuando qwen falla debe usar **solo** los nombres reales de `finalStores`, nunca texto inventado.
- Los únicos archivos a modificar son:
  - `backend/src/services/chat.service.js` (reescribir completo)
  - `backend/src/controllers/chat.controller.js` (reescribir completo)
  - `frontend/src/components/ChatBot.jsx` (solo verificar/corregir el renderizado de stores)

---

*Archivo generado para uso con Claude Code · Nexo Chatbot Fix v0.2.0*
