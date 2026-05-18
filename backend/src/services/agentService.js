const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const pool = require('../utils/db');
const { getAvailableSlots } = require('./availability.service');

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

const AGENT_PATH = process.env.AGENT_MD_PATH
  ? path.resolve(process.env.AGENT_MD_PATH)
  : path.join(__dirname, '../../agent');

// ── RAM cache — contexto y skills nunca cambian en runtime ────────────────
let _agentContext = null;
let _skillsContent = null;
const _memoryCache = new Map();

// ── Único tool: solo agendar requiere escribir en DB ──────────────────────
const tools = [
  {
    type: 'function',
    function: {
      name: 'agendar_cita',
      description: 'Crea una cita en la base de datos. Usar ÚNICAMENTE cuando el usuario confirme explícitamente que desea agendar.',
      parameters: {
        type: 'object',
        properties: {
          storeId:   { type: 'string', description: 'ID UUID de la tienda, copiado exactamente de los DATOS REALES inyectados en el contexto' },
          serviceId: { type: 'string', description: 'ID UUID del servicio, copiado exactamente de los DATOS REALES inyectados en el contexto' },
          startTime: { type: 'string', description: 'Fecha y hora en formato YYYY-MM-DDThh:mm:00Z usando el slot exacto de la disponibilidad inyectada' },
          notes:     { type: 'string', description: 'Notas opcionales para el negocio' },
        },
        required: ['storeId', 'serviceId', 'startTime'],
      },
    },
  },
];

// ── File helpers ───────────────────────────────────────────────────────────

function readMd(filePath) {
  try { return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''; }
  catch { return ''; }
}

function readAllSkills() {
  const skillsPath = path.join(AGENT_PATH, 'skills');
  try {
    return fs.readdirSync(skillsPath)
      .filter(f => f.endsWith('.md')).sort()
      .map(f => `## ${f}\n\n${readMd(path.join(skillsPath, f))}`)
      .join('\n\n---\n\n');
  } catch { return ''; }
}

function getAgentContext() {
  if (!_agentContext) _agentContext = readMd(path.join(AGENT_PATH, 'context', 'NEXO_AGENT.md'));
  return _agentContext;
}

function getSkills() {
  if (!_skillsContent) _skillsContent = readAllSkills();
  return _skillsContent;
}

function readUserMemory(userId) {
  if (_memoryCache.has(userId)) return _memoryCache.get(userId);
  const content = readMd(path.join(AGENT_PATH, 'memory', `${userId}.md`));
  _memoryCache.set(userId, content);
  return content;
}

function saveUserMemory(userId, content) {
  const memoryDir = path.join(AGENT_PATH, 'memory');
  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
  fs.writeFileSync(path.join(memoryDir, `${userId}.md`), content, 'utf-8');
  _memoryCache.set(userId, content);
}

