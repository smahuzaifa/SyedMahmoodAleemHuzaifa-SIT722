/* ==============================
   Config – tweak only if needed
   ============================== */
const ENDPOINTS = {
  products: {
    base: '/api/products',             // proxy to product-service
    list: '/products/',                // GET
    create: '/products/',              // POST  JSON {name, price, stock, description}
    remove: (id) => `/products/${id}/`,// DELETE
    upload: (id) => `/products/${id}/upload-image/` // POST multipart (file)
  },
  orders: {
    base: '/api/orders',               // proxy to order-service
    list: '/orders/',                  // GET
    create: '/orders/',                // POST JSON {customer_id, items, shipping_address}
    remove: (id) => `/orders/${id}/`,  // DELETE
    status: (id) => `/orders/${id}/status/` // PUT JSON {status}
  }
};

/* ==============================
   Helpers
   ============================== */
const msgBox = document.getElementById('message-box');

function showMessage(type, text) {
  msgBox.className = `message-box ${type}`;
  msgBox.textContent = text;
  msgBox.style.display = 'block';
  clearTimeout(showMessage._t);
  showMessage._t = setTimeout(() => (msgBox.style.display = 'none'), 5000);
}

async function http(method, url, body, isForm = false) {
  const opts = { method, headers: {} };
  if (body && !isForm) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isForm) {
    opts.body = body; // FormData
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

/* ==============================
   Product UI
   ============================== */
const productListEl = document.getElementById('product-list');
const productForm = document.getElementById('product-form');

async function loadProducts() {
  try {
    const products = await http('GET', ENDPOINTS.products.base + ENDPOINTS.products.list);
    renderProducts(Array.isArray(products) ? products : []);
  } catch (e) {
    productListEl.innerHTML = `<p>Failed to load products: ${e.message}</p>`;
  }
}

function renderProducts(products) {
  if (!products.length) {
    productListEl.innerHTML = `<p>No products yet.</p>`;
    return;
  }

  productListEl.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const title = document.createElement('h3');
    title.textContent = `${p.name} (ID: ${p.id ?? p.product_id ?? ''})`;
    card.appendChild(title);

    const img = document.createElement('img');
    img.alt = 'Product Image';
    img.src = p.image_url || p.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="100%" height="100%" fill="%23e8f0f8"/><text x="50%" y="50%" dy=".3em" text-anchor="middle" fill="%23666" font-family="Segoe UI" font-size="24">No Image</text></svg>';
    card.appendChild(img);

    const price = document.createElement('p');
    price.className = 'price';
    price.textContent = `$${Number(p.price).toFixed(2)}`;
    card.appendChild(price);

    const stock = document.createElement('p');
    stock.className = 'stock';
    stock.textContent = `Stock: ${p.stock ?? p.stock_quantity ?? 0}`;
    card.appendChild(stock);

    const desc = document.createElement('p');
    desc.textContent = (p.description || '').toString();
    card.appendChild(desc);

    // Upload group
    const upWrap = document.createElement('div');
    upWrap.className = 'upload-image-group';
    const file = document.createElement('input');
    file.type = 'file';
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = 'Upload Photo';
    upBtn.onclick = async () => {
      if (!file.files?.length) return showMessage('info', 'Choose an image first.');
      const id = p.id ?? p.product_id;
      const fd = new FormData();
      fd.append('file', file.files[0]);
      try {
        await http('POST', ENDPOINTS.products.base + ENDPOINTS.products.upload(id), fd, true);
        showMessage('success', 'Image uploaded.');
        await loadProducts();
      } catch (e) { showMessage('error', `Upload failed: ${e.message}`); }
    };
    upWrap.append(file, upBtn);
    card.appendChild(upWrap);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-cart-btn';
    addBtn.type = 'button';
    addBtn.textContent = 'Add to Cart';
    addBtn.onclick = () => addToCart({ id: p.id ?? p.product_id, name: p.name, price: Number(p.price) });

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.onclick = async () => {
      const id = p.id ?? p.product_id;
      if (!confirm('Delete this product?')) return;
      try {
        await http('DELETE', ENDPOINTS.products.base + ENDPOINTS.products.remove(id));
        showMessage('success', 'Product deleted.');
        await loadProducts();
      } catch (e) { showMessage('error', `Delete failed: ${e.message}`); }
    };

    actions.append(addBtn, delBtn);
    card.appendChild(actions);

    productListEl.appendChild(card);
  });
}

productForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const payload = {
    name: document.getElementById('product-name').value.trim(),
    price: Number(document.getElementById('product-price').value),
    stock: Number(document.getElementById('product-stock').value),
    description: document.getElementById('product-description').value.trim()
  };
  try {
    await http('POST', ENDPOINTS.products.base + ENDPOINTS.products.create, payload);
    showMessage('success', 'Product added.');
    productForm.reset();
    await loadProducts();
  } catch (e) { showMessage('error', `Add failed: ${e.message}`); }
});

