/* ===== ЛЮМС — Checkout JS ===== */

/*
 * ========================================================
 *  Интеграция с ЮKassa (YooKassa)
 * ========================================================
 *
 *  Для подключения оплаты через ЮKassa необходимо:
 *
 *  1. Зарегистрировать магазин на https://yookassa.ru и получить:
 *     - shopId (идентификатор магазина)
 *     - secretKey (секретный ключ API)
 *
 *  2. На серверной стороне (Node.js / PHP / Python) создать эндпоинт
 *     для создания платежа. Пример запроса к API ЮKassa:
 *
 *     POST https://api.yookassa.ru/v3/payments
 *     Authorization: Basic <shopId>:<secretKey>
 *     Idempotence-Key: <уникальный UUID>
 *     Content-Type: application/json
 *
 *     {
 *       "amount": {
 *         "value": "1640.00",
 *         "currency": "RUB"
 *       },
 *       "confirmation": {
 *         "type": "redirect",
 *         "return_url": "https://lums.ru/order-success"
 *       },
 *       "capture": true,
 *       "description": "Заказ №123 в магазине ЛЮМС",
 *       "metadata": {
 *         "order_id": "123"
 *       }
 *     }
 *
 *  3. Из ответа API получить confirmation.confirmation_url
 *     и перенаправить пользователя на эту ссылку для оплаты.
 *
 *  4. Настроить webhook (HTTP-уведомления) на стороне ЮKassa
 *     для получения статуса платежа (payment.succeeded, payment.canceled).
 *
 *  5. После подтверждения оплаты — обновить статус заказа в базе данных.
 *
 * ========================================================
 */

// --- Render Order Summary ---
async function renderOrderSummary() {
  const itemsContainer = document.getElementById('orderItems');
  const subtotalEl = document.getElementById('summarySubtotal');
  const deliveryEl = document.getElementById('summaryDelivery');
  const totalEl = document.getElementById('summaryTotal');

  if (!itemsContainer) return;

  // Ensure products loaded from Supabase
  await fetchAllProducts();

  const items = getCartItems();
  const subtotal = getCartTotal();

  if (items.length === 0) {
    itemsContainer.innerHTML = '<p style="color: var(--gray); font-size: 0.9rem;">Корзина пуста</p>';
  } else {
    let html = '';
    items.forEach(item => {
      var imgUrl = item.image_url || item.imageUrl;
      var imgHtml = imgUrl
        ? '<img src="' + imgUrl + '" alt="' + item.name + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'
        : '<div class="placeholder p' + ((item.id % 8) + 1) + '">🕯️</div>';

      html += '<div class="checkout-order-item">' +
        '<div class="checkout-order-item-img">' + imgHtml + '</div>' +
        '<div style="flex: 1;">' +
          '<div style="font-weight: 500; font-size: 0.9rem; margin-bottom: 2px;">' + item.name + '</div>' +
          '<div style="font-size: 0.8rem; color: var(--gray);">' + item.qty + ' шт. &times; ' + formatPrice(item.price) + '</div>' +
        '</div>' +
        '<div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap;">' + formatPrice(item.price * item.qty) + '</div>' +
      '</div>';
    });
    itemsContainer.innerHTML = html;
  }

  const deliveryPrice = getSelectedDeliveryPrice();

  if (subtotalEl) {
    subtotalEl.innerHTML = '<span>Товары</span><span>' + formatPrice(subtotal) + '</span>';
  }
  if (deliveryEl) {
    deliveryEl.innerHTML = '<span>Доставка</span><span>' + (deliveryPrice === 0 ? 'бесплатно' : formatPrice(deliveryPrice)) + '</span>';
  }
  if (totalEl) {
    totalEl.innerHTML = '<span>Итого</span><span>' + formatPrice(subtotal + deliveryPrice) + '</span>';
  }
}

// --- Get Selected Delivery Price ---
function getSelectedDeliveryPrice() {
  const selected = document.querySelector('input[name="delivery"]:checked');
  return selected ? parseInt(selected.dataset.price, 10) : 0;
}

