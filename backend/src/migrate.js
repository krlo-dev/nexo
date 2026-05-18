const pool = require('./utils/db');

const SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','emprendedor','cliente')),
  full_name     VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug             VARCHAR(100) UNIQUE NOT NULL,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100) NOT NULL,
  tags             TEXT[],
  avatar_url       TEXT,
  banner_url       TEXT,
  address          TEXT,
  city             VARCHAR(100),
  lat              DECIMAL(10,8),
  lon              DECIMAL(11,8),
  phone            VARCHAR(20),
  instagram_handle VARCHAR(100),
  is_active        BOOLEAN DEFAULT true,
  avg_rating       DECIMAL(3,2) DEFAULT 0,
  total_reviews    INTEGER DEFAULT 0,
  embedding        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL,
  price            DECIMAL(10,2),
  currency         VARCHAR(3) DEFAULT 'COP',
  images           TEXT[],
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_hours (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time   TIME NOT NULL,
  close_time  TIME NOT NULL,
  is_open     BOOLEAN DEFAULT true,
  UNIQUE(store_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS appointments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES users(id),
  service_id       UUID NOT NULL REFERENCES services(id),
  store_id         UUID NOT NULL REFERENCES stores(id),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  status           VARCHAR(20) DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','cancelled','completed','rescheduled')),
  notes            TEXT,
  cancel_reason    TEXT,
  allow_reschedule BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id),
  client_id      UUID NOT NULL REFERENCES users(id),
  store_id       UUID NOT NULL REFERENCES stores(id),
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_store_time ON appointments(store_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_client     ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_stores_category         ON stores(category);
CREATE INDEX IF NOT EXISTS idx_stores_location         ON stores(lat, lon);
CREATE INDEX IF NOT EXISTS idx_stores_active           ON stores(is_active);
`;

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
