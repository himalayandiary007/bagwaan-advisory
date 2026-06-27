-- HP Apple Advisory Bot - PostgreSQL Schema
-- Run: psql $DATABASE_URL -f src/db/schema.sql

-- Farmers registered on the platform
CREATE TABLE IF NOT EXISTS farmers (
  id            SERIAL PRIMARY KEY,
  phone         VARCHAR(30) UNIQUE NOT NULL,   -- full WhatsApp number e.g. whatsapp:+919816001234
  name          VARCHAR(100),
  village       VARCHAR(100),
  district      VARCHAR(50),
  language      VARCHAR(5) DEFAULT 'hi',       -- 'hi' = Hindi, 'en' = English
  conv_state    VARCHAR(50) DEFAULT 'NEW',     -- current conversation state
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- One farmer can have multiple orchards
CREATE TABLE IF NOT EXISTS orchards (
  id              SERIAL PRIMARY KEY,
  farmer_id       INTEGER REFERENCES farmers(id) ON DELETE CASCADE,
  area_bigha      NUMERIC(6,2),
  altitude_zone   VARCHAR(10),                 -- 'low' (<1800m), 'mid' (1800-2600m), 'high' (>2600m)
  altitude_m      INTEGER,                     -- approximate meters
  primary_variety VARCHAR(80),                 -- e.g. 'Royal Delicious', 'Gala', 'Fuji'
  irrigation_type VARCHAR(30),                 -- 'drip', 'flood', 'none'
  lat             DECIMAL(10, 7),
  lng             DECIMAL(10, 7),
  current_stage_id VARCHAR(50),               -- e.g. 'green_tip', 'pink_bud'
  stage_set_at    DATE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Every spray the farmer logs
CREATE TABLE IF NOT EXISTS spray_logs (
  id                SERIAL PRIMARY KEY,
  orchard_id        INTEGER REFERENCES orchards(id) ON DELETE CASCADE,
  spray_date        DATE NOT NULL,
  stage_id          VARCHAR(50),
  active_ingredient VARCHAR(200),
  brand_name        VARCHAR(100),
  dose_applied      VARCHAR(50),
  spray_type        VARCHAR(20),               -- 'disease', 'pest', 'nutrient'
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Weather alerts/events tracked per orchard
CREATE TABLE IF NOT EXISTS weather_events (
  id            SERIAL PRIMARY KEY,
  orchard_id    INTEGER REFERENCES orchards(id) ON DELETE CASCADE,
  event_type    VARCHAR(50),                   -- 'rain_after_spray', 'scab_infection_window', 'high_temp'
  event_date    DATE NOT NULL,
  severity      VARCHAR(20),                   -- 'low', 'medium', 'high'
  alert_sent    BOOLEAN DEFAULT FALSE,
  details       JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Temporary key-value store for mid-conversation data collection
-- (e.g., storing "name" before the farmer finishes onboarding)
CREATE TABLE IF NOT EXISTS conv_temp (
  id          SERIAL PRIMARY KEY,
  phone       VARCHAR(30) NOT NULL,
  key         VARCHAR(50) NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (phone, key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_farmers_phone ON farmers(phone);
CREATE INDEX IF NOT EXISTS idx_orchards_farmer ON orchards(farmer_id);
CREATE INDEX IF NOT EXISTS idx_spray_logs_orchard ON spray_logs(orchard_id);
CREATE INDEX IF NOT EXISTS idx_weather_events_orchard ON weather_events(orchard_id);
