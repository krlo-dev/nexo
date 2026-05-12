const pool = require('../utils/db');
const { generateEmbedding } = require('./ollama.service');
const { cosineSimilarity } = require('../utils/cosine');
const { haversineKm } = require('../utils/haversine');

const getRecommendations = async (userId, userLat, userLon, limit = 10) => {
  const historyResult = await pool.query(
    `SELECT s.category FROM appointments a
     JOIN services sv ON sv.id = a.service_id
     JOIN stores s ON s.id = a.store_id
     WHERE a.client_id = $1 AND a.status = 'completed'
     ORDER BY a.created_at DESC LIMIT 20`,
    [userId]
  );

  const storesResult = await pool.query(
    'SELECT * FROM stores WHERE is_active = true AND embedding IS NOT NULL'
  );

  if (!storesResult.rows.length) return [];

  let userEmbedding = null;
  if (historyResult.rows.length) {
    const historyText = historyResult.rows.map((r) => r.category).join(' ');
    try {
      userEmbedding = await generateEmbedding(historyText);
    } catch {
      // fallback: score without semantic component
    }
  }

  const scored = storesResult.rows.map((store) => {
    let semanticScore = 0;
    if (userEmbedding && store.embedding) {
      const storeVec = JSON.parse(store.embedding);
      semanticScore = cosineSimilarity(userEmbedding, storeVec);
    }

    const ratingScore = parseFloat(store.avg_rating || 0) / 5;

    let distanceScore = 0;
    if (userLat && userLon && store.lat && store.lon) {
      const km = haversineKm(
        parseFloat(userLat), parseFloat(userLon),
        parseFloat(store.lat), parseFloat(store.lon)
      );
      distanceScore = 1 / (1 + km);
    }

    return {
      ...store,
      score: 0.5 * semanticScore + 0.3 * ratingScore + 0.2 * distanceScore,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...store }) => store);
};

module.exports = { getRecommendations };
