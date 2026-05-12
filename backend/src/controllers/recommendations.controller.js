const { getRecommendations } = require('../services/recommendation.service');

const get = async (req, res) => {
  const { lat, lon, limit } = req.query;
  try {
    const data = await getRecommendations(req.user.id, lat, lon, parseInt(limit) || 10);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { get };