// --- Delivery Logic ---
function handleDeliveryChange() {
  const selected = document.querySelector('input[name="delivery"]:checked');
  if (!selected) return;

  const method = selected.value;
  const cityField = document.getElementById('city');
  const addressField = document.getElementById('address');
  const apartmentField = document.getElementById('apartment');
  const postalCodeField = document.getElementById('postalCode');
  const courierNote = document.getElementById('courierNote');
  const pickupInfo = document.getElementById('pickupInfo');
  const addressSection = document.getElementById('addressSection');

  // Reset
  if (courierNote) courierNote.style.display = 'none';
  if (pickupInfo) pickupInfo.style.display = 'none';

  if (method === 'self') {
    // Самовывоз: скрыть поля адреса, показать адрес самовывоза
    if (addressSection) addressSection.style.display = 'none';
    if (pickupInfo) pickupInfo.style.display = 'block';
  } else if (method === 'courier') {
    // Курьер: только по Самаре
    if (addressSection) addressSection.style.display = '';
    if (cityField) {
      cityField.value = 'Самара';
      cityField.readOnly = true;
    }
    if (addressField) addressField.readOnly = false;
    if (courierNote) courierNote.style.display = 'block';
  } else {
    // Пункт выдачи: свободный ввод
    if (addressSection) addressSection.style.display = '';
    if (cityField) {
      cityField.readOnly = false;
      if (cityField.value === 'Самара') cityField.value = '';
    }
    if (addressField) addressField.readOnly = false;
  }

  renderOrderSummary();
}

// --- Telegram Notification ---
async function sendTelegramNotification(order) {
  if (typeof CONFIG === 'undefined' || !CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    console.warn('Telegram: не настроены TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в config.js');
    return;
  }

  var DELIVERY_NAMES = {
    courier: 'Курьер (350 руб.)',
    pickup_point: 'Пункт выдачи (200 руб.)',
    self: 'Самовывоз (бесплатно)'
  };

  var itemsList = order.items.map(function(item) {
    return '  - ' + escapeHtml(item.name) + ' x ' + item.qty + ' = ' + item.price * item.qty + ' руб.';
  }).join('\n');

  var text = '\u{1F56F} <b>Новый заказ!</b>\n\n' +
    '\u{1F4CB} <b>Заказ:</b> ' + order.id + '\n' +
    '\u{1F464} <b>Клиент:</b> ' + escapeHtml(order.customer.name) + '\n' +
    '\u{1F4DE} <b>Телефон:</b> ' + escapeHtml(order.customer.phone) + '\n' +
    '\u{1F4E7} <b>Email:</b> ' + escapeHtml(order.customer.email) + '\n\n' +
    '\u{1F6D2} <b>Товары:</b>\n' + itemsList + '\n\n' +
    '\u{1F69A} <b>Доставка:</b> ' + (DELIVERY_NAMES[order.delivery.method] || order.delivery.method) + '\n';

  if (order.delivery.method !== 'self') {
    text += '\u{1F4CD} <b>Адрес:</b> ' + escapeHtml(order.address.city) + ', ' + escapeHtml(order.address.address);
    if (order.address.apartment) text += ', кв. ' + escapeHtml(order.address.apartment);
    text += '\n';
  } else {
    text += '\u{1F4CD} <b>Самовывоз:</b> г. Самара, ул. Мориса Тореза 13А\n';
  }

  text += '\n\u{1F4B0} <b>Итого:</b> ' + order.total + ' руб.';

  try {
    var response = await fetch('https://api.telegram.org/bot' + CONFIG.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });
    var result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }
  } catch (e) {
    console.error('Telegram notification error:', e);
  }
}

