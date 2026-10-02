-- Leads ("заявки"): a shopper submits their cart as a call-back request; staff phone them.
-- Additive only: no existing table is altered. There is no payment and no stock reservation:
-- a lead never changes products.stock_count / in_stock.
-- Status flow: new -> contacted -> confirmed -> completed | cancelled (transitions enforced by the API).

CREATE TABLE IF NOT EXISTS leads (
  id                TEXT PRIMARY KEY,
  lead_number       TEXT NOT NULL UNIQUE,
  first_name        TEXT NOT NULL CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 60),
  last_name         TEXT NOT NULL CHECK (char_length(btrim(last_name))  BETWEEN 1 AND 60),
  -- Normalised by the API to +998XXXXXXXXX (Uzbekistan).
  phone             TEXT NOT NULL CHECK (phone ~ '^\+998[0-9]{9}$'),
  comment           TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  status            TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'contacted', 'confirmed', 'completed', 'cancelled')),
  -- Internal note written by staff; never shown to the shopper.
  staff_note        TEXT CHECK (staff_note IS NULL OR char_length(staff_note) <= 2000),
  -- Only set from a server-verified Telegram initData, never from a client-supplied id.
  telegram_id       BIGINT,
  telegram_username TEXT,
  source            TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'telegram')),
  -- Client-generated key: a retried submit returns the same lead instead of creating a duplicate.
  idempotency_key   TEXT CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 100),
  -- Sum of unit_price * quantity from the snapshot below. Informational only (staff quote the live price).
  items_total       BIGINT NOT NULL DEFAULT 0 CHECK (items_total >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_idempotency_key_uidx ON leads (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_status_created_idx ON leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone);

-- Snapshot of each cart line at submit time. Survives later price changes and product deletion.
CREATE TABLE IF NOT EXISTS lead_items (
  id           BIGSERIAL PRIMARY KEY,
  lead_id      TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  -- NULL after the product is deleted from the catalog; the snapshot columns keep the lead readable.
  product_id   TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL CHECK (char_length(product_name) > 0),
  brand        TEXT NOT NULL DEFAULT '',
  volume       TEXT NOT NULL DEFAULT '',
  unit_price   BIGINT NOT NULL CHECK (unit_price >= 0),
  quantity     INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20)
);

CREATE INDEX IF NOT EXISTS lead_items_lead_idx ON lead_items (lead_id, position);
CREATE INDEX IF NOT EXISTS lead_items_product_idx ON lead_items (product_id) WHERE product_id IS NOT NULL;
-- A product appears at most once per lead (the API merges duplicate cart lines).
CREATE UNIQUE INDEX IF NOT EXISTS lead_items_lead_product_uidx ON lead_items (lead_id, product_id) WHERE product_id IS NOT NULL;

-- Audit trail of every status change (including the initial 'new').
CREATE TABLE IF NOT EXISTS lead_status_history (
  id          BIGSERIAL PRIMARY KEY,
  lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('new', 'contacted', 'confirmed', 'completed', 'cancelled')),
  to_status   TEXT NOT NULL CHECK (to_status IN ('new', 'contacted', 'confirmed', 'completed', 'cancelled')),
  -- Admin email, or 'system' for the initial status written at submit time.
  actor       TEXT NOT NULL CHECK (char_length(actor) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_status_history_lead_idx ON lead_status_history (lead_id, id);
