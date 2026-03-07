/* ===== ЛЮМС — Supabase Integration ===== */

/*
 * Ключи берутся из js/config.js (добавлен в .gitignore).
 * Подключайте в HTML в таком порядке:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="js/config.js"></script>
 * <script src="js/supabase.js"></script>
 */

// Клиент Supabase (назван db, чтобы не конфликтовать с window.supabase SDK)
var db = null;

function initSupabase() {
  if (db) return true; // уже инициализирован

  if (typeof CONFIG === 'undefined' || CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('Supabase: ключи не настроены в js/config.js. Используется localStorage.');
    return false;
  }

  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
    return true;
  }
  console.warn('Supabase SDK not loaded. Using localStorage fallback.');
  return false;
}

// --- Image Upload ---
async function uploadProductImage(file) {
  if (!db) return null;

  const ext = file.name.split('.').pop();
  const fileName = `product_${Date.now()}.${ext}`;

  const { error } = await db.storage
    .from('product-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }

  const { data: urlData } = db.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

async function deleteProductImage(imageUrl) {
  if (!db || !imageUrl) return;

  const fileName = imageUrl.split('/').pop();
  await db.storage
    .from('product-images')
    .remove([fileName]);
}

// --- Orders ---
async function saveOrderToSupabase(order) {
  if (!db) {
    const orders = JSON.parse(localStorage.getItem('lums_orders') || '[]');
    orders.push(order);
    localStorage.setItem('lums_orders', JSON.stringify(orders));
    return { success: true, fallback: true };
  }

  const { error: orderError } = await db
    .from('orders')
    .insert({
      id: order.id,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      customer_email: order.customer.email,
      city: order.address.city,
      address: order.address.address,
      apartment: order.address.apartment,
      postal_code: order.address.postalCode,
      delivery_method: order.delivery.method,
      delivery_price: order.delivery.price,
      subtotal: order.subtotal,
      total: order.total,
      status: order.status
    });

  if (orderError) {
    console.error('Error saving order:', orderError);
    return { success: false, error: orderError };
  }

  const items = order.items.map(item => ({
    order_id: order.id,
    product_id: item.id,
    product_name: item.name,
    price: item.price,
    quantity: item.qty
  }));

  const { error: itemsError } = await db
    .from('order_items')
    .insert(items);

  if (itemsError) {
    console.error('Error saving order items:', itemsError);
  }

  return { success: true };
}

// --- Decrease Stock ---
async function decreaseStock(items) {
  if (!db) return; // в локальном режиме не управляем stock

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    // Получаем текущий stock
    var { data: product, error: fetchErr } = await db
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single();

    if (fetchErr || !product) continue;

    var currentStock = product.stock || 0;
    if (currentStock > 0) {
      var newStock = Math.max(0, currentStock - item.qty);
      await db.from('products').update({ stock: newStock }).eq('id', item.id);
    }
    // Если stock === 0 (под заказ) — не трогаем
  }

  // Обновляем кэш продуктов
  _supabaseProducts = null;
}

// --- Contact Messages ---
async function saveContactMessage(message) {
  if (!db) {
    const messages = JSON.parse(localStorage.getItem('lums_messages') || '[]');
    messages.push({ ...message, created_at: new Date().toISOString() });
    localStorage.setItem('lums_messages', JSON.stringify(messages));
    return { success: true, fallback: true };
  }

  const { error } = await db
    .from('contact_messages')
    .insert({
      name: message.name,
      email: message.email,
      subject: message.subject,
      message: message.message
    });

  if (error) {
    console.error('Error saving message:', error);
    return { success: false, error };
  }

  return { success: true };
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
