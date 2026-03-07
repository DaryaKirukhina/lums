/* ===== ЛЮМС — Catalog JS ===== */

(function () {
  const BADGE_LABELS = {
    hit: 'Хит',
    new: 'Новинка',
    eco: 'Эко'
  };

  const grid = document.getElementById('productsGrid');
  const priceRange = document.getElementById('priceRange');
  const priceRangeValue = document.getElementById('priceRangeValue');
  const categoryCheckboxes = document.querySelectorAll('input[name="category"]');

  if (!grid) return;

  let catalogProducts = [];

  function getInitialCategory() {
    const params = new URLSearchParams(window.location.search);
    return params.get('category');
  }

  function applyUrlFilter() {
    const cat = getInitialCategory();
    if (cat) {
      categoryCheckboxes.forEach(cb => {
        if (cb.value === cat) cb.checked = true;
      });
    }
  }

  function getSelectedCategories() {
    const selected = [];
    categoryCheckboxes.forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });
    return selected;
  }

  function getMaxPrice() {
    return parseInt(priceRange.value, 10);
  }

  function filterProducts() {
    const categories = getSelectedCategories();
    const maxPrice = getMaxPrice();
    return catalogProducts.filter(p => {
      const matchCat = categories.length === 0 || categories.includes(p.category);
      const matchPrice = p.price <= maxPrice;
      return matchCat && matchPrice;
    });
  }

  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', product.id);

    let badgeHTML = '';
    if (product.badge) {
      badgeHTML = `<span class="product-badge ${product.badge}">${BADGE_LABELS[product.badge] || ''}</span>`;
    }

    // Use real image if available, otherwise placeholder
    const imageUrl = product.image_url || product.imageUrl;
    let imageHTML;
    if (imageUrl) {
      imageHTML = `<img src="${imageUrl}" alt="${product.name}">`;
    } else {
      const placeholderClass = product.placeholder || ('p' + ((product.id % 8) + 1));
      imageHTML = `<div class="placeholder ${placeholderClass}">🕯️</div>`;
    }

    card.innerHTML = `
      <div class="product-card-image">
        ${badgeHTML}
        ${imageHTML}
        <button class="product-card-add" onclick="addToCart(${product.id})" aria-label="Добавить в корзину">+</button>
      </div>
      <a href="product.html?id=${product.id}" class="product-card-info">
        <h4>${product.name}</h4>
        <p class="product-aroma">${product.aroma || ''}</p>
        <p class="product-price">${formatPrice(product.price)}</p>
      </a>
    `;
    return card;
  }

  function render() {
    const products = filterProducts();
    grid.innerHTML = '';
    if (products.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--gray);padding:40px 0;">Товары не найдены. Попробуйте изменить фильтры.</p>';
      return;
    }
    products.forEach(p => grid.appendChild(createProductCard(p)));
  }

  function updatePriceLabel() {
    if (priceRangeValue) {
      priceRangeValue.textContent = formatPrice(getMaxPrice());
    }
  }

  categoryCheckboxes.forEach(cb => cb.addEventListener('change', render));
  if (priceRange) {
    priceRange.addEventListener('input', () => { updatePriceLabel(); render(); });
  }

  // --- Init: load from Supabase, fallback to PRODUCTS ---
  async function init() {
    applyUrlFilter();
    updatePriceLabel();

    initSupabase();
    if (db) {
      try {
        const { data, error } = await db.from('products').select('*').order('id');
        if (!error && data) {
          catalogProducts = data;
          render();
          return;
        }
      } catch (e) {
        console.error('Catalog: Supabase error', e);
      }
    }
    // Fallback
    catalogProducts = PRODUCTS;
    render();
  }

  init();
})();
