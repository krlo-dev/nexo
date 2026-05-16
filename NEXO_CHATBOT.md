# Nexo — Chatbot de Recomendaciones (Adición al proyecto existente)

> **Propósito:** Agregar un chatbot conversacional a la aplicación Nexo ya existente. El chatbot permite al usuario escribir en lenguaje natural (ej: "quiero cortarme el cabello mañana en Barranquilla") y responde con tiendas reales de la DB filtradas por servicio, ciudad, disponibilidad y precio.

---

## 1. Contexto del Proyecto

El proyecto Nexo ya existe y está funcionando con:
- `frontend/` — React 18 + Vite + Tailwind
- `backend/` — Node.js + Express + JWT
- `ai-service/` — Ollama con `nomic-embed-text`
- `infra/init.sql` — Schema PostgreSQL con tablas: users, stores, services, business_hours, appointments, reviews

**Lo que hay que agregar:**
1. Descargar `qwen2.5:0.5b` en el contenedor Ollama existente
2. Nuevo endpoint en el backend: `POST /api/chat`
3. Nuevo componente en el frontend: `<ChatBot />`
4. Actualizar `ai-service/entrypoint.sh` para cargar ambos modelos

---

## 2. Cambios en el AI Service

### Actualizar `ai-service/entrypoint.sh`
```bash
#!/bin/bash
ollama serve &
sleep 5
ollama pull nomic-embed-text
ollama pull qwen2.5:0.5b
wait
```

Eso es todo en el ai-service. Ollama maneja ambos modelos en el mismo contenedor.

---

## 3. Nuevo Endpoint del Backend

### Crear `backend/src/controllers/chat.controller.js`

Lógica completa del chatbot:

```
1. Recibir { message, history } del frontend
2. Llamar a qwen2.5:0.5b para extraer intención del mensaje:
   - servicio buscado (ej: "corte de cabello")
   - ciudad (ej: "Barranquilla")
   - fecha preferida (ej: "mañana", "este viernes")
   - precio máximo si lo menciona (ej: "menos de 50000")
3. Con esos parámetros, consultar la DB:
   - Buscar stores activas filtrando por city (si se mencionó)
   - Buscar services que coincidan con el servicio buscado (ILIKE)
   - Para cada tienda encontrada, obtener disponibilidad del día pedido
   - Filtrar por precio si se mencionó
4. Armar un contexto con los resultados reales de la DB
5. Llamar a qwen2.5:0.5b de nuevo con ese contexto para generar respuesta natural
6. Retornar la respuesta al frontend
```

### Implementación detallada

**`backend/src/controllers/chat.controller.js`:**
```js
const pool = require('../db');
const { generateChatResponse, extractIntent } = require('../services/chat.service');

const chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || message.trim() === '') {
      return res.json({ success: false, error: 'Mensaje vacío' });
    }

    // 1. Extraer intención con qwen
    const intent = await extractIntent(message);

    // 2. Buscar en la DB con los parámetros extraídos
    const stores = await searchStores(intent);

    // 3. Generar respuesta natural con contexto real
    const response = await generateChatResponse(message, history, stores, intent);

    return res.json({ success: true, data: { response, stores } });
  } catch (err) {
    console.error('Chat error:', err);
    return res.json({ success: false, error: 'Error procesando tu mensaje' });
  }
};

const searchStores = async (intent) => {
  let query = `
    SELECT 
      s.id, s.name, s.slug, s.city, s.avg_rating, s.avatar_url,
      s.description, s.category,
      json_agg(
        json_build_object(
          'id', sv.id,
          'name', sv.name,
          'price', sv.price,
          'duration_minutes', sv.duration_minutes,
          'currency', sv.currency
        )
      ) FILTER (WHERE sv.id IS NOT NULL) as services
    FROM stores s
    LEFT JOIN services sv ON sv.store_id = s.id AND sv.is_active = true
    WHERE s.is_active = true
  `;

  const params = [];
  let paramIndex = 1;

  if (intent.city) {
    query += ` AND LOWER(s.city) ILIKE $${paramIndex}`;
    params.push(`%${intent.city.toLowerCase()}%`);
    paramIndex++;
  }

  if (intent.service) {
    query += ` AND (LOWER(s.name) ILIKE $${paramIndex} OR LOWER(s.category) ILIKE $${paramIndex} OR LOWER(s.description) ILIKE $${paramIndex})`;
    params.push(`%${intent.service.toLowerCase()}%`);
    paramIndex++;
  }

  query += ` GROUP BY s.id ORDER BY s.avg_rating DESC LIMIT 5`;

  const result = await pool.query(query, params);

  // Filtrar por precio si se indicó
  let stores = result.rows;
  if (intent.maxPrice && stores.length > 0) {
    stores = stores.map(store => ({
      ...store,
      services: (store.services || []).filter(sv => 
        !sv.price || parseFloat(sv.price) <= intent.maxPrice
      )
    })).filter(store => store.services && store.services.length > 0);
  }

  return stores;
};

module.exports = { chat };
```