function logActivity(userId, action, detail) {
  const logDir = path.join(AGENT_PATH, 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const entry = `[${new Date().toISOString()}] USER:${userId} | ${action} | ${detail}\n`;
  fs.appendFileSync(path.join(logDir, 'agent_activity.log'), entry, 'utf-8');
}

// ── Extracción de hints del mensaje ───────────────────────────────────────

const CO_CITIES = [
  'bogotá','bogota','medellín','medellin','cali','barranquilla','cartagena',
  'bucaramanga','pereira','manizales','cúcuta','cucuta','ibagué','ibague',
  'santa marta','villavicencio','pasto','montería','monteria','armenia',
  'sincelejo','valledupar','popayán','popayan',
];

function extractCityHint(text) {
  const t = text.toLowerCase();
  return CO_CITIES.find(c => t.includes(c)) || null;
}

function extractDateHints(text, isoHoy) {
  const dates = new Set();
  const t = text.toLowerCase();
  const base = new Date(isoHoy + 'T12:00:00');

  if (/\bhoy\b/.test(t)) dates.add(isoHoy);

  if (/\bmañana\b/.test(t)) {
    const d = new Date(base); d.setDate(d.getDate() + 1);
    dates.add(d.toISOString().split('T')[0]);
  }

  if (/pasado\s+mañana/.test(t)) {
    const d = new Date(base); d.setDate(d.getDate() + 2);
    dates.add(d.toISOString().split('T')[0]);
  }

  const dayMap = {
    lunes:1, martes:2, 'miércoles':3, miercoles:3,
    jueves:4, viernes:5, 'sábado':6, sabado:6, domingo:0,
  };
  const currentDay = base.getDay();
  for (const [name, num] of Object.entries(dayMap)) {
    if (t.includes(name)) {
      let diff = num - currentDay;
      if (diff <= 0) diff += 7;
      const d = new Date(base); d.setDate(d.getDate() + diff);
      dates.add(d.toISOString().split('T')[0]);
    }
  }

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
  if (isoMatch) isoMatch.forEach(d => dates.add(d));

  return [...dates].slice(0, 2);
}

// ── Consultas a DB ─────────────────────────────────────────────────────────

async function fetchAllStores() {
  const { rows } = await pool.query(`
    SELECT s.id, s.name, s.slug, s.description, s.city,
           s.avg_rating, s.total_reviews, s.category, s.tags, s.phone
    FROM stores s WHERE s.is_active = true ORDER BY s.avg_rating DESC
  `);
  return Promise.all(rows.map(async store => {
    const sv = await pool.query(
      `SELECT id, name, price, duration_minutes, currency
       FROM services WHERE store_id = $1 AND is_active = true ORDER BY price ASC`,
      [store.id]
    );
    return { ...store, services: sv.rows };
  }));
}

// ── Catálogo persistente — se escribe a disco en cada cambio de tienda/servicio ──

async function rebuildStoresCatalog() {
  try {
    const stores = await fetchAllStores();
    const now = new Date().toISOString();
    const lines = [`# Catálogo de Tiendas Nexo\n**Última actualización:** ${now}\n`];

    if (!stores.length) {
      lines.push('_Sin tiendas activas registradas._');
    } else {
      for (const s of stores) {
        const tags = Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || '—');
        const rating = s.avg_rating ? `${parseFloat(s.avg_rating).toFixed(1)}/5 (${s.total_reviews} reseñas)` : 'sin calificación aún';
        const svList = s.services.length > 0
          ? s.services.map(sv =>
              `    - ${sv.name}: $${parseInt(sv.price).toLocaleString('es-CO')} COP / ${sv.duration_minutes} min (ID: ${sv.id})`
            ).join('\n')
          : '    - (sin servicios publicados aún — no se puede agendar)';
        lines.push(`## ${s.name}\n- ID: ${s.id}\n- Ciudad: ${s.city || '—'}\n- Categoría: ${s.category}\n- Calificación: ${rating}\n- Tags: ${tags}\n- Descripción: ${s.description || '—'}\n- Servicios:\n${svList}\n`);
      }
    }

    const memDir = path.join(AGENT_PATH, 'memory');
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'STORES_CATALOG.md'), lines.join('\n'), 'utf-8');
  } catch { /* silent — catalog rebuild is best-effort */ }
}

function getStoresCatalog() {
  return readMd(path.join(AGENT_PATH, 'memory', 'STORES_CATALOG.md'));
}

async function fetchAvailability(stores, dates) {
  const result = [];
  for (const fecha of dates) {
    const storeData = [];
    for (const store of stores) {
      const serviceSlots = [];
      for (const service of store.services) {
        try {
          const slots = await getAvailableSlots(store.id, fecha, service.id);
          const free = slots.filter(s => s.available).map(s => s.start);
          if (free.length) serviceSlots.push({ serviceId: service.id, serviceName: service.name, slots: free });
        } catch { /* skip */ }
      }
      if (serviceSlots.length) storeData.push({ storeId: store.id, storeName: store.name, services: serviceSlots });
    }
    result.push({ fecha, stores: storeData });
  }
  return result;
}

// ── Formateo del contexto inyectado ───────────────────────────────────────

