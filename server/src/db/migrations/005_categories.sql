-- Product categories managed from the admin panel.
-- The three original categories are seeded so the existing catalog keeps working, and the hard-coded
-- CHECK on products.category is dropped so a product can use any category created in the admin panel.
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name_ru     TEXT NOT NULL,
  name_uz     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (id, name_ru, name_uz, sort_order) VALUES
  ('face-care', 'Уход за лицом', 'Yuz parvarishi', 10),
  ('makeup', 'Декоративная косметика', 'Dekorativ kosmetika', 20),
  ('perfume', 'Парфюмерия', 'Parfyumeriya', 30)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