**`backend/src/services/chat.service.js`:**
```js
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ai-service:11434';

const extractIntent = async (message) => {
  const prompt = `Eres un asistente que extrae información de búsqueda de mensajes en español.
Del siguiente mensaje extrae SOLO un objeto JSON con estos campos (usa null si no se menciona):
- service: el tipo de servicio que busca (string corto, ej: "corte de cabello", "fisioterapia", "reparación celular")
- city: la ciudad donde busca (string, ej: "Barranquilla", "Bogotá")
- date: la fecha en formato YYYY-MM-DD si la menciona ("mañana" = fecha de mañana, "hoy" = fecha de hoy)
- maxPrice: precio máximo en números enteros si lo menciona (null si no)

Responde ÚNICAMENTE con el JSON, sin explicación ni texto adicional.

Mensaje: "${message}"

Fecha actual: ${new Date().toISOString().split('T')[0]}

JSON:`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:0.5b',
      prompt,
      stream: false,
      options: { temperature: 0.1, num_predict: 150 }
    })
  });

  const data = await res.json();

  try {
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Si falla el parseo retornar intención vacía
  }

  return { service: null, city: null, date: null, maxPrice: null };
};

const generateChatResponse = async (userMessage, history, stores, intent) => {
  let context = '';

  if (stores.length === 0) {
    context = 'No encontré tiendas disponibles con esos criterios en Nexo.';
  } else {
    context = `Encontré ${stores.length} opción(es) en Nexo:\n\n`;
    stores.forEach((store, i) => {
      context += `${i + 1}. **${store.name}** (${store.city})\n`;
      context += `   Rating: ${store.avg_rating}/5\n`;
      if (store.services && store.services.length > 0) {
        store.services.slice(0, 3).forEach(sv => {
          const precio = sv.price ? `$${parseInt(sv.price).toLocaleString('es-CO')} ${sv.currency}` : 'precio a consultar';
          context += `   - ${sv.name}: ${precio}, ${sv.duration_minutes} min\n`;
        });
      }
      context += `   Ver perfil: /store/${store.slug}\n\n`;
    });
  }

  // Construir historial de conversación
  const historyText = history.slice(-4).map(h => 
    `${h.role === 'user' ? 'Usuario' : 'Nexo'}: ${h.content}`
  ).join('\n');

  const prompt = `Eres el asistente de Nexo, una plataforma de agendamiento de citas para negocios locales. 
Eres amable, conciso y útil. Solo recomiendas negocios que existen en Nexo.
Responde siempre en español, de forma natural y breve (máximo 4 oraciones).

${historyText ? `Conversación anterior:\n${historyText}\n\n` : ''}
Usuario preguntó: "${userMessage}"

Información disponible en Nexo:
${context}

Responde de forma natural y útil basándote SOLO en la información de Nexo mostrada arriba:`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:0.5b',
      prompt,
      stream: false,
      options: { temperature: 0.7, num_predict: 300 }
    })
  });

  const data = await res.json();
  return data.response || 'Lo siento, no pude procesar tu consulta en este momento.';
};

module.exports = { extractIntent, generateChatResponse };
```

### Agregar la ruta en `backend/src/routes/chat.routes.js`
```js
const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/chat.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.post('/', authenticateToken, chat);

module.exports = router;
```

### Registrar la ruta en `backend/src/app.js`
Agregar esta línea donde están el resto de rutas:
```js
app.use('/api/chat', require('./routes/chat.routes'));
```

---

## 4. Componente Frontend

### Crear `frontend/src/components/ChatBot.jsx`

El chatbot debe ser un botón flotante en la esquina inferior derecha que al hacer clic abre un panel de chat. Características:

