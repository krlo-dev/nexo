const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ai-service:11434';
const SIMILARITY_THRESHOLD = 0.60;
const MAX_RESULTS = 3;

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
        options: { temperature: 0.1, num_predict: 120 },
      }),
    });

    const data = await res.json();
    const jsonMatch = data.response && data.response.match(/\{[\s\S]*?\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        searchText: parsed.searchText || null,
        city: parsed.city ? parsed.city.toLowerCase().trim() : null,
        maxPrice: parsed.maxPrice ? parseInt(parsed.maxPrice) : null,
        isAppointmentRelated: parsed.isAppointmentRelated !== false,
      };
    }
  } catch { /* silent fallback */ }

  return { searchText: null, city: null, maxPrice: null, isAppointmentRelated: true };
};

const generateEmbedding = async (text) => {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text,
    }),
  });

  const data = await res.json();
  return data.embedding;
};

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

const generateNaturalResponse = async (userMessage, stores) => {
  let context = '';
  stores.forEach((store, i) => {
    context += `${i + 1}. ${store.name} (${store.city})`;
    if (store.avg_rating) context += ` — Rating: ${store.avg_rating}/5`;
    context += '\n';
    if (store.matchedServices && store.matchedServices.length > 0) {
      store.matchedServices.forEach((sv) => {
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
        options: { temperature: 0.5, num_predict: 200 },
      }),
    });

    const data = await res.json();
    return data.response ? data.response.trim() : null;
  } catch {
    return null;
  }
};

module.exports = {
  normalizeIntent,
  generateEmbedding,
  cosineSimilarity,
  generateNaturalResponse,
  SIMILARITY_THRESHOLD,
  MAX_RESULTS,
};
