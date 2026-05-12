const { validationResult } = require('express-validator');
const pool = require('../utils/db');

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });

  const { appointment_id, rating, comment } = req.body;
  try {
    const apt = await pool.query(
      'SELECT * FROM appointments WHERE id = $1 AND client_id = $2 AND status = $3',
      [appointment_id, req.user.id, 'completed']
    );
    if (!apt.rows[0]) return res.status(400).json({ success: false, error: 'Cita no válida para reseña' });

    const result = await pool.query(
      'INSERT INTO reviews (appointment_id, client_id, store_id, rating, comment) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [appointment_id, req.user.id, apt.rows[0].store_id, rating, comment]
    );

    await pool.query(
      `UPDATE stores SET
         avg_rating = (SELECT AVG(rating) FROM reviews WHERE store_id = $1),
         total_reviews = (SELECT COUNT(*) FROM reviews WHERE store_id = $1)
       WHERE id = $1`,
      [apt.rows[0].store_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Ya existe una reseña para esta cita' });
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const listByStore = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.full_name FROM reviews r
       JOIN users u ON u.id = r.client_id
       WHERE r.store_id = $1 ORDER BY r.created_at DESC`,
      [req.params.storeId]
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { create, listByStore };