**Diseño visual:**
- Botón flotante circular en color `#E8223A` (nexo-red) con ícono de chat, posición `fixed bottom-6 right-6`
- Panel de chat: 380px ancho, 520px alto, esquinas redondeadas, sombra suave con tinte rojo
- Header del panel: fondo `#E8223A`, logo/nombre "Asistente Nexo", botón cerrar
- Burbujas de mensaje: usuario en rojo claro (`#FDEAED`), bot en gris claro
- Input en la parte inferior con botón enviar en rojo
- Mensaje de bienvenida inicial: "Hola! Soy el asistente de Nexo. Dime qué servicio buscas, en qué ciudad y cuándo, y te ayudo a encontrar el lugar perfecto."

**Estado del componente:**
```
- isOpen: boolean — abre/cierra el panel
- messages: array de { role: 'user'|'bot', content: string }
- input: string — texto del input
- isLoading: boolean — mientras espera respuesta
- stores: array — tiendas retornadas por la API (para mostrar cards)
```

**Comportamiento:**
- Al enviar un mensaje llamar a `POST /api/chat` con `{ message, history }`
- Mostrar spinner animado en rojo mientras carga
- Si la respuesta incluye tiendas, mostrar mini-cards debajo del mensaje del bot con: nombre, ciudad, rating, precio mínimo del servicio y botón "Ver tienda" que lleva a `/store/:slug`
- El historial se mantiene en el estado local (últimos 10 mensajes)
- Al abrir el chat por primera vez mostrar el mensaje de bienvenida automáticamente
- Input con placeholder: "Ej: quiero cortarme el cabello mañana en Barranquilla..."
- Tecla Enter envía el mensaje

**Estructura JSX esperada:**
```
<div> (wrapper fixed)
  {isOpen && (
    <div> (panel del chat)
      <header> (rojo, título + botón cerrar)
      <div> (área de mensajes, scrollable)
        {messages.map(msg => (
          <div> (burbuja usuario o bot)
          {msg.stores && <div> (mini-cards de tiendas) }
        ))}
        {isLoading && <div> (spinner) }
      </div>
      <div> (input + botón enviar)
    </div>
  )}
  <button> (botón flotante circular rojo)
</div>
```

### Integrar `<ChatBot />` en el layout principal

En `frontend/src/App.jsx` o en el componente de layout principal, importar y agregar `<ChatBot />` al final del JSX, fuera de cualquier contenedor, para que quede flotante sobre toda la app:

```jsx
import ChatBot from './components/ChatBot';

// Al final del return, antes del cierre:
<ChatBot />
```

El chatbot debe aparecer en TODAS las páginas (landing, explorar, perfil de tienda, dashboard) excepto en las páginas de auth (login/register) y en el panel admin.

---

## 5. Instrucciones de Implementación para Claude Code

Implementar en este orden:

1. Actualizar `ai-service/entrypoint.sh` agregando `ollama pull qwen2.5:0.5b`
2. Crear `backend/src/services/chat.service.js` con `extractIntent` y `generateChatResponse`
3. Crear `backend/src/controllers/chat.controller.js` con la función `chat` y `searchStores`
4. Crear `backend/src/routes/chat.routes.js`
5. Registrar la ruta `/api/chat` en `backend/src/app.js`
6. Crear `frontend/src/components/ChatBot.jsx` con todo el diseño y lógica
7. Integrar `<ChatBot />` en el layout principal de la app

### Notas importantes

- El endpoint `POST /api/chat` requiere JWT (usuario autenticado)
- Si Ollama no responde o qwen no está disponible aún, el backend debe retornar un mensaje amable: "El asistente está iniciando, intenta en unos segundos"
- El modelo `qwen2.5:0.5b` tarda ~30-60 segundos en responder la primera vez (cold start), después es más rápido
- El frontend debe mostrar un mensaje de "pensando..." con animación mientras espera
- Las mini-cards de tiendas deben ser clickeables y llevar a `/store/:slug`
- Usar los colores del branding Nexo: `#E8223A` para elementos del bot, `#FDEAED` para fondo de mensajes del bot
- El chatbot NO puede agendar citas directamente, solo recomienda y redirige al perfil de la tienda
- Manejar errores de red con mensaje amable al usuario

### Para aplicar los cambios con Docker

Después de que Claude Code genere los archivos, ejecutar en la terminal:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

El ai-service descargará `qwen2.5:0.5b` automáticamente (~400MB). Puede tardar 3-5 minutos la primera vez.

---

*Archivo generado para uso con Claude Code · Nexo Chatbot v0.1.0*
