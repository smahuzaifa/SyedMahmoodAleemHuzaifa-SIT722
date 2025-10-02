// ----- tiny helper to show errors on the page -----
function showError(msg) {
  const el = document.getElementById('global-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  } else {
    console.error(msg);
  }
}

// ----- API root paths (proxied by Nginx to the services) -----
const API = {
  customers: '/api/customers/',
  products:  '/api/products/',
  orders:    '/api/orders/'
};

// Fetch JSON with a guard against accidental HTML responses
async function getJson(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const text = await res.text();                  // read once
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Non-JSON from ${url}: ${text.slice(0, 160)}…`);
  }
}

// Turn possible object-wrapped payloads into arrays
function asArray(x, key) {
  if (Array.isArray(x)) return x;
  if (x && key && Array.isArray(x[key])) return x[key];
  return [];
}

// ---------- Render helpers (very simple placeholders) ----------
function renderCustomers(customers) {
  const list = document.getElementById('customers-list');
  if (!list) return;
  list.innerHTML = customers.map(c =>
    `<li>#${c.id} — ${c.email} (${c.first_name || ''} ${c.last_name || ''})</li>`
  ).join('') || '<li>No customers</li>';
}

function renderProducts(products) {
  const list = document.getElementById('products-list');
  if (!list) return;
  list.innerHTML = products.map(p =>
    `<li>#${p.id} — ${p.name} ($${p.price}) stock:${p.stock_quantity}</li>`
  ).join('') || '<li>No products</li>';
}

function renderOrders(orders) {
  const list = document.getElementById('orders-list');
  if (!list) return;
  list.innerHTML = orders.map(o =>
    `<li>#${o.id} — customer:${o.customer_id} total:$${o.total_amount || 0}</li>`
  ).join('') || '<li>No orders</li>';
}

// ---------- Initial loads ----------
(async () => {
  try {
    const data = await getJson(API.customers);
    renderCustomers(asArray(data, 'customers'));
  } catch (e) {
    showError(`Failed to load customers: ${e.message}`);
  }
})();

(async () => {
  try {
    const data = await getJson(API.products);
    renderProducts(asArray(data, 'products'));
  } catch (e) {
    showError(`Failed to load products: ${e.message}`);
  }
})();

(async () => {
  try {
    const data = await getJson(API.orders);
    renderOrders(asArray(data, 'orders'));
  } catch (e) {
    showError(`Failed to load orders: ${e.message}`);
  }
})();

// ---------- Form handlers (hooks expect elements with these IDs) ----------
async function postJson(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json().catch(() => ({}));
}

document.getElementById('add-customer-btn')?.addEventListener('click', async () => {
  try {
    const payload = {
      email:       document.getElementById('cust-email')?.value || '',
      password:    document.getElementById('cust-password')?.value || '',
      first_name:  document.getElementById('cust-first')?.value || '',
      last_name:   document.getElementById('cust-last')?.value || '',
      phone:       document.getElementById('cust-phone')?.value || '',
      address:     document.getElementById('cust-address')?.value || ''
    };
    await postJson(API.customers, payload);
    const data = await getJson(API.customers);
    renderCustomers(asArray(data, 'customers'));
  } catch (e) {
    showError(`Failed to add customer: ${e.message}`);
  }
});

document.getElementById('add-product-btn')?.addEventListener('click', async () => {
  try {
    const payload = {
      name:            document.getElementById('prod-name')?.value || '',
      description:     document.getElementById('prod-desc')?.value || '',
      price:           parseFloat(document.getElementById('prod-price')?.value || '0'),
      stock_quantity:  parseInt(document.getElementById('prod-stock')?.value || '0', 10)
    };
    await postJson(API.products, payload);
    const data = await getJson(API.products);
    renderProducts(asArray(data, 'products'));
  } catch (e) {
    showError(`Failed to add product: ${e.message}`);
  }
});

document.getElementById('place-order-btn')?.addEventListener('click', async () => {
  try {
    const payload = {
      customer_id:    parseInt(document.getElementById('order-customer-id')?.value || '0', 10),
      shipping_addr:  document.getElementById('order-ship')?.value || '',
      // you may add items/cart lines if your backend expects them
    };
    await postJson(API.orders, payload);
    const data = await getJson(API.orders);
    renderOrders(asArray(data, 'orders'));
  } catch (e) {
    showError(`Failed to place order: ${e.message}`);
  }
});