function formatStores(stores) {
  if (!stores.length) return 'No hay tiendas activas registradas en Nexo en este momento.';
  return stores.map((s, i) => {
    const svLines = s.services.length > 0
      ? s.services.map(sv =>
          `    • ${sv.name} | ID: ${sv.id} | $${parseInt(sv.price).toLocaleString('es-CO')} COP | ${sv.duration_minutes} min`
        ).join('\n')
      : '    (Negocio registrado — aún no tiene servicios publicados. No se puede agendar hasta que configure sus servicios.)';
    const tags = Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || '—');
    const rating = s.avg_rating ? `${parseFloat(s.avg_rating).toFixed(1)}/5 (${s.total_reviews} reseñas)` : 'Sin calificación aún';
    return `### ${i + 1}. ${s.name}
  ID tienda : ${s.id}
  Ciudad    : ${s.city}
  Categoría : ${s.category}
  Calificación: ${rating}
  Tags      : ${tags}
  Descripción: ${s.description}
  Servicios :
${svLines}`;
  }).join('\n\n');
}

function formatAvailability(availabilityData) {
  if (!availabilityData.length) return '';
  const blocks = availabilityData.map(({ fecha, stores: list }) => {
    const [y, m, d] = fecha.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    if (!list.length) return `### Disponibilidad ${label} (${fecha}):\nNo hay horarios disponibles ese día.`;
    const detail = list.map(s => {
      const svDetail = s.services.map(sv =>
        `    • ${sv.serviceName} (serviceId: ${sv.serviceId}): ${sv.slots.join(', ')}`
      ).join('\n');
      return `  **${s.storeName}** (storeId: ${s.storeId}):\n${svDetail}`;
    }).join('\n');
    return `### Disponibilidad ${label} (${fecha}):\n${detail}`;
  }).join('\n\n');
  return `\n\n---\n\n## DISPONIBILIDAD REAL (consultada en este momento)\n\n${blocks}`;
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(userId, stores, availabilityData) {
  const now = new Date();
  const fechaHoy = now.toLocaleDateString('es-CO', { timeZone:'America/Bogota', weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const horaHoy  = now.toLocaleTimeString('es-CO', { timeZone:'America/Bogota', hour:'2-digit', minute:'2-digit' });
  const isoHoy   = now.toLocaleDateString('en-CA', { timeZone:'America/Bogota' });

  const catalog = getStoresCatalog();
  const catalogSection = catalog
    ? `## CATÁLOGO PERSISTENTE DE TIENDAS NEXO\n(Actualizado automáticamente cada vez que se registra o modifica una tienda)\n\n${catalog}`
    : '## CATÁLOGO DE TIENDAS\n_Catálogo aún no generado. Usar datos en tiempo real._';

  return `${getAgentContext()}

---

## FECHA Y HORA ACTUAL
Hoy es ${fechaHoy} (${isoHoy}), ${horaHoy} hora Colombia (UTC-5).
Usa esta referencia para interpretar "hoy", "mañana", "el lunes", etc. NUNCA inventes una fecha.

---

## MEMORIA DEL USUARIO (userId: ${userId})
${readUserMemory(userId) || 'Sin historial previo. Primera interacción con este usuario.'}

---

${catalogSection}

---

## DATOS EN TIEMPO REAL — IDs EXACTOS PARA AGENDAR

⚠️ Esta sección contiene los mismos negocios del catálogo pero con los IDs UUID exactos que DEBES usar al llamar \`agendar_cita\`. NUNCA uses un ID que no esté aquí.

${formatStores(stores)}${formatAvailability(availabilityData)}

---

## INSTRUCCIONES

- **Buscar tiendas / ver servicios**: usa el catálogo persistente Y los datos en tiempo real. Ambas fuentes muestran las tiendas activas.
- **Ver disponibilidad**: si está en la sección de disponibilidad arriba, muéstrala. Si el usuario pregunta por una fecha no inyectada, pídele que confirme la fecha.
- **Agendar**: llama \`agendar_cita\` SOLO cuando el usuario confirme explícitamente. Usa los IDs UUID exactos de la sección "DATOS EN TIEMPO REAL". El \`startTime\` debe tener formato \`YYYY-MM-DDThh:mm:00-05:00\` (hora Colombia). Ejemplo: slot 12:00 del 16 de mayo → \`2026-05-16T12:00:00-05:00\`.
- **Si algo no está en los datos**: dilo honestamente. No inventes.

Al final de cada respuesta incluye siempre (nunca visible al usuario):
[MEMORIA_ACTUALIZADA]
{memoria completa actualizada del usuario}
[/MEMORIA_ACTUALIZADA]`.trim();
}

// ── Booking (único tool que escribe en DB) ─────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function executeBooking({ storeId, serviceId, startTime, notes }, userId) {
  try {
    if (!UUID_RE.test(storeId))   return { success: false, error: `storeId inválido: "${storeId}". Copia el ID exacto de los datos inyectados.` };
    if (!UUID_RE.test(serviceId)) return { success: false, error: `serviceId inválido: "${serviceId}". Copia el ID exacto del servicio.` };

    const svcRes = await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
    if (!svcRes.rows[0]) return { success: false, error: 'Servicio no encontrado en la DB.' };

    const start = new Date(startTime);
    const end   = new Date(start.getTime() + svcRes.rows[0].duration_minutes * 60000);

    const conflict = await pool.query(
      `SELECT id FROM appointments WHERE store_id=$1 AND status!='cancelled' AND start_time<$2 AND end_time>$3`,
      [storeId, end.toISOString(), start.toISOString()]
    );
    if (conflict.rows[0]) return { success: false, error: 'Ese horario ya está reservado.' };

    const r = await pool.query(
      `INSERT INTO appointments (client_id,service_id,store_id,start_time,end_time,notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, start_time, end_time, status`,
      [userId, serviceId, storeId, start.toISOString(), end.toISOString(), notes || '']
    );
    return { success: true, appointmentId: r.rows[0].id, message: 'Cita creada exitosamente.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Entry point ────────────────────────────────────────────────────────────

async function processMessage(userId, userMessage, conversationHistory = []) {
  const isoHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  // Escanear el mensaje actual + los últimos 4 para extraer fechas
  const recentText = [
    ...conversationHistory.slice(-4).map(m => (typeof m.content === 'string' ? m.content : '')),
    userMessage,
  ].join(' ');

  const dateHints = extractDateHints(recentText, isoHoy);

  // Pre-cargar TODAS las tiendas (sin filtro de ciudad) y disponibilidad para las fechas mencionadas
  const stores = await fetchAllStores();
  const availabilityData = dateHints.length ? await fetchAvailability(stores, dateHints) : [];

  const messages = [
    { role: 'system', content: buildSystemPrompt(userId, stores, availabilityData) },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let fullResponse = '';

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

    if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length > 0) {
      messages.push(choice.message);
      for (const tc of choice.message.tool_calls) {
        let args;
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
        const result = await executeBooking(args, userId);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      continue;
    }

    fullResponse = choice.message.content || '';
    break;
  }

  const memMatch = fullResponse.match(/\[MEMORIA_ACTUALIZADA\]([\s\S]*?)\[\/MEMORIA_ACTUALIZADA\]/);
  if (memMatch && memMatch[1].trim()) {
    saveUserMemory(userId, memMatch[1].trim());
    logActivity(userId, 'MEMORY_UPDATED', 'ok');
  }

  const cleanResponse = fullResponse
    .replace(/\[MEMORIA_ACTUALIZADA\][\s\S]*?\[\/MEMORIA_ACTUALIZADA\]/g, '')
    .trim();

  logActivity(userId, 'MESSAGE_PROCESSED', `"${userMessage.substring(0, 60)}"`);
  return { response: cleanResponse, memoryUpdated: !!memMatch };
}

module.exports = { processMessage, readUserMemory, saveUserMemory, rebuildStoresCatalog };
