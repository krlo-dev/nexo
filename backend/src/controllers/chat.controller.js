const pool = require('../utils/db');
const {
  normalizeIntent,
  generateEmbedding,
  cosineSimilarity,
  generateNaturalResponse,
  SIMILARITY_THRESHOLD,
  MAX_RESULTS,
} = require('../services/chat.service');

const buildNotFoundMessage = (serviceText, cityText) => {
  const service = serviceText ? `"${serviceText}"` : 'ese servicio';
  const city = cityText || '';

  const messages = [
    `Busqué ${service}${city} en Nexo pero no encontré negocios que ofrezcan eso por el momento. ¿Quizás buscas algo diferente? Puedes explorar todas las tiendas en /explore.`,
    `Hmm, no tenemos ${service}${city} disponible en Nexo todavía. Puedes ver todos los servicios disponibles en /explore, ¡quizás encuentras algo que te guste!`,
    `No encontré coincidencias para ${service}${city} en nuestra plataforma. Si conoces un negocio que ofrezca ese servicio, ¡invítalos a unirse a Nexo! Mientras tanto, explora en /explore.`,
  ];

  const index = (serviceText || '').length % messages.length;
  return messages[index];
};

const chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          response: 'Por favor escribe qué servicio estás buscando.',
          stores: [],
        },
      });
    }

    // ── PASO 1: Normalizar intención con qwen ──────────────────────────
    const intent = await normalizeIntent(message.trim());

    if (!intent.isAppointmentRelated || !intent.searchText) {
      return res.json({
        success: true,
        data: {
          response: 'Solo puedo ayudarte a encontrar servicios y negocios locales en Nexo. ¿Qué servicio estás buscando?',
          stores: [],
        },
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
          stores: [],
        },
      });
    }

    if (!searchEmbedding || searchEmbedding.length === 0) {
      return res.json({
        success: true,
        data: {
          response: 'El asistente está iniciando. Por favor intenta en unos segundos.',
          stores: [],
        },
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

    if (intent.city) {
      params.push(`%${intent.city}%`);
      storeQuery += ` AND LOWER(s.city) ILIKE $${params.length}`;
    }

    storeQuery += ` GROUP BY s.id`;

    const storesResult = await pool.query(storeQuery, params);

    if (storesResult.rows.length === 0) {
      const cityMsg = intent.city ? ` en ${intent.city}` : '';
      return res.json({
        success: true,
        data: {
          response: `No encontré negocios disponibles${cityMsg} en Nexo por el momento. Puedes explorar todas las tiendas en /explore.`,
          stores: [],
        },
      });
    }

    // ── PASO 4: Calcular similitud coseno y aplicar umbral ─────────────
    const allScored = storesResult.rows
      .map((store) => {
        let storeEmbedding;
        try {
          storeEmbedding = typeof store.embedding === 'string'
            ? JSON.parse(store.embedding)
            : store.embedding;
        } catch (e) {
          return null;
        }

        const score = cosineSimilarity(searchEmbedding, storeEmbedding);
        return { ...store, score };
      })
      .filter((store) => store !== null);

    const scoredStores = allScored
      .filter((store) => store.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);

    // ── PASO 4A: Sin resultados relevantes → mensaje claro, sin tiendas ─
    if (scoredStores.length === 0) {
      const cityMsg = intent.city ? ` en ${intent.city}` : '';
      return res.json({
        success: true,
        data: {
          response: buildNotFoundMessage(intent.searchText, cityMsg),
          stores: [],
        },
      });
    }

    // ── PASO 4B: Hay resultados → preparar datos reales para qwen ──────
    const storesForResponse = scoredStores.map((store) => {
      let services = store.services || [];

      if (intent.maxPrice) {
        services = services.filter(
          (sv) => !sv.price || parseFloat(sv.price) <= intent.maxPrice
        );
      }

      const matchedServices = services.slice(0, 3);

      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        city: store.city,
        avg_rating: store.avg_rating,
        avatar_url: store.avatar_url,
        score: store.score,
        matchedServices,
      };
    });

    const finalStores = storesForResponse.filter(
      (store) => store.matchedServices && store.matchedServices.length > 0
    );

    if (finalStores.length === 0) {
      const priceMsg = intent.maxPrice
        ? ` con precio menor a $${parseInt(intent.maxPrice).toLocaleString('es-CO')}`
        : '';
      return res.json({
        success: true,
        data: {
          response: `Encontré tiendas relacionadas pero ninguna tiene servicios${priceMsg}. Prueba aumentando el presupuesto o explora en /explore.`,
          stores: [],
        },
      });
    }

    // ── PASO 5: qwen genera respuesta natural con datos reales ──────────
    let naturalResponse = await generateNaturalResponse(message, finalStores);

    if (!naturalResponse) {
      const names = finalStores.map((s) => s.name).join(', ');
      naturalResponse = `Encontré ${finalStores.length} opción(es) para ti en Nexo: ${names}. Revisa los perfiles para ver disponibilidad y agendar tu cita.`;
    }

    return res.json({
      success: true,
      data: {
        response: naturalResponse,
        stores: finalStores,
      },
    });

  } catch (err) {
    console.error('Chat controller error:', err);
    return res.json({
      success: false,
      error: 'Ocurrió un error procesando tu consulta. Por favor intenta de nuevo.',
    });
  }
};

module.exports = { chat };
