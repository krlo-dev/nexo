const { validationResult } = require('express-validator');
const pool = require('../utils/db');

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const list = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'cliente') {
      result = await pool.query(
        `SELECT a.*, s.name AS service_name, st.name AS store_name
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN stores st ON st.id = a.store_id
         WHERE a.client_id = $1 ORDER BY a.start_time DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'emprendedor') {
      result = await pool.query(
        `SELECT a.*, s.name AS service_name, u.full_name AS client_name
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN stores st ON st.id = a.store_id
         JOIN users u ON u.id = a.client_id
         WHERE st.owner_id = $1 ORDER BY a.start_time DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query('SELECT * FROM appointments ORDER BY start_time DESC');
    }
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: errors.array()[0].msg });

  const { service_id, store_id, start_time, notes } = req.body;

  try {
    const serviceResult = await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [service_id]);
    if (!serviceResult.rows[0]) return res.status(404).json({ success: false, error: 'Servicio no encontrado' });

    const start = new Date(start_time);
    if (start <= new Date()) return res.status(400).json({ success: false, error: 'La hora debe ser futura' });

    const end = new Date(start.getTime() + serviceResult.rows[0].duration_minutes * 60000);

    const conflict = await pool.query(
      `SELECT id FROM appointments
       WHERE store_id = $1 AND status != 'cancelled'
       AND start_time < $2 AND end_time > $3`,
      [store_id, end.toISOString(), start.toISOString()]
    );
    if (conflict.rows[0]) return res.status(409).json({ success: false, error: 'Horario no disponible' });

    const result = await pool.query(
      `INSERT INTO appointments (client_id, service_id, store_id, start_time, end_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, service_id, store_id, start.toISOString(), end.toISOString(), notes]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const reschedule = async (req, res) => {
  const { start_time } = req.body;
  try {
    const apt = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!apt.rows[0]) return res.status(404).json({ success: false, error: 'Cita no encontrada' });

    const a = apt.rows[0];
    if (a.client_id !== req.user.id) return res.status(403).json({ success: false, error: 'Acceso denegado' });
    if (!['pending','confirmed'].includes(a.status)) return res.status(400).json({ success: false, error: 'No se puede reprogramar' });
    if (!a.allow_reschedule) return res.status(400).json({ success: false, error: 'Reprogramación no permitida' });
    if (new Date(a.start_time) - new Date() < TWO_HOURS_MS) return res.status(400).json({ success: false, error: 'Fuera del plazo para reprogramar' });

    const serviceResult = await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [a.service_id]);
    const start = new Date(start_time);
    const end = new Date(start.getTime() + serviceResult.rows[0].duration_minutes * 60000);

    const conflict = await pool.query(
      `SELECT id FROM appointments
       WHERE store_id = $1 AND status != 'cancelled' AND id != $2
       AND start_time < $3 AND end_time > $4`,
      [a.store_id, a.id, end.toISOString(), start.toISOString()]
    );
    if (conflict.rows[0]) return res.status(409).json({ success: false, error: 'Horario no disponible' });

    const result = await pool.query(
      `UPDATE appointments SET start_time=$1, end_time=$2, status='rescheduled', updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [start.toISOString(), end.toISOString(), a.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const cancel = async (req, res) => {
  const { cancel_reason } = req.body;
  try {
    const apt = await pool.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!apt.rows[0]) return res.status(404).json({ success: false, error: 'Cita no encontrada' });

    const a = apt.rows[0];
    if (a.client_id !== req.user.id) return res.status(403).json({ success: false, error: 'Acceso denegado' });
    if (!['pending','confirmed'].includes(a.status)) return res.status(400).json({ success: false, error: 'No se puede cancelar' });
    if (new Date(a.start_time) - new Date() < TWO_HOURS_MS) return res.status(400).json({ success: false, error: 'Fuera del plazo para cancelar' });

    const result = await pool.query(
      `UPDATE appointments SET status='cancelled', cancel_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [cancel_reason, a.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const updateStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = req.user.role === 'emprendedor' ? ['confirmed','completed','cancelled'] : ['cancelled'];

  if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Estado inválido' });

  try {
    // Verificar que la cita pertenece a una tienda del emprendedor que hace la petición
    if (req.user.role === 'emprendedor') {
      const ownership = await pool.query(
        `SELECT a.id FROM appointments a
         JOIN stores st ON st.id = a.store_id
         WHERE a.id = $1 AND st.owner_id = $2`,
        [req.params.id, req.user.id]
      );
      if (!ownership.rows[0]) return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    const result = await pool.query(
      `UPDATE appointments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

const toggleReschedule = async (req, res) => {
  try {
    const apt = await pool.query('SELECT a.*, st.owner_id FROM appointments a JOIN stores st ON st.id = a.store_id WHERE a.id = $1', [req.params.id]);
    if (!apt.rows[0] || apt.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }
    const result = await pool.query(
      'UPDATE appointments SET allow_reschedule = NOT allow_reschedule WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
};

module.exports = { list, create, reschedule, cancel, updateStatus, toggleReschedule };
