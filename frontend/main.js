/* ---------- tiny DOM helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- endpoints (nginx proxies these to the right services) ---------- */
const API = {
  customers: '/customers',
  products:  '/products',
  orders:    '/orders'
};

/* ---------- UI helpers ---------- */
const banner = $('#banner'); // optional top error/success alert area
function showBanner(msg, type = 'error') {
  if (!banner) return;
  banner.textContent = msg;
  banner.className = type === 'error'
    ? 'alert alert-danger'
    : 'alert alert-success';
  banner.style.display = 'block';
  setTimeout(() => (banner.style.display = 'none'), 6000);
}

/* Generic fetch helpers with nicer errors */
async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

  if (!res.ok) {
    const msg = data?.detail
      ? (Array.isArray(data.detail) ? data.detail.map(d => d.msg || d).join(', ')
                                    : (data.detail.message || data.detail))
      : text || `${res.status} ${res.statusText}`;
    throw new Error(`${res.status} ${res.statusText}: ${msg}`);
  }
  return data;
}

function jsonPost(url, body) {
  return jsonFetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
}

function jsonDelete(url) {
  return jsonFetch(url, { method: 'DELETE' });
}

function jsonPatch(url, body) {
  return jsonFetch(url, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  });
}

/* ---------- Customers ---------- */
async function loadCustomers() {
  const list = $('#customersList');
  if (list) list.innerHTML = '<em>Loading customers...</em>';
  try {
    const customers = await jsonFetch(`${API.customers}/`);
    if (!list) return;
    list.innerHTML = customers.length
      ? customers.map(renderCustomerCard).join('')
      : '<div>No customers yet.</div>';
  } catch (err) {
    if (list) list.innerHTML = '<div class="text-danger">Could not load customers.</div>';
    showBanner(`Failed to load customers: ${err.message}`);
  }
}

function renderCustomerCard(c) {
  return `
    <div class="card mb-2">
      <div class="card-body">
        <div class="fw-bold">${c.first_name ?? ''} ${c.last_name ?? ''} (ID: ${c.id})</div>
        <div class="small text-muted">${c.email ?? ''}</div>
        <div class="small">${c.phone_number ?? ''}</div>
        <div class="small">${c.shipping_address ?? ''}</div>
        <button class="btn btn-sm btn-outline-danger mt-2" onclick="deleteCustomer(${c.id})">Delete</button>
      </div>
    </div>
  `;
}

async function addCustomer() {
  try {
    const body = {
      email: $('#custEmail').value.trim(),
      password: $('#custPassword').value,
      first_name: $('#custFirst').value.trim(),
      last_name: $('#custLast').value.trim(),
      phone_number: $('#custPhone').value.trim(),
      shipping_address: $('#custAddress').value.trim()
    };
    await jsonPost(`${API.customers}/`, body);
    showBanner('Customer added', 'success');
    clearCustomerForm();
    loadCustomers();
  } catch (err) {
    showBanner(`Failed to add customer: ${err.message}`);
  }
}

async function deleteCustomer(id) {
  try {
    await jsonDelete(`${API.customers}/${id}`);
    showBanner('Customer deleted', 'success');
    loadCustomers();
  } catch (err) {
    showBanner(`Failed to delete customer: ${err.message}`);
  }
}

function clearCustomerForm() {
  ['custEmail','custPassword','custFirst','custLast','custPhone','custAddress']
    .forEach(id => { const el = $(`#${id}`); if (el) el.value=''; });
}

/* ---------- Products ---------- */
async function loadProducts() {
  const list = $('#productsList');
  if (list) list.innerHTML = '<em>Loading products...</em>';
  try {
    const products = await jsonFetch(`${API.products}/`);
    if (!list) return;
    list.innerHTML = products.length
      ? products.map(renderProductCard).join('')
      : '<div>No products yet.</div>';
  } catch (err) {
    if (list) list.innerHTML = '<div class="text-danger">Could not load products.</div>';
    showBanner(`Failed to load products: ${err.message}`);
  }
}

function renderProductCard(p) {
  const img = p.image_url ? `<img src="${p.image_url}" class="img-fluid mb-2" alt="${p.name}" />`
                          : `<div class="no-image">No Image</div>`;
  return `
    <div class="card mb-3">
      <div class="card-body">
        <h6 class="card-title mb-1">${p.name} <span class="text-muted">(ID: ${p.id})</span></h6>
        <div class="small text-muted mb-1">$${Number(p.price).toFixed(2)}</div>
        <div class="small mb-1">${p.description ?? ''}</div>
        <div class="small mb-2">Stock: ${p.stock_quantity}</div>
        ${img}
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-sm btn-outline-primary" onclick="addToCart(${p.id})">Add to Cart</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">Delete</button>
        </div>
      </div>
    </div>
  `;
}

