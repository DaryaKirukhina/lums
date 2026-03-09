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

  var orderData = {
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
  };
  if (order.user_id) orderData.user_id = order.user_id;

  const { error: orderError } = await db
    .from('orders')
    .insert(orderData);

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

// --- Decrease Stock (через RPC, обходит RLS) ---
async function decreaseStock(items) {
  if (!db) return;

  var itemsJson = items.map(function(item) {
    return { id: item.id, qty: item.qty };
  });

  var { error } = await db.rpc('decrease_stock', { items: itemsJson });
  if (error) {
    console.error('Error decreasing stock:', error);
  }

  // Обновляем кэш продуктов
  _supabaseProducts = null;
}

// --- Telegram (через RPC, токен на сервере) ---
async function sendTelegramViaRPC(messageText) {
  if (!db) return;

  var { error } = await db.rpc('send_telegram', { message_text: messageText });
  if (error) {
    console.error('Telegram RPC error:', error);
  }
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

// --- Send Order Confirmation Email (via Resend RPC) ---
async function sendOrderEmail(order) {
  if (!db) return;

  var itemsHtml = '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">'
    + '<thead><tr style="background:#f9f9f9;"><th style="padding:8px;text-align:left;">Товар</th><th style="padding:8px;">Кол-во</th><th style="padding:8px;text-align:right;">Сумма</th></tr></thead><tbody>';
  order.items.forEach(function(item) {
    itemsHtml += '<tr><td style="padding:8px;border-bottom:1px solid #f0f0f0;">' + item.name + '</td>'
      + '<td style="padding:8px;border-bottom:1px solid #f0f0f0;">' + item.qty + ' шт.</td>'
      + '<td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;">' + (item.price * item.qty) + ' ₽</td></tr>';
  });
  itemsHtml += '</tbody></table>';

  try {
    await db.rpc('send_order_email', {
      order_id: order.id,
      customer_email: order.customer.email,
      customer_name: order.customer.name,
      items_html: itemsHtml,
      total_amount: order.total
    });
  } catch(e) {
    console.error('Order email error:', e);
  }
}

// --- Send Status Change Email (via Resend RPC) ---
async function sendStatusEmail(orderId, customerEmail, newStatus) {
  if (!db) return;
  try {
    await db.rpc('send_status_email', {
      order_id: orderId,
      customer_email: customerEmail,
      new_status: newStatus
    });
  } catch(e) {
    console.error('Status email error:', e);
  }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
