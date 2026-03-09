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
 *         "return_url": "https://lumscandle.ru/order-success"
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

// --- Promo & Discount State ---
var appliedPromo = null; // { code, discount } or null
var FREE_DELIVERY_THRESHOLD = 3000;

// --- Promo Code Logic ---
async function applyPromoCode() {
  var input = document.getElementById('promoCode');
  var resultEl = document.getElementById('promoResult');
  if (!input || !resultEl) return;

  var code = input.value.trim().toLowerCase();

  if (code === '') {
    resultEl.style.display = 'none';
    return;
  }

  if (code === 'люмс15') {
    // Проверяем: промокод только на первый заказ (не использовался ранее)
    var alreadyUsed = await checkPromoAlreadyUsed('люмс15');
    if (alreadyUsed) {
      appliedPromo = null;
      resultEl.textContent = 'Промокод действует только на первый заказ';
      resultEl.style.color = 'var(--coral)';
      resultEl.style.display = 'block';
      renderOrderSummary();
      return;
    }

    appliedPromo = { code: 'люмс15', discount: 0.15 };
    resultEl.textContent = 'Промокод применён! Скидка 15%';
    resultEl.style.color = 'var(--green, #2d8a4e)';
    resultEl.style.display = 'block';
    input.disabled = true;
    document.getElementById('applyPromoBtn').disabled = true;
  } else {
    appliedPromo = null;
    resultEl.textContent = 'Промокод не найден';
    resultEl.style.color = 'var(--coral)';
    resultEl.style.display = 'block';
  }

  renderOrderSummary();
}

// --- Check if promo code already used by this user/email ---
async function checkPromoAlreadyUsed(code) {
  if (!db) return false;

  // Проверяем по user_id если залогинен
  if (typeof currentUser !== 'undefined' && currentUser) {
    try {
      var { data } = await db.from('orders').select('id').eq('user_id', currentUser.id).eq('promo_code', code).limit(1);
      if (data && data.length > 0) return true;
    } catch(e) {}
  }

  // Проверяем по email
  var emailField = document.getElementById('customerEmail');
  if (emailField && emailField.value.trim()) {
    try {
      var { data } = await db.from('orders').select('id').eq('customer_email', emailField.value.trim()).eq('promo_code', code).limit(1);
      if (data && data.length > 0) return true;
    } catch(e) {}
  }

  return false;
}

// --- Get Effective Delivery Price (free from 3000₽) ---
function getEffectiveDeliveryPrice(subtotal) {
  var selected = document.querySelector('input[name="delivery"]:checked');
  var basePrice = selected ? parseInt(selected.dataset.price, 10) : 0;

  // Бесплатная доставка от 3000 ₽ (после скидки)
  var afterDiscount = appliedPromo ? subtotal * (1 - appliedPromo.discount) : subtotal;
  if (afterDiscount >= FREE_DELIVERY_THRESHOLD && basePrice > 0) {
    return 0;
  }
  return basePrice;
}