/* -------------- IMPORTANT CHANGE --------------
   We only send `stock_quantity` (never `stock`).
   This avoids 422 when backend expects stock_quantity.
------------------------------------------------ */
async function addProduct() {
  const name  = $('#prodName').value.trim();
  const price = Number($('#prodPrice').value);
  const stock = Number($('#prodStock').value);
  const description = $('#prodDescription').value.trim();

  if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
    showBanner('Please fill Name, Price and Stock.');
    return;
  }

  try {
    const body = { name, price, stock_quantity: stock, description }; // <-- the fix
    await jsonPost(`${API.products}/`, body);
    showBanner('Product added', 'success');
    clearProductForm();
    loadProducts();
  } catch (err) {
    showBanner(`Failed to add product: ${err.message}`);
  }
}

async function deleteProduct(id) {
  try {
    await jsonDelete(`${API.products}/${id}`);
    showBanner('Product deleted', 'success');
    loadProducts();
  } catch (err) {
    showBanner(`Failed to delete product: ${err.message}`);
  }
}

function clearProductForm() {
  ['prodName','prodPrice','prodStock','prodDescription']
    .forEach(id => { const el = $(`#${id}`); if (el) el.value=''; });
}

/* ---------- Cart + Orders (simple version) ---------- */
const cart = []; // [{product_id, name, price, qty}]

function addToCart(productId) {
  const existing = cart.find(c => c.product_id === productId);
  if (existing) existing.qty += 1;
  else cart.push({ product_id: productId, qty: 1 });
  renderCart();
}

function renderCart() {
  const ctn = $('#cartItems');
  const totalEl = $('#cartTotal');
  if (!ctn || !totalEl) return;

  if (!cart.length) {
    ctn.innerHTML = '<div>Your cart is empty.</div>';
    totalEl.textContent = '$0.00';
    return;
  }
  const items = cart.map(i => `<div>Product ${i.product_id} (x${i.qty})</div>`).join('');
  ctn.innerHTML = items;
  // if you want real totals, you’d calculate from products list
  totalEl.textContent = '$0.00';
}

async function placeOrder() {
  const userId = Number($('#orderUserId').value);
  const shipping = $('#orderAddress').value.trim();

  if (!userId || !shipping || cart.length === 0) {
    showBanner('Please add items to cart and fill Customer ID & Address.');
    return;
  }

  try {
    const items = cart.map(i => ({ product_id: i.product_id, quantity: i.qty }));
    const body = { customer_id: userId, shipping_address: shipping, items };
    await jsonPost(`${API.orders}/`, body);
    cart.length = 0;
    renderCart();
    showBanner('Order placed', 'success');
    loadOrders();
  } catch (err) {
    showBanner(`Failed to place order: ${err.message}`);
  }
}

async function loadOrders() {
  const box = $('#ordersList');
  if (box) box.innerHTML = '<em>Loading orders...</em>';
  try {
    const orders = await jsonFetch(`${API.orders}/`);
    if (!box) return;
    box.innerHTML = orders.length
      ? orders.map(renderOrderCard).join('')
      : '<div>No orders yet.</div>';
  } catch (err) {
    if (box) box.innerHTML = '<div class="text-danger">Could not load orders.</div>';
    showBanner(`Failed to load orders: ${err.message}`);
  }
}

function renderOrderCard(o) {
  const items = (o.items ?? []).map(it =>
    `<div class="small">Product ID: ${it.product_id} &times; ${it.quantity}</div>`
  ).join('');
  return `
    <div class="card mb-2">
      <div class="card-body">
        <div class="fw-bold">Order ID: ${o.id}</div>
        <div class="small text-muted">Customer: ${o.customer_id}</div>
        <div class="small">Status: ${o.status}</div>
        <div class="small">Address: ${o.shipping_address ?? ''}</div>
        ${items}
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="updateOrderStatus(${o.id}, 'confirmed')">Confirm</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder(${o.id})">Delete</button>
        </div>
      </div>
    </div>
  `;
}

async function updateOrderStatus(id, status) {
  try {
    await jsonPatch(`${API.orders}/${id}`, { status });
    showBanner('Order updated', 'success');
    loadOrders();
  } catch (err) {
    showBanner(`Failed to update order: ${err.message}`);
  }
}

async function deleteOrder(id) {
  try {
    await jsonDelete(`${API.orders}/${id}`);
    showBanner('Order deleted', 'success');
    loadOrders();
  } catch (err) {
    showBanner(`Failed to delete order: ${err.message}`);
  }
}

/* ---------- Wire up UI ---------- */
function wireEvents() {
  $('#btnAddCustomer')?.addEventListener('click', addCustomer);
  $('#btnAddProduct')?.addEventListener('click', addProduct);
  $('#btnPlaceOrder')?.addEventListener('click', placeOrder);
}

/* ---------- Bootstrap ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  wireEvents();
  await Promise.all([loadCustomers(), loadProducts(), loadOrders()]);
  renderCart();
});

/* expose for inline handlers */
window.deleteCustomer = deleteCustomer;
window.deleteProduct = deleteProduct;
window.addToCart = addToCart;
window.placeOrder = placeOrder;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
