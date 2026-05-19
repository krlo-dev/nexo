require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { generateEmbedding, buildStoreText } = require('../src/services/ollama.service');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const ZERO_EMBEDDING = JSON.stringify(Array(768).fill(0));

const hash = (p) => bcrypt.hash(p, 10);

const getEmbedding = async (text) => {
  try {
    const emb = await generateEmbedding(text);
    return JSON.stringify(emb);
  } catch {
    return ZERO_EMBEDDING;
  }
};

async function seed() {
  console.log('Seeding database…');

  // Admin
  const adminHash = await hash(process.env.ADMIN_PASSWORD || 'Admin1234!');
  const adminResult = await pool.query(
    "INSERT INTO users (email, password_hash, role, full_name) VALUES ($1,$2,'admin',$3) ON CONFLICT (email) DO UPDATE SET password_hash=$2 RETURNING id",
    [process.env.ADMIN_EMAIL || 'admin@nexo.app', adminHash, 'Administrador Nexo']
  );

  // Entrepreneurs
  const entrepreneurs = [
    { email: 'valentina@nexo.app', name: 'Valentina Torres', store: { name: 'Salón Valentina', category: 'belleza', city: 'Bogotá', description: 'El mejor salón de belleza de Bogotá. Especialistas en cortes, tintes y tratamientos capilares.', tags: ['cabello','uñas','maquillaje'], lat: 4.711, lon: -74.072 } },
    { email: 'martinez@nexo.app', name: 'Dr. Carlos Martínez', store: { name: 'Dr. Martínez Fisioterapia', category: 'salud', city: 'Medellín', description: 'Fisioterapia y rehabilitación física con equipos de última tecnología.', tags: ['fisioterapia','rehabilitación','salud'], lat: 6.244, lon: -75.581 } },
    { email: 'techfix@nexo.app', name: 'Andrés López', store: { name: 'TechFix Reparaciones', category: 'tecnología', city: 'Cali', description: 'Reparación de celulares, computadores y tabletas. Servicio rápido y garantizado.', tags: ['celulares','computadores','reparación'], lat: 3.451, lon: -76.532 } },
  ];

  const storeIds = [];
  for (const e of entrepreneurs) {
    const pw = await hash('Emprendedor123!');
    const userResult = await pool.query(
      "INSERT INTO users (email, password_hash, role, full_name) VALUES ($1,$2,'emprendedor',$3) ON CONFLICT (email) DO UPDATE SET password_hash=$2 RETURNING id",
      [e.email, pw, e.name]
    );
    const userId = userResult.rows[0].id;
    const slug = e.store.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const embedding = await getEmbedding(buildStoreText(e.store));

    const storeResult = await pool.query(
      `INSERT INTO stores (owner_id, slug, name, description, category, tags, city, lat, lon, embedding, avatar_url, banner_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (slug) DO UPDATE SET description=$4 RETURNING id`,
      [userId, slug, e.store.name, e.store.description, e.store.category, e.store.tags, e.store.city, e.store.lat, e.store.lon, embedding,
       'https://picsum.photos/200/200?random=' + Math.floor(Math.random() * 100),
       'https://picsum.photos/800/300?random=' + Math.floor(Math.random() * 100)]
    );
    storeIds.push(storeResult.rows[0].id);
  }

  // Services per store
  const serviceTemplates = [
    [
      { name: 'Corte de cabello', duration_minutes: 45, price: 45000 },
      { name: 'Tinte completo', duration_minutes: 120, price: 150000 },
      { name: 'Manicure + Pedicure', duration_minutes: 90, price: 80000 },
    ],
    [
      { name: 'Consulta fisioterapia', duration_minutes: 60, price: 80000 },
      { name: 'Sesión de rehabilitación', duration_minutes: 90, price: 120000 },
      { name: 'Masaje terapéutico', duration_minutes: 60, price: 100000 },
    ],
    [
      { name: 'Reparación de pantalla', duration_minutes: 60, price: 120000 },
      { name: 'Diagnóstico de computador', duration_minutes: 30, price: 40000 },
      { name: 'Recuperación de datos', duration_minutes: 120, price: 200000 },
    ],
  ];

  const serviceIds = [];
  for (let i = 0; i < storeIds.length; i++) {
    const storeServiceIds = [];
    for (let j = 0; j < serviceTemplates[i].length; j++) {
      const svc = serviceTemplates[i][j];
      const r = await pool.query(
        `INSERT INTO services (store_id, name, duration_minutes, price, currency, images)
         VALUES ($1,$2,$3,$4,'COP',$5) RETURNING id`,
        [storeIds[i], svc.name, svc.duration_minutes, svc.price,
         [`https://picsum.photos/400/300?random=${i * 10 + j}`]]
      );
      storeServiceIds.push(r.rows[0].id);
    }
    serviceIds.push(storeServiceIds);
  }

  // Business hours (Mon-Sat 9-18, Sunday closed)
  for (const storeId of storeIds) {
    for (let day = 0; day <= 6; day++) {
      await pool.query(
        `INSERT INTO business_hours (store_id, day_of_week, open_time, close_time, is_open)
         VALUES ($1,$2,'09:00','18:00',$3) ON CONFLICT (store_id, day_of_week) DO NOTHING`,
        [storeId, day, day !== 6]
      );
    }
  }

  // Client users
  const clientIds = [];
  for (let i = 1; i <= 5; i++) {
    const pw = await hash('Cliente123!');
    const r = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1,$2,'cliente',$3) ON CONFLICT (email) DO UPDATE SET password_hash=$2 RETURNING id`,
      [`cliente${i}@nexo.app`, pw, `Cliente Prueba ${i}`]
    );
    clientIds.push(r.rows[0].id);
  }

  // Appointments
  const now = new Date();
  const appointments = [
    { clientIdx: 0, storeIdx: 0, svcIdx: 0, daysOffset: 3, status: 'confirmed' },
    { clientIdx: 0, storeIdx: 1, svcIdx: 0, daysOffset: 7, status: 'pending' },
    { clientIdx: 1, storeIdx: 0, svcIdx: 1, daysOffset: -5, status: 'completed' },
    { clientIdx: 1, storeIdx: 2, svcIdx: 0, daysOffset: -2, status: 'completed' },
    { clientIdx: 2, storeIdx: 1, svcIdx: 1, daysOffset: -10, status: 'completed' },
    { clientIdx: 2, storeIdx: 0, svcIdx: 2, daysOffset: 14, status: 'pending' },
    { clientIdx: 3, storeIdx: 2, svcIdx: 2, daysOffset: -3, status: 'cancelled' },
    { clientIdx: 3, storeIdx: 1, svcIdx: 0, daysOffset: 5, status: 'confirmed' },
    { clientIdx: 4, storeIdx: 0, svcIdx: 0, daysOffset: -15, status: 'completed' },
    { clientIdx: 4, storeIdx: 2, svcIdx: 1, daysOffset: -1, status: 'completed' },
  ];

  const aptIds = [];
  for (const a of appointments) {
    const start = new Date(now);
    start.setDate(start.getDate() + a.daysOffset);
    start.setHours(10, 0, 0, 0);
    const svcId = serviceIds[a.storeIdx][a.svcIdx];
    const svcResult = await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [svcId]);
    const end = new Date(start.getTime() + svcResult.rows[0].duration_minutes * 60000);

    const r = await pool.query(
      `INSERT INTO appointments (client_id, service_id, store_id, start_time, end_time, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [clientIds[a.clientIdx], svcId, storeIds[a.storeIdx], start.toISOString(), end.toISOString(), a.status]
    );
    aptIds.push({ id: r.rows[0].id, storeId: storeIds[a.storeIdx], clientId: clientIds[a.clientIdx], status: a.status });
  }

  // Reviews on completed appointments
  const completedApts = aptIds.filter(a => a.status === 'completed');
  const ratings = [5, 4, 5, 3, 4, 4, 5, 5];
  const comments = [
    'Excelente servicio, muy profesional.',
    'Buen trabajo, lo recomiendo.',
    'Quedé muy satisfecho, volvería.',
    'Servicio correcto aunque tardó un poco.',
    'Muy buena atención al cliente.',
    'El personal es muy amable.',
    'Servicio de calidad, totalmente recomendado.',
    'Superó mis expectativas.',
  ];

  for (let i = 0; i < completedApts.length && i < 8; i++) {
    const a = completedApts[i];
    await pool.query(
      `INSERT INTO reviews (appointment_id, client_id, store_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (appointment_id) DO NOTHING`,
      [a.id, a.clientId, a.storeId, ratings[i], comments[i]]
    );
  }

  // Update ratings
  await pool.query(`
    UPDATE stores SET
      avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE store_id = stores.id),
      total_reviews = (SELECT COUNT(*) FROM reviews WHERE store_id = stores.id)
  `);

  console.log('Seed completed!');
  console.log('Admin:', process.env.ADMIN_EMAIL || 'admin@nexo.app', '/', process.env.ADMIN_PASSWORD || 'Admin1234!');
  console.log('Entrepreneurs: valentina@nexo.app, martinez@nexo.app, techfix@nexo.app — pw: Emprendedor123!');
  console.log('Clients: cliente1@nexo.app … cliente5@nexo.app — pw: Cliente123!');

  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
