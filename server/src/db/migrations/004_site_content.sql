-- Editable storefront content (hero banners, brand strip) managed from the admin panel.
-- Additive only: one new table, no existing table is altered. When a key has no row the storefront
-- falls back to the defaults bundled with the client, so the site works before anything is saved.
CREATE TABLE IF NOT EXISTS site_content (
  key         TEXT PRIMARY KEY CHECK (key IN ('banners', 'brands')),
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
