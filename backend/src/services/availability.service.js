const pool = require('../utils/db');

const getAvailableSlots = async (storeId, date, serviceId) => {
  const dayOfWeek = new Date(date).getDay();
  const mondayBased = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const hoursResult = await pool.query(
    'SELECT * FROM business_hours WHERE store_id = $1 AND day_of_week = $2',
    [storeId, mondayBased]
  );

  if (!hoursResult.rows[0] || !hoursResult.rows[0].is_open) return [];

  const serviceResult = await pool.query(
    'SELECT duration_minutes FROM services WHERE id = $1',
    [serviceId]
  );
  if (!serviceResult.rows[0]) return [];

  const { duration_minutes } = serviceResult.rows[0];
  const { open_time, close_time } = hoursResult.rows[0];

  const slots = buildSlots(open_time, close_time, duration_minutes);

  const aptsResult = await pool.query(
    `SELECT start_time, end_time FROM appointments
     WHERE store_id = $1 AND DATE(start_time - INTERVAL '5 hours') = $2 AND status != 'cancelled'`,
    [storeId, date]
  );

  return slots.map((slot) => ({
    ...slot,
    available: !aptsResult.rows.some(
      (a) =>
        new Date(a.start_time) < new Date(`${date}T${slot.end}:00Z`) &&
        new Date(a.end_time) > new Date(`${date}T${slot.start}:00Z`)
    ),
  }));
};

const buildSlots = (openTime, closeTime, durationMinutes) => {
  const slots = [];
  let [h, m] = openTime.split(':').map(Number);
  const [endH, endM] = closeTime.split(':').map(Number);
  const endTotal = endH * 60 + endM;

  while (h * 60 + m + durationMinutes <= endTotal) {
    const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    m += durationMinutes;
    h += Math.floor(m / 60);
    m %= 60;
    const end = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    slots.push({ start, end });
  }
  return slots;
};

module.exports = { getAvailableSlots };
