-- ===== ЛЮМС — Политики для админ-панели =====
-- Выполните этот SQL в Supabase Dashboard → SQL Editor
-- (если таблицы уже созданы через supabase-schema.sql)

-- Разрешить добавление товаров через anon-ключ
CREATE POLICY "Products: создание"
  ON products FOR INSERT
  TO anon
  WITH CHECK (true);

-- Разрешить обновление товаров через anon-ключ
CREATE POLICY "Products: обновление"
  ON products FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Разрешить удаление товаров через anon-ключ
CREATE POLICY "Products: удаление"
  ON products FOR DELETE
  TO anon
  USING (true);

-- Разрешить чтение заказов (для будущей админки заказов)
CREATE POLICY "Orders: чтение"
  ON orders FOR SELECT
  TO anon
  USING (true);

-- Разрешить чтение позиций заказов
CREATE POLICY "Order Items: чтение"
  ON order_items FOR SELECT
  TO anon
  USING (true);

-- Разрешить чтение сообщений
CREATE POLICY "Contact Messages: чтение"
  ON contact_messages FOR SELECT
  TO anon
  USING (true);

-- Разрешить обновление сообщений (пометка прочитанным)
CREATE POLICY "Contact Messages: обновление"
  ON contact_messages FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
