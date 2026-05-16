const pool = require('../utils/db');
const { haversineKm } = require('../utils/haversine');

const getRecommendations = async (userId, userLat, userLon, limit = 10) => {
  const storesResult = await pool.query(
    'SELECT * FROM stores WHERE is_active = true'
  );

  if (!storesResult.rows.length) return [];

  const scored = storesResult.rows.map((store) => {
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
      score: 0.3 * ratingScore + 0.2 * distanceScore,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...store }) => store);
};

module.exports = { getRecommendations };