// --- Render Order Summary ---
async function renderOrderSummary() {
  var itemsContainer = document.getElementById('orderItems');
  var subtotalEl = document.getElementById('summarySubtotal');
  var discountEl = document.getElementById('summaryDiscount');
  var deliveryEl = document.getElementById('summaryDelivery');
  var totalEl = document.getElementById('summaryTotal');

  if (!itemsContainer) return;

  await fetchAllProducts();

  var items = getCartItems();
  var subtotal = getCartTotal();

  if (items.length === 0) {
    itemsContainer.innerHTML = '<p style="color: var(--gray); font-size: 0.9rem;">Корзина пуста</p>';
  } else {
    var html = '';
    items.forEach(function(item) {
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

  // Calculate discount
  var discountAmount = 0;
  if (appliedPromo) {
    discountAmount = Math.round(subtotal * appliedPromo.discount);
  }
  var subtotalAfterDiscount = subtotal - discountAmount;
  var deliveryPrice = getEffectiveDeliveryPrice(subtotal);
  var total = subtotalAfterDiscount + deliveryPrice;

  if (subtotalEl) {
    subtotalEl.innerHTML = '<span>Товары</span><span>' + formatPrice(subtotal) + '</span>';
  }
  if (discountEl) {
    if (appliedPromo) {
      discountEl.innerHTML = '<span>Скидка ' + Math.round(appliedPromo.discount * 100) + '%</span><span>−' + formatPrice(discountAmount) + '</span>';
      discountEl.style.display = '';
    } else {
      discountEl.style.display = 'none';
    }
  }
  if (deliveryEl) {
    deliveryEl.innerHTML = '<span>Доставка</span><span>' + (deliveryPrice === 0 ? 'бесплатно' : formatPrice(deliveryPrice)) + '</span>';
  }
  if (totalEl) {
    totalEl.innerHTML = '<span>Итого</span><span>' + formatPrice(total) + '</span>';
  }

  // Update free delivery note
  updateDeliveryPriceLabels(subtotal);
}

// --- Update delivery price labels (free from 3000₽) ---
function updateDeliveryPriceLabels(subtotal) {
  var afterDiscount = appliedPromo ? subtotal * (1 - appliedPromo.discount) : subtotal;
  var isFree = afterDiscount >= FREE_DELIVERY_THRESHOLD;
  var freeNote = document.getElementById('freeDeliveryNote');

  // Update radio labels
  var labels = document.querySelectorAll('.delivery-price-label');
  labels.forEach(function(label) {
    var radio = label.closest('.delivery-option').querySelector('input[type="radio"]');
    var basePrice = parseInt(radio.dataset.price, 10);
    if (basePrice > 0) {
      label.textContent = isFree ? ' — бесплатно' : ' — ' + basePrice + ' ₽';
    }
  });

  if (freeNote) {
    freeNote.style.display = isFree ? 'block' : 'none';
    if (isFree) freeNote.textContent = 'Бесплатная доставка при заказе от 3 000 ₽!';
  }
}

// --- Get Selected Delivery Price (for compatibility) ---
function getSelectedDeliveryPrice() {
  var subtotal = getCartTotal();
  return getEffectiveDeliveryPrice(subtotal);
}

// --- Delivery Logic ---
function handleDeliveryChange() {
  var selected = document.querySelector('input[name="delivery"]:checked');
  if (!selected) return;

  var method = selected.value;
  var courierNote = document.getElementById('courierNote');
  var pickupInfo = document.getElementById('pickupInfo');
  var addressSection = document.getElementById('addressSection');
  var addressTitle = document.getElementById('addressSectionTitle');
  var courierFields = document.getElementById('courierFields');
  var pickupPointFields = document.getElementById('pickupPointFields');
  var addressField = document.getElementById('address');
  var pickupAddressField = document.getElementById('pickupAddress');
  var cityField = document.getElementById('city');

  // Reset
  if (courierNote) courierNote.style.display = 'none';
  if (pickupInfo) pickupInfo.style.display = 'none';

  if (method === 'self') {
    if (addressSection) addressSection.style.display = 'none';
    if (pickupInfo) pickupInfo.style.display = 'block';
    // Remove required from address fields
    if (addressField) addressField.removeAttribute('required');
    if (pickupAddressField) pickupAddressField.removeAttribute('required');
    if (cityField) cityField.removeAttribute('required');
  } else if (method === 'courier') {
    if (addressSection) addressSection.style.display = '';
    if (addressTitle) addressTitle.textContent = 'Адрес доставки';
    if (courierFields) courierFields.style.display = '';
    if (pickupPointFields) pickupPointFields.style.display = 'none';
    if (addressField) addressField.setAttribute('required', '');
    if (pickupAddressField) pickupAddressField.removeAttribute('required');
    if (cityField) cityField.removeAttribute('required');
    if (courierNote) courierNote.style.display = 'block';
  } else if (method === 'pickup_point') {
    if (addressSection) addressSection.style.display = '';
    if (addressTitle) addressTitle.textContent = 'Пункт выдачи';
    if (courierFields) courierFields.style.display = 'none';
    if (pickupPointFields) pickupPointFields.style.display = '';
    if (addressField) addressField.removeAttribute('required');
    if (pickupAddressField) pickupAddressField.setAttribute('required', '');
    if (cityField) cityField.setAttribute('required', '');
  }

  renderOrderSummary();
}

// --- Telegram Notification (через серверную функцию) ---
async function sendTelegramNotification(order) {
  var DELIVERY_NAMES = {
    courier: 'Курьер по Самаре',
    pickup_point: 'Пункт выдачи',
    self: 'Самовывоз'
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
    '\u{1F69A} <b>Доставка:</b> ' + (DELIVERY_NAMES[order.delivery.method] || order.delivery.method) +
    ' (' + (order.delivery.price === 0 ? 'бесплатно' : order.delivery.price + ' руб.') + ')\n';

  if (order.delivery.method === 'courier') {
    text += '\u{1F4CD} <b>Адрес:</b> г. Самара, ' + escapeHtml(order.address.address);
    if (order.address.apartment) text += ', кв. ' + escapeHtml(order.address.apartment);
    text += '\n';
  } else if (order.delivery.method === 'pickup_point') {
    text += '\u{1F4CD} <b>ПВЗ:</b> ' + escapeHtml(order.address.city) + ', ' + escapeHtml(order.address.address) + '\n';
  } else {
    text += '\u{1F4CD} <b>Самовывоз:</b> г. Самара, ул. Мориса Тореза 13А\n';
  }

  if (order.promo) {
    text += '\u{1F3F7} <b>Промокод:</b> ' + escapeHtml(order.promo.code) + ' (-' + Math.round(order.promo.discount * 100) + '%)\n';
  }

  if (order.comment) {
    text += '\u{1F4AC} <b>Комментарий:</b> ' + escapeHtml(order.comment) + '\n';
  }

  text += '\n\u{1F4B0} <b>Итого:</b> ' + order.total + ' руб.';

  await sendTelegramViaRPC(text);
}

// Экранирование HTML-спецсимволов для Telegram
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Form Validation ---
function validateCheckoutForm() {
  var form = document.getElementById('checkoutForm');
  if (!form) return false;

  var requiredFields = form.querySelectorAll('[required]');
  var isValid = true;

  requiredFields.forEach(function(field) {
    field.style.borderColor = '';

    // Skip hidden fields
    if (field.offsetParent === null) return;

    var value = field.value.trim();
    if (!value) {
      field.style.borderColor = 'var(--coral)';
      isValid = false;
    }

    if (field.type === 'email' && value) {
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        field.style.borderColor = 'var(--coral)';
        isValid = false;
      }
    }

    if (field.type === 'tel' && value) {
      var phoneClean = value.replace(/[\s\-\(\)]/g, '');
      if (phoneClean.length < 10) {
        field.style.borderColor = 'var(--coral)';
        isValid = false;
      }
    }
  });

  // Check consent
  var consentBox = document.getElementById('consentCheckbox');
  if (consentBox && !consentBox.checked) {
    isValid = false;
  }

  return isValid;
}

// --- Save Consent to Supabase ---
async function saveConsent(order) {
  if (!db) return;
  try {
    await db.from('consents').insert({
      order_id: order.id,
      user_id: order.user_id || null,
      customer_email: order.customer.email,
      customer_name: order.customer.name,
      consent_type: 'checkout_checkbox',
      consent_text: 'Я согласен(на) с политикой обработки персональных данных и пользовательским соглашением',
      ip_address: null,
      granted_at: new Date().toISOString()
    });
  } catch(e) {
    console.error('Consent save error:', e);
  }
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

  // Перепроверяем stock перед оформлением
  _supabaseProducts = null;
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
  var subtotal = getCartTotal();
  var discountAmount = appliedPromo ? Math.round(subtotal * appliedPromo.discount) : 0;
  var subtotalAfterDiscount = subtotal - discountAmount;
  var deliveryPrice = getEffectiveDeliveryPrice(subtotal);
  var deliveryMethod = document.querySelector('input[name="delivery"]:checked').value;

  var city, address;
  if (deliveryMethod === 'self') {
    city = 'Самара';
    address = 'ул. Мориса Тореза 13А';
  } else if (deliveryMethod === 'courier') {
    city = 'Самара';
    address = form.querySelector('#address').value.trim();
  } else {
    city = form.querySelector('#city').value.trim();
    address = form.querySelector('#pickupAddress').value.trim();
  }

  var comment = (form.querySelector('#orderComment') || {}).value || '';

  var order = {
    id: 'LUMS-' + Date.now(),
    timestamp: new Date().toISOString(),
    user_id: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null,
    customer: {
      name: form.querySelector('#customerName').value.trim(),
      phone: form.querySelector('#customerPhone').value.trim(),
      email: form.querySelector('#customerEmail').value.trim(),
    },
    address: {
      city: city,
      address: address,
      apartment: '',
      postalCode: '',
    },
    delivery: {
      method: deliveryMethod,
      price: deliveryPrice,
    },
    promo: appliedPromo ? { code: appliedPromo.code, discount: appliedPromo.discount } : null,
    comment: comment.trim(),
    items: items.map(function(item) {
      return { id: item.id, name: item.name, price: item.price, qty: item.qty };
    }),
    subtotal: subtotal,
    discount: discountAmount,
    total: subtotalAfterDiscount + deliveryPrice,
    status: 'pending',
  };

  // Save to Supabase
  var result = await saveOrderToSupabase(order);

  if (!result.success) {
    showNotification('Ошибка при сохранении заказа. Попробуйте ещё раз.');
    return;
  }

  // Save consent record
  await saveConsent(order);

  // Уменьшаем stock
  await decreaseStock(order.items);

  // Send Telegram notification
  await sendTelegramNotification(order);

  // Send order confirmation email
  await sendOrderEmail(order);

  showNotification('Заказ успешно оформлен! Спасибо за покупку.');
  clearCart();

  setTimeout(function() {
    window.location.href = '/?order=success';
  }, 2000);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async function() {
  // Redirect to login if not authenticated
  initSupabase();
  if (db) {
    try {
      var { data: { session } } = await db.auth.getSession();
      if (!session || !session.user) {
        window.location.href = '../login/';
        return;
      }
    } catch(e) {
      // If Supabase fails (e.g. Safari blocking), allow checkout anyway
      console.warn('Auth check failed, proceeding:', e);
    }
  }

  await fetchAllProducts();
  await renderOrderSummary();

  // Listen for delivery method changes
  var deliveryRadios = document.querySelectorAll('input[name="delivery"]');
  deliveryRadios.forEach(function(radio) {
    radio.addEventListener('change', handleDeliveryChange);
  });

  // Apply initial delivery state
  handleDeliveryChange();

  // Auto-fill from profile if logged in
  if (typeof currentUser !== 'undefined' && currentUser) {
    var nameField = document.getElementById('customerName');
    var phoneField = document.getElementById('customerPhone');
    var emailField = document.getElementById('customerEmail');
    if (emailField && !emailField.value) emailField.value = currentUser.email || '';
    if (currentUser.profile) {
      if (nameField && !nameField.value) nameField.value = currentUser.profile.name || '';
      if (phoneField && !phoneField.value) phoneField.value = currentUser.profile.phone || '';
    }
  }

  // Consent checkbox
  var consentBox = document.getElementById('consentCheckbox');
  var submitBtn = document.getElementById('submitBtn');
  if (consentBox && submitBtn) {
    consentBox.addEventListener('change', function() {
      submitBtn.disabled = !consentBox.checked;
    });
  }

  // Form submit
  var form = document.getElementById('checkoutForm');
  if (form) {
    form.addEventListener('submit', handleCheckoutSubmit);
  }
});