/* ==============================
   Cart + Orders
   ============================== */
let cart = [];

const cartEl = document.getElementById('cart-items');
const totalEl = document.getElementById('cart-total');
const orderForm = document.getElementById('place-order-form');

function addToCart(p) {
  const found = cart.find(i => i.id === p.id);
  if (found) found.qty += 1;
  else cart.push({ ...p, qty: 1 });
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
}

function renderCart() {
  if (!cart.length) {
    cartEl.innerHTML = '<li>Your cart is empty.</li>';
    totalEl.textContent = 'Total: $0.00';
    return;
  }
  cartEl.innerHTML = '';
  let total = 0;
  cart.forEach(i => {
    total += i.qty * i.price;
    const li = document.createElement('li');
    li.textContent = `${i.name} (x${i.qty})`;
    const rm = document.createElement('button');
    rm.textContent = 'Remove';
    rm.onclick = () => removeFromCart(i.id);
    li.appendChild(rm);
    cartEl.appendChild(li);
  });
  totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

orderForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!cart.length) return showMessage('info', 'Add items to cart first.');
  const customerId = Number(document.getElementById('order-user-id').value);
  const shipping = document.getElementById('shipping-address').value.trim();

  // Map cart -> order items shape expected by your service
  const items = cart.map(i => ({ product_id: i.id, quantity: i.qty }));

  const payload = { customer_id: customerId, items, shipping_address: shipping };
  try {
    await http('POST', ENDPOINTS.orders.base + ENDPOINTS.orders.create, payload);
    showMessage('success', 'Order placed.');
    cart = [];
    renderCart();
    orderForm.reset();
    document.getElementById('order-user-id').value = 1;
    await loadOrders();
  } catch (e) { showMessage('error', `Place order failed: ${e.message}`); }
});

/* ==============================
   Order UI
   ============================== */
const orderListEl = document.getElementById('order-list');

async function loadOrders() {
  try {
    const orders = await http('GET', ENDPOINTS.orders.base + ENDPOINTS.orders.list);
    renderOrders(Array.isArray(orders) ? orders : []);
  } catch (e) {
    orderListEl.innerHTML = `<p>Failed to load orders: ${e.message}</p>`;
  }
}

function renderOrders(orders) {
  if (!orders.length) {
    orderListEl.innerHTML = '<p>No orders yet.</p>';
    return;
  }
  orderListEl.innerHTML = '';
  orders.forEach(o => {
    const id = o.id ?? o.order_id;
    const card = document.createElement('div');
    card.className = 'order-card';

    const h = document.createElement('h3');
    h.textContent = `Order ID: ${id}`;
    card.appendChild(h);

    const meta = document.createElement('p');
    meta.innerHTML = `User ID: <strong>${o.customer_id ?? o.user_id ?? ''}</strong><br>
      Status: <strong>${o.status ?? 'unknown'}</strong><br>
      Total Amount: <strong>$${Number(o.total_amount ?? o.total ?? 0).toFixed(2)}</strong><br>
      Shipping Address: ${o.shipping_address ?? ''}`;
    card.appendChild(meta);

    const ul = document.createElement('ul');
    ul.className = 'order-items';
    (o.items || []).forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `Product <span>ID: ${it.product_id}</span> — Qty: ${it.quantity} @ $${Number(it.price ?? 0).toFixed(2)}`;
      ul.appendChild(li);
    });
    card.appendChild(ul);

    // status selector
    const sWrap = document.createElement('div');
    sWrap.className = 'status-selector';
    const sel = document.createElement('select');
    ['pending','confirmed','shipped','delivered','cancelled'].forEach(s=>{
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s.charAt(0).toUpperCase()+s.slice(1);
      if ((o.status||'').toLowerCase() === s) opt.selected = true;
      sel.appendChild(opt);
    });
    const upd = document.createElement('button');
    upd.className='status-update-btn';
    upd.textContent='Update Status';
    upd.onclick = async () => {
      try {
        await http('PUT', ENDPOINTS.orders.base + ENDPOINTS.orders.status(id), { status: sel.value });
        showMessage('success','Status updated.');
        await loadOrders();
      } catch (e) { showMessage('error', `Update failed: ${e.message}`); }
    };
    sWrap.append(sel, upd);
    card.appendChild(sWrap);

    // actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const del = document.createElement('button');
    del.className='delete-btn';
    del.textContent='Delete Order';
    del.onclick = async () => {
      if (!confirm('Delete this order?')) return;
      try {
        await http('DELETE', ENDPOINTS.orders.base + ENDPOINTS.orders.remove(id));
        showMessage('success', 'Order deleted.');
        await loadOrders();
      } catch (e) { showMessage('error', `Delete failed: ${e.message}`); }
    };
    actions.appendChild(del);
    card.appendChild(actions);

    orderListEl.appendChild(card);
  });
}

/* ==============================
   Init
   ============================== */
(async function init(){
  await Promise.all([loadProducts(), loadOrders()]);
})();
