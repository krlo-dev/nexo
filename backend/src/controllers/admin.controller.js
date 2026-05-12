const pool = require('../utils/db');

const listUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['admin','emprendedor','cliente'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Rol inválido' });
  }
  try {
    const result = await pool.query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id, full_name, email, role', [role, req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const listStores = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.full_name AS owner_name FROM stores s
       JOIN users u ON u.id = s.owner_id ORDER BY s.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const toggleStore = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE stores SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active',
      [req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { listUsers, updateUserRole, listStores, toggleStore };
