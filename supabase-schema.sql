-- ===== ЛЮМС — Supabase Schema =====
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Товары
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  aroma TEXT,
  price INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('aromatic', 'decorative', 'gift', 'interior', 'seasonal')),
  badge TEXT CHECK (badge IN ('hit', 'new', 'eco', NULL)),
  description TEXT,
  composition TEXT,
  weight TEXT,
  burn_time TEXT,
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Заказы
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  city TEXT,
  address TEXT,
  apartment TEXT,
  postal_code TEXT,
  delivery_method TEXT,
  delivery_price INTEGER DEFAULT 0,
  subtotal INTEGER NOT NULL,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Позиции заказа
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- 4. Сообщения обратной связи
CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Слайды Hero-секции (главная страница)
CREATE TABLE hero_slides (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Row Level Security (RLS) =====
-- Защита данных: anon-ключ публичный, поэтому RLS обязателен!

-- Products: полный доступ (управление через админ-панель)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products: чтение" ON products FOR SELECT TO anon USING (true);
CREATE POLICY "Products: создание" ON products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Products: обновление" ON products FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Products: удаление" ON products FOR DELETE TO anon USING (true);

-- Orders: создание + чтение (для админки)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders: создание" ON orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Orders: чтение" ON orders FOR SELECT TO anon USING (true);

-- Order Items: создание + чтение
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order Items: создание" ON order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Order Items: чтение" ON order_items FOR SELECT TO anon USING (true);

-- Contact Messages: создание + чтение + обновление
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contact Messages: создание" ON contact_messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Contact Messages: чтение" ON contact_messages FOR SELECT TO anon USING (true);
CREATE POLICY "Contact Messages: обновление" ON contact_messages FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Hero Slides: полный доступ (управление через админ-панель)
ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hero Slides: чтение" ON hero_slides FOR SELECT TO anon USING (true);
CREATE POLICY "Hero Slides: создание" ON hero_slides FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Hero Slides: удаление" ON hero_slides FOR DELETE TO anon USING (true);

-- ===== Storage (для фото товаров) =====
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Product Images: публичное чтение"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'product-images');

CREATE POLICY "Product Images: загрузка"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Product Images: удаление"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'product-images');

-- ===== Начальные данные (товары) =====
INSERT INTO products (name, aroma, price, category, badge, description, composition, weight, burn_time) VALUES
  ('Ванильная мечта', 'Ваниль, карамель', 1290, 'aromatic', 'hit',
   'Тёплый, обволакивающий аромат натуральной ванили с нотками карамели. Идеальна для уютных вечеров дома.',
   'Соевый воск, хлопковый фитиль, ароматическое масло ванили', '200 г', '35-40 часов'),

  ('Лесная хвоя', 'Сосна, кедр, мох', 1490, 'aromatic', 'new',
   'Свежий аромат хвойного леса после дождя. Наполнит дом ощущением природы и спокойствия.',
   'Соевый воск, деревянный фитиль, эфирные масла сосны и кедра', '250 г', '40-45 часов'),

  ('Лаванда Прованса', 'Лаванда, бергамот', 1190, 'aromatic', 'eco',
   'Успокаивающий аромат лавандовых полей Прованса с лёгкими цитрусовыми нотками бергамота.',
   'Соевый воск, хлопковый фитиль, эфирное масло лаванды', '180 г', '30-35 часов'),

  ('Цитрусовый заряд', 'Апельсин, лимон, грейпфрут', 990, 'aromatic', NULL,
   'Бодрящий микс цитрусовых ароматов. Заряжает энергией и поднимает настроение.',
   'Соевый воск, хлопковый фитиль, эфирные масла цитрусовых', '160 г', '25-30 часов'),

  ('Роза и пион', 'Роза, пион, жасмин', 1590, 'decorative', 'hit',
   'Роскошный цветочный аромат в декоративной форме розы. Станет украшением любого интерьера.',
   'Соевый воск, хлопковый фитиль, парфюмерная композиция', '220 г', '35-40 часов'),

  ('Медитация', 'Сандал, пачули, ладан', 1390, 'interior', 'new',
   'Глубокий восточный аромат для медитации и релаксации. Помогает сконцентрироваться и найти гармонию.',
   'Соевый воск, деревянный фитиль, эфирные масла сандала и пачули', '200 г', '35-40 часов'),

  ('Подарочный набор «Уют»', 'Ваниль, лаванда, сандал', 3490, 'gift', 'hit',
   'Набор из трёх мини-свечей в подарочной упаковке. Идеальный подарок для любого повода.',
   '3 мини-свечи по 80 г, подарочная коробка', '240 г (3×80 г)', '15-20 часов каждая'),

  ('Морской бриз', 'Морская соль, озон, кокос', 1290, 'seasonal', 'eco',
   'Свежий морской аромат с нотками кокоса. Создаёт атмосферу летнего отдыха на побережье.',
   'Соевый воск, хлопковый фитиль, ароматическая композиция', '200 г', '35-40 часов');
