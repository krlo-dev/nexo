const pool = require('../utils/db');
const { getAvailableSlots } = require('../services/availability.service');

const get = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM business_hours WHERE store_id = $1 ORDER BY day_of_week',
      [req.params.storeId]
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const upsert = async (req, res) => {
  const owned = await pool.query('SELECT id FROM stores WHERE id = $1 AND owner_id = $2', [req.params.storeId, req.user.id]);
  if (!owned.rows[0]) return res.status(403).json({ success: false, error: 'Acceso denegado' });

  const hours = req.body; // array of 7 day objects
  try {
    for (const day of hours) {
      await pool.query(
        `INSERT INTO business_hours (store_id, day_of_week, open_time, close_time, is_open)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (store_id, day_of_week)
         DO UPDATE SET open_time=$3, close_time=$4, is_open=$5`,
        [req.params.storeId, day.day_of_week, day.open_time, day.close_time, day.is_open]
      );
    }
    const result = await pool.query('SELECT * FROM business_hours WHERE store_id = $1 ORDER BY day_of_week', [req.params.storeId]);
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const availability = async (req, res) => {
  const { date, serviceId } = req.query;
  if (!date || !serviceId) return res.status(400).json({ success: false, error: 'date y serviceId requeridos' });
  try {
    const slots = await getAvailableSlots(req.params.storeId, date, serviceId);
    res.json({ success: true, data: slots });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { get, upsert, availability };
