const express = require('express');
const router = express.Router();
const { processMessage, readUserMemory } = require('../services/agentService');
const { authenticate } = require('../middlewares/auth');
const pool = require('../utils/db');
const { getAvailableSlots } = require('../services/availability.service');

router.post('/chat', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, history = [] } = req.body;
    if (!message || message.trim() === '') {
      return res.json({ success: false, error: 'El mensaje no puede estar vacío' });
    }
    const result = await processMessage(userId, message, history);
    res.json({ success: true, data: { response: result.response, memoryUpdated: result.memoryUpdated } });
  } catch (error) {
    console.error('Error en agente:', error);
    res.json({ success: false, error: 'Error procesando el mensaje. Intente nuevamente.' });
  }
});

router.get('/buscar-tiendas', authenticate, async (req, res) => {
  try {
    const { servicio, ciudad, precioMax } = req.query;
    let query = `
      SELECT s.id, s.name, s.slug, s.description, s.city, s.address,
             s.avg_rating, s.category, s.phone,
             u.full_name as owner_name
      FROM stores s
      JOIN users u ON s.owner_id = u.id
      WHERE s.is_active = true
    `;
    const params = [];
    if (servicio) {
      params.push(`%${servicio}%`);
      const n = params.length;
      query += ` AND (LOWER(s.name) LIKE LOWER($${n}) OR LOWER(s.description) LIKE LOWER($${n}) OR LOWER(s.category) LIKE LOWER($${n}))`;
    }
    if (ciudad) {
      params.push(`%${ciudad}%`);
      query += ` AND LOWER(s.city) LIKE LOWER($${params.length})`;
    }
    query += ` ORDER BY s.avg_rating DESC LIMIT 5`;

    const storesResult = await pool.query(query, params);

    const stores = await Promise.all(storesResult.rows.map(async (store) => {
      const svResult = await pool.query(
        'SELECT id, name, price, duration_minutes, currency FROM services WHERE store_id = $1 AND is_active = true ORDER BY price ASC',
        [store.id]
      );
      const services = precioMax
        ? svResult.rows.filter((s) => parseFloat(s.price) <= parseFloat(precioMax))
        : svResult.rows;
      return { ...store, services };
    }));

    res.json({ success: true, data: stores });
  } catch (error) {
    console.error('buscar-tiendas error:', error);
    res.json({ success: false, error: 'Error en la búsqueda' });
  }
});

router.get('/disponibilidad', authenticate, async (req, res) => {
  try {
    const { storeId, serviceId, fecha } = req.query;
    if (!storeId || !serviceId || !fecha) {
      return res.status(400).json({ success: false, error: 'storeId, serviceId y fecha son requeridos' });
    }
    const slots = await getAvailableSlots(storeId, fecha, serviceId);
    res.json({ success: true, data: slots });
  } catch (error) {
    console.error('disponibilidad error:', error);
    res.json({ success: false, error: 'Error obteniendo disponibilidad' });
  }
});

router.post('/agendar', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeId, serviceId, startTime, notes } = req.body;

    if (!storeId || !serviceId || !startTime) {
      return res.status(400).json({ success: false, error: 'storeId, serviceId y startTime son requeridos' });
    }

    const serviceResult = await pool.query(
      'SELECT duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );
    if (!serviceResult.rows[0]) {
      return res.status(404).json({ success: false, error: 'Servicio no encontrado' });
    }

    const start = new Date(startTime);
    if (start <= new Date()) {
      return res.status(400).json({ success: false, error: 'La hora debe ser futura' });
    }

    const end = new Date(start.getTime() + serviceResult.rows[0].duration_minutes * 60000);

    const conflict = await pool.query(
      `SELECT id FROM appointments WHERE store_id = $1 AND status != 'cancelled' AND start_time < $2 AND end_time > $3`,
      [storeId, end.toISOString(), start.toISOString()]
    );
    if (conflict.rows[0]) {
      return res.status(409).json({ success: false, error: 'Horario no disponible' });
    }

    const result = await pool.query(
      `INSERT INTO appointments (client_id, service_id, store_id, start_time, end_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, start_time, end_time, status`,
      [userId, serviceId, storeId, start.toISOString(), end.toISOString(), notes || '']
    );

    res.json({
      success: true,
      data: {
        appointmentId: result.rows[0].id,
        message: 'Cita agendada exitosamente',
        appointment: result.rows[0],
      },
    });
  } catch (error) {
    console.error('agendar error:', error);
    res.json({ success: false, error: 'Error al agendar la cita' });
  }
});

router.get('/memoria', authenticate, async (req, res) => {
  try {
    const memory = readUserMemory(req.user.id);
    res.json({ success: true, data: { memory: memory || 'Sin memoria registrada aún' } });
  } catch (error) {
    res.json({ success: false, error: 'Error leyendo memoria' });
  }
});

module.exports = router;
