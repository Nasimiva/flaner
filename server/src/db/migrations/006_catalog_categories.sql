-- Catalog categories by product type. Existing categories and products are kept:
--   * "Уход за лицом" (face-care) becomes "Уход за кожей", an existing "наборы" category becomes
--     "Наборы и адвент-календари" (created only if the catalog has no sets category yet);
--   * "Декоративная косметика" (makeup) stays as the umbrella used by banner buttons and older clients,
--     the storefront shows every decorative category under it;
--   * no product is moved here: products are re-assigned from the admin side, and nothing is deleted.
INSERT INTO categories (id, name_ru, name_uz, sort_order) VALUES
  ('foundation',  'Тональные средства и консилеры',   'Tonal vositalar va konsilerlar',     10),
  ('blush',       'Румяна',                           'Rumyanalar',                         20),
  ('contour',     'Контуринг и бронзеры',             'Kontur va bronzerlar',               30),
  ('highlighter', 'Хайлайтеры',                       'Xaylayterlar',                       40),
  ('eyeshadow',   'Палетки и тени',                   'Paletkalar va ko''z soyalari',       50),
  ('eye-pencil',  'Карандаши для глаз и бровей',      'Ko''z va qosh qalamlari',            60),
  ('mascara',     'Тушь и подводки',                  'Tush va layner',                     70),
  ('lips',        'Помады, блески и карандаши для губ', 'Lab bo''yoqlari, glosslar va qalamlar', 80),
  ('powder',      'Пудры',                            'Pudralar',                           90),
  ('other',       'Другие товары',                    'Boshqa mahsulotlar',                 130)
ON CONFLICT (id) DO NOTHING;

UPDATE categories SET name_ru = 'Уход за кожей', name_uz = 'Teri parvarishi', sort_order = 100
  WHERE id = 'face-care' AND name_ru = 'Уход за лицом';
UPDATE categories SET sort_order = 110 WHERE id = 'perfume';

UPDATE categories SET name_ru = 'Наборы и адвент-календари', name_uz = 'To''plamlar va advent-kalendarlar', sort_order = 120
  WHERE name_ru IN ('наборы', 'Наборы');
INSERT INTO categories (id, name_ru, name_uz, sort_order)
  SELECT 'sets', 'Наборы и адвент-календари', 'To''plamlar va advent-kalendarlar', 120
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_ru = 'Наборы и адвент-календари');

-- The umbrella and any older admin-made categories go after the type categories.
UPDATE categories SET sort_order = 200 WHERE id = 'makeup';
UPDATE categories SET sort_order = sort_order + 200
  WHERE id NOT IN ('foundation','blush','contour','highlighter','eyeshadow','eye-pencil','mascara','lips','powder',
                   'face-care','perfume','other','makeup','sets')
    AND name_ru <> 'Наборы и адвент-календари';
