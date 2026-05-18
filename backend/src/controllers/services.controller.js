const { validationResult } = require('express-validator');
const pool = require('../utils/db');
const { rebuildStoresCatalog } = require('../services/agentService');

const ownerGuard = async (storeId, userId) => {
  const r = await pool.query('SELECT id FROM stores WHERE id = $1 AND owner_id = $2', [storeId, userId]);
  return !!r.rows[0];
};

const list = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM services WHERE store_id = $1 AND is_active = true ORDER BY created_at',
      [req.params.storeId]
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });

  if (!(await ownerGuard(req.params.storeId, req.user.id))) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  const { name, description, duration_minutes, price, currency, images } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO services (store_id, name, description, duration_minutes, price, currency, images) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.storeId, name, description, duration_minutes, price, currency || 'COP', images]
    );
    rebuildStoresCatalog().catch(() => {});
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const update = async (req, res) => {
  if (!(await ownerGuard(req.params.storeId, req.user.id))) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }

  const fields = ['name','description','duration_minutes','price','currency','images'];
  const updates = [];
  const values = [];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) { values.push(req.body[f]); updates.push(`${f} = $${values.length}`); }
  });
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE services SET ${updates.join(', ')} WHERE id = $${values.length} AND store_id = $${values.length - updates.length + 0} RETURNING *`,
      values
    );
    rebuildStoresCatalog().catch(() => {});
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const remove = async (req, res) => {
  if (!(await ownerGuard(req.params.storeId, req.user.id))) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }
  try {
    await pool.query('UPDATE services SET is_active = false WHERE id = $1 AND store_id = $2', [req.params.id, req.params.storeId]);
    rebuildStoresCatalog().catch(() => {});
    res.json({ success: true, data: { id: req.params.id } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { list, create, update, remove };
