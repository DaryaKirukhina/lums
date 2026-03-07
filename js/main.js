/* ===== ЛЮМС — Main JS ===== */

// --- Products Database ---
const PRODUCTS = [
  { id: 1, name: 'Ванильная мечта', aroma: 'Ваниль, карамель', price: 1290, category: 'aromatic', badge: 'hit', placeholder: 'p1', description: 'Тёплый, обволакивающий аромат натуральной ванили с нотками карамели. Идеальна для уютных вечеров дома.', composition: 'Соевый воск, хлопковый фитиль, ароматическое масло ванили', weight: '200 г', burnTime: '35-40 часов' },
  { id: 2, name: 'Лесная хвоя', aroma: 'Сосна, кедр, мох', price: 1490, category: 'aromatic', badge: 'new', placeholder: 'p2', description: 'Свежий аромат хвойного леса после дождя. Наполнит дом ощущением природы и спокойствия.', composition: 'Соевый воск, деревянный фитиль, эфирные масла сосны и кедра', weight: '250 г', burnTime: '40-45 часов' },
  { id: 3, name: 'Лаванда Прованса', aroma: 'Лаванда, бергамот', price: 1190, category: 'aromatic', badge: 'eco', placeholder: 'p3', description: 'Успокаивающий аромат лавандовых полей Прованса с лёгкими цитрусовыми нотками бергамота.', composition: 'Соевый воск, хлопковый фитиль, эфирное масло лаванды', weight: '180 г', burnTime: '30-35 часов' },
  { id: 4, name: 'Цитрусовый заряд', aroma: 'Апельсин, лимон, грейпфрут', price: 990, category: 'aromatic', badge: null, placeholder: 'p4', description: 'Бодрящий микс цитрусовых ароматов. Заряжает энергией и поднимает настроение.', composition: 'Соевый воск, хлопковый фитиль, эфирные масла цитрусовых', weight: '160 г', burnTime: '25-30 часов' },
  { id: 5, name: 'Роза и пион', aroma: 'Роза, пион, жасмин', price: 1590, category: 'decorative', badge: 'hit', placeholder: 'p5', description: 'Роскошный цветочный аромат в декоративной форме розы. Станет украшением любого интерьера.', composition: 'Соевый воск, хлопковый фитиль, парфюмерная композиция', weight: '220 г', burnTime: '35-40 часов' },
  { id: 6, name: 'Медитация', aroma: 'Сандал, пачули, ладан', price: 1390, category: 'interior', badge: 'new', placeholder: 'p6', description: 'Глубокий восточный аромат для медитации и релаксации. Помогает сконцентрироваться и найти гармонию.', composition: 'Соевый воск, деревянный фитиль, эфирные масла сандала и пачули', weight: '200 г', burnTime: '35-40 часов' },
  { id: 7, name: 'Подарочный набор «Уют»', aroma: 'Ваниль, лаванда, сандал', price: 3490, category: 'gift', badge: 'hit', placeholder: 'p7', description: 'Набор из трёх мини-свечей в подарочной упаковке. Идеальный подарок для любого повода.', composition: '3 мини-свечи по 80 г, подарочная коробка', weight: '240 г (3×80 г)', burnTime: '15-20 часов каждая' },
  { id: 8, name: 'Морской бриз', aroma: 'Морская соль, озон, кокос', price: 1290, category: 'seasonal', badge: 'eco', placeholder: 'p8', description: 'Свежий морской аромат с нотками кокоса. Создаёт атмосферу летнего отдыха на побережье.', composition: 'Соевый воск, хлопковый фитиль, ароматическая композиция', weight: '200 г', burnTime: '35-40 часов' },
];

// Кэш товаров из Supabase (заполняется при первом запросе)
var _supabaseProducts = null;

async function fetchAllProducts() {
  if (_supabaseProducts) return _supabaseProducts;
  initSupabase();
  if (db) {
    try {
      const { data, error } = await db.from('products').select('*').order('id');
      if (!error && data) {
        _supabaseProducts = data;
        return data;
      }
    } catch(e) { console.error(e); }
  }
  return PRODUCTS;
}

function getProductById(id) {
  var pid = parseInt(id);
  if (_supabaseProducts) {
    var found = _supabaseProducts.find(p => p.id === pid);
    if (found) return found;
  }
  return PRODUCTS.find(p => p.id === pid);
}

function formatPrice(price) {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
}

// --- Header Scroll ---
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// --- Burger Menu ---
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
if (burger && nav) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('active');
    nav.classList.toggle('open');
    document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('active');
      nav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// --- Cookie Banner ---
function acceptCookies() {
  localStorage.setItem('lums_cookies', 'accepted');
  hideCookieBanner();
}

function declineCookies() {
  localStorage.setItem('lums_cookies', 'declined');
  hideCookieBanner();
}

function hideCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (banner) banner.classList.remove('show');
}

function checkCookieBanner() {
  const consent = localStorage.getItem('lums_cookies');
  if (!consent) {
    const banner = document.getElementById('cookieBanner');
    if (banner) {
      setTimeout(() => banner.classList.add('show'), 1000);
    }
  }
}

// --- Notification ---
function showNotification(message, type = '') {
  const el = document.getElementById('notification');
  if (!el) return;
  el.textContent = message;
  el.className = 'notification show' + (type ? ' ' + type : '');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// --- Cart Count ---
function updateCartCount() {
  const countEl = document.getElementById('cartCount');
  if (!countEl) return;
  const cart = JSON.parse(localStorage.getItem('lums_cart') || '[]');
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = total;
  countEl.style.display = total > 0 ? 'flex' : 'none';
}

// --- Scroll Reveal Animation ---
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  // Only hide elements below the fold, leave visible ones alone
  elements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight) {
      el.classList.add('reveal-hidden');
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => {
    if (el.classList.contains('reveal-hidden')) {
      observer.observe(el);
    }
  });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  checkCookieBanner();
  updateCartCount();
  initScrollReveal();
  // Preload products from Supabase so getProductById works for cart
  await fetchAllProducts();
});
