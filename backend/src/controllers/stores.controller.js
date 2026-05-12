const { validationResult } = require('express-validator');
const pool = require('../utils/db');
const { generateEmbedding, buildStoreText } = require('../services/ollama.service');

const list = async (req, res) => {
  const { category, city, q } = req.query;
  let query = 'SELECT * FROM stores WHERE is_active = true';
  const params = [];

  if (category) { params.push(category); query += ` AND category = $${params.length}`; }
  if (city)     { params.push(`%${city}%`); query += ` AND city ILIKE $${params.length}`; }
  if (q)        { params.push(`%${q}%`); query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`; }

  query += ' ORDER BY avg_rating DESC';

  try {
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const getBySlug = async (req, res) => {
  try {
    const storeResult = await pool.query('SELECT * FROM stores WHERE slug = $1 AND is_active = true', [req.params.slug]);
    if (!storeResult.rows[0]) return res.status(404).json({ success: false, error: 'Tienda no encontrada' });

    const store = storeResult.rows[0];
    const [services, reviews] = await Promise.all([
      pool.query('SELECT * FROM services WHERE store_id = $1 AND is_active = true', [store.id]),
      pool.query(
        `SELECT r.*, u.full_name FROM reviews r
         JOIN users u ON u.id = r.client_id
         WHERE r.store_id = $1 ORDER BY r.created_at DESC`,
        [store.id]
      ),
    ]);

    res.json({ success: true, data: { ...store, services: services.rows, reviews: reviews.rows } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });

  const { name, description, category, tags, address, city, lat, lon, phone, instagram_handle } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

  try {
    const result = await pool.query(
      `INSERT INTO stores (owner_id, slug, name, description, category, tags, address, city, lat, lon, phone, instagram_handle)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, slug, name, description, category, tags, address, city, lat, lon, phone, instagram_handle]
    );
    const store = result.rows[0];

    try {
      const embedding = await generateEmbedding(buildStoreText(store));
      await pool.query('UPDATE stores SET embedding = $1 WHERE id = $2', [JSON.stringify(embedding), store.id]);
      store.embedding = JSON.stringify(embedding);
    } catch { /* Ollama unavailable — store without embedding */ }

    res.status(201).json({ success: true, data: store });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'Slug duplicado' });
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const update = async (req, res) => {
  try {
    const owned = await pool.query('SELECT id FROM stores WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
    if (!owned.rows[0]) return res.status(403).json({ success: false, error: 'Acceso denegado' });

    const fields = ['name','description','category','tags','address','city','lat','lon','phone','instagram_handle','avatar_url','banner_url'];
    const updates = [];
    const values = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) { values.push(req.body[f]); updates.push(`${f} = $${values.length}`); }
    });
    values.push(new Date()); updates.push(`updated_at = $${values.length}`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE stores SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    const store = result.rows[0];

    try {
      const embedding = await generateEmbedding(buildStoreText(store));
      await pool.query('UPDATE stores SET embedding = $1 WHERE id = $2', [JSON.stringify(embedding), store.id]);
    } catch { /* continue without updated embedding */ }

    res.json({ success: true, data: store });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const remove = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE stores SET is_active = false WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(403).json({ success: false, error: 'Acceso denegado' });
    res.json({ success: true, data: { id: req.params.id } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { list, getBySlug, create, update, remove };
