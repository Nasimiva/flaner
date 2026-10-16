-- Inventory, sales and cost accounting (admin only; none of it is exposed by the public catalog API).
--   * products.cost_price  - purchase price per unit, 0 until the admin fills it in;
--   * stock_movements      - one row per receipt / sale / sale cancellation / manual correction.
-- Existing products keep their stock_count and in_stock exactly as they are.
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (cost_price >= 0);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  -- Kept (NULL) when a product is deleted, so sales history and reports survive; name and brand are snapshots.
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('receipt', 'sale', 'sale_cancel', 'adjustment')),
  -- Signed change of the stock: receipt +N, sale -N, sale_cancel +N, adjustment +-N.
  delta INTEGER NOT NULL CHECK (delta <> 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  -- Sales: the price actually charged, the regular price at that moment and the cost price at that moment.
  unit_price DOUBLE PRECISION CHECK (unit_price >= 0),
  list_price DOUBLE PRECISION CHECK (list_price >= 0),
  unit_cost DOUBLE PRECISION CHECK (unit_cost >= 0),
  note TEXT,
  actor TEXT NOT NULL DEFAULT '',
  -- A cancelled sale keeps its row (marked), and the cancellation is a separate sale_cancel row pointing back at it.
  cancelled_at TIMESTAMPTZ,
  cancel_of BIGINT REFERENCES stock_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_movements_sign CHECK (
    (kind IN ('receipt', 'sale_cancel') AND delta > 0) OR (kind = 'sale' AND delta < 0) OR kind = 'adjustment'
  ),
  CONSTRAINT stock_movements_sale_fields CHECK (kind <> 'sale' OR (unit_price IS NOT NULL AND unit_cost IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_cancel_of_key ON stock_movements (cancel_of) WHERE cancel_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_sales_idx ON stock_movements (created_at) WHERE kind = 'sale' AND cancelled_at IS NULL;
