/* ===== ЛЮМС — Cart JS ===== */

function getCart() {
  return JSON.parse(localStorage.getItem('lums_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('lums_cart', JSON.stringify(cart));
  updateCartCount();
}

function addToCart(productId, qty) {
  if (typeof qty === 'undefined') qty = 1;
  var product = getProductById(productId);
  if (!product) return;

  var cart = getCart();
  var existing = cart.find(function(item) { return item.id === productId; });
  var currentQty = existing ? existing.qty : 0;
  var stock = product.stock || 0;

  // Если товар в наличии — проверяем лимит
  if (stock > 0) {
    if (currentQty >= stock) {
      showNotification('Максимальное количество «' + product.name + '» уже в корзине (' + stock + ' шт.)');
      return;
    }
    if (currentQty + qty > stock) {
      qty = stock - currentQty;
    }
  }
  // Если stock === 0 — товар "под заказ", можно добавить без лимита

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty: qty });
  }

  saveCart(cart);
  showNotification(product.name + ' — добавлен в корзину');
}

function removeFromCart(productId) {
  var cart = getCart();
  cart = cart.filter(function(item) { return item.id !== productId; });
  saveCart(cart);
  if (typeof renderCart === 'function') renderCart();
}

function updateCartItemQty(productId, newQty) {
  var cart = getCart();
  var item = cart.find(function(i) { return i.id === productId; });
  if (!item) return;

  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }

  // Проверяем stock
  var product = getProductById(productId);
  var stock = (product && product.stock) || 0;
  if (stock > 0 && newQty > stock) {
    showNotification('Доступно только ' + stock + ' шт.');
    newQty = stock;
  }

  item.qty = newQty;
  saveCart(cart);
  if (typeof renderCart === 'function') renderCart();
}

function getCartTotal() {
  var cart = getCart();
  return cart.reduce(function(sum, item) {
    var product = getProductById(item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
}

function getCartItems() {
  var cart = getCart();
  return cart.map(function(item) {
    var product = getProductById(item.id);
    return product ? Object.assign({}, product, { qty: item.qty }) : null;
  }).filter(Boolean);
}

function clearCart() {
  localStorage.removeItem('lums_cart');
  updateCartCount();
}