// Экранирование HTML-спецсимволов для Telegram
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Form Validation ---
function validateCheckoutForm() {
  const form = document.getElementById('checkoutForm');
  if (!form) return false;

  const selected = document.querySelector('input[name="delivery"]:checked');
  const isSelfPickup = selected && selected.value === 'self';

  const requiredFields = form.querySelectorAll('[required]');
  let isValid = true;

  requiredFields.forEach(field => {
    field.style.borderColor = '';

    // Skip address fields for self-pickup
    if (isSelfPickup && (field.id === 'city' || field.id === 'address')) return;

    const value = field.value.trim();
    if (!value) {
      field.style.borderColor = 'var(--coral)';
      isValid = false;
    }

    if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        field.style.borderColor = 'var(--coral)';
        isValid = false;
      }
    }

    if (field.type === 'tel' && value) {
      const phoneClean = value.replace(/[\s\-\(\)]/g, '');
      if (phoneClean.length < 10) {
        field.style.borderColor = 'var(--coral)';
        isValid = false;
      }
    }
  });

  return isValid;
}

// --- Handle Form Submit ---
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (!validateCheckoutForm()) {
    showNotification('Пожалуйста, заполните все обязательные поля');
    return;
  }

  var items = getCartItems();
  if (items.length === 0) {
    showNotification('Корзина пуста');
    return;
  }

  // Перепроверяем stock перед оформлением (актуальные данные)
  _supabaseProducts = null; // сбрасываем кэш
  await fetchAllProducts();
  var stockIssues = [];
  items.forEach(function(item) {
    var fresh = getProductById(item.id);
    var stock = (fresh && fresh.stock) || 0;
    if (stock > 0 && item.qty > stock) {
      stockIssues.push(item.name + ': доступно ' + stock + ' шт., в корзине ' + item.qty);
    }
  });
  if (stockIssues.length > 0) {
    showNotification('Недостаточно товара: ' + stockIssues.join('; '));
    return;
  }

  var form = document.getElementById('checkoutForm');
  const deliveryPrice = getSelectedDeliveryPrice();
  const subtotal = getCartTotal();
  const deliveryMethod = document.querySelector('input[name="delivery"]:checked').value;

  var city, address, apartment, postalCode;
  if (deliveryMethod === 'self') {
    city = 'Самара';
    address = 'ул. Мориса Тореза 13А';
    apartment = '';
    postalCode = '';
  } else {
    city = form.querySelector('#city').value.trim();
    address = form.querySelector('#address').value.trim();
    apartment = form.querySelector('#apartment').value.trim();
    postalCode = form.querySelector('#postalCode').value.trim();
  }

  const order = {
    id: 'LUMS-' + Date.now(),
    timestamp: new Date().toISOString(),
    customer: {
      name: form.querySelector('#customerName').value.trim(),
      phone: form.querySelector('#customerPhone').value.trim(),
      email: form.querySelector('#customerEmail').value.trim(),
    },
    address: {
      city: city,
      address: address,
      apartment: apartment,
      postalCode: postalCode,
    },
    delivery: {
      method: deliveryMethod,
      price: deliveryPrice,
    },
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty,
    })),
    subtotal: subtotal,
    total: subtotal + deliveryPrice,
    status: 'pending',
  };

  // Save to Supabase (or localStorage fallback)
  var result = await saveOrderToSupabase(order);

  if (!result.success) {
    showNotification('Ошибка при сохранении заказа. Попробуйте ещё раз.');
    return;
  }

  // Уменьшаем stock для товаров в наличии
  await decreaseStock(order.items);

  // Send Telegram notification
  await sendTelegramNotification(order);

  showNotification('Заказ успешно оформлен! Спасибо за покупку.');
  clearCart();

  setTimeout(function() {
    window.location.href = 'index.html?order=success';
  }, 2000);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async function() {
  // Load products first
  await fetchAllProducts();

  // Render order summary
  await renderOrderSummary();

  // Listen for delivery method changes
  var deliveryRadios = document.querySelectorAll('input[name="delivery"]');
  deliveryRadios.forEach(function(radio) {
    radio.addEventListener('change', handleDeliveryChange);
  });

  // Apply initial delivery state
  handleDeliveryChange();

  // Form submit
  var form = document.getElementById('checkoutForm');
  if (form) {
    form.addEventListener('submit', handleCheckoutSubmit);
  }
});
