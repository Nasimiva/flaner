CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('face-care', 'makeup', 'perfume', 'brands')),
  price DOUBLE PRECISION NOT NULL CHECK (price >= 0),
  old_price DOUBLE PRECISION,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  volume TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  composition TEXT NOT NULL DEFAULT '',
  how_to_use TEXT,
  skin_type TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  is_new BOOLEAN,
  is_bestseller BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON products (created_at DESC);
