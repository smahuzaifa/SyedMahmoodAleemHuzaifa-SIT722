(() => {
  // ------------ Config (kept identical to your routing) -------------
  const CUSTOMER_API = '/customers/';
  const PRODUCT_API  = '/products/';
  const ORDER_API    = '/orders/';

  // ------------ DOM -------------
  const messageBox = document.getElementById('messageBox');

  const customerForm  = document.getElementById('customerForm');
  const customersList = document.getElementById('customersList');

  const productForm   = document.getElementById('productForm');
  const productsList  = document.getElementById('productsList');

  const orderForm     = document.getElementById('orderForm');
  const cartList      = document.getElementById('cartList');
  const orderCustomerId = document.getElementById('orderCustomerId');
  const orderAddress    = document.getElementById('orderAddress');

  // ------------ Utilities -------------
  function showMessage(msg, type = 'info') {
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => { messageBox.style.display = 'none'; }, 5000);
  }

  async function safeJson(resp) {
    // Be defensive: try JSON; fallback to text (helpful for HTML error pages)
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await resp.json();
    }
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return { _raw: text }; }
  }

  function ensureArray(val) {
    return Array.isArray(val) ? val : [];
  }

  const fmt = n => `$${Number(n).toFixed(2)}`;

  // ------------ Cart -------------
  let cart = []; // {product_id, name, price, qty}

  function renderCart() {
    if (!cart.length) {
      cartList.innerHTML = '<div class="muted">Your cart is empty.</div>';
      return;
    }
    cartList.innerHTML = cart.map(item => `
      <div class="list-item">
        <div>${item.name} &times; ${item.qty} <span class="muted">(${fmt(item.price)} each)</span></div>
        <button data-id="${item.product_id}" class="remove-cart primary" style="background:#6b7280">Remove</button>
      </div>
    `).join('');
  }

  cartList.addEventListener('click', e => {
    if (e.target.classList.contains('remove-cart')) {
      const id = Number(e.target.dataset.id);
      cart = cart.filter(x => x.product_id !== id);
      renderCart();
    }
  });

  // ------------ Customers -------------
  async function loadCustomers() {
    customersList.innerHTML = '<div class="muted">Loading customers…</div>';
    try {
      const resp = await fetch(CUSTOMER_API, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`GET /customers failed: ${resp.status}`);
      const data = await safeJson(resp);
      const list = ensureArray(data);
      if (!list.length) {
        customersList.innerHTML = '<div class="muted">No customers yet.</div>';
        return;
      }
      customersList.innerHTML = list.map(c => `
        <div class="list-item">
          <div>
            <strong>${c.first_name ?? ''} ${c.last_name ?? ''}</strong>
            <div class="muted">ID: ${c.customer_id} • ${c.email}</div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      customersList.innerHTML = '<div class="muted">Could not load customers. Please check the Customer Service.</div>';
      showMessage(`Failed to load customers: ${err.message}`, 'err');
    }
  }

  customerForm.addEventListener('submit', async e => {
    e.preventDefault(); // stop page reload
    const email     = document.getElementById('custEmail').value.trim();
    const password  = document.getElementById('custPassword').value;
    const firstName = document.getElementById('custFirstName').value.trim();
    const lastName  = document.getElementById('custLastName').value.trim();
    const phone     = document.getElementById('custPhone').value.trim();
    const address   = document.getElementById('custAddress').value.trim();

    if (!email || !password) {
      showMessage('Email and password are required.', 'warn');
      return;
    }

    try {
      const resp = await fetch(CUSTOMER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          email, password,
          first_name: firstName || null,
          last_name:  lastName  || null,
          phone_number: phone || null,
          shipping_address: address || null
        })
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.detail || data?._raw || `POST /customers failed (${resp.status})`);
      showMessage('Customer added successfully.', 'ok');
      customerForm.reset();
      await loadCustomers();
    } catch (err) {
      console.error(err);
      showMessage(`Failed to add customer: ${err.message}`, 'err');
    }
  });

  // ------------ Products -------------
  async function loadProducts() {
    productsList.innerHTML = '<div class="muted">Loading products…</div>';
    try {
      const resp = await fetch(PRODUCT_API, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`GET /products failed: ${resp.status}`);
      const data = await safeJson(resp);
      const list = ensureArray(data);
      if (!list.length) {
        productsList.innerHTML = '<div class="muted">No products yet.</div>';
        return;
      }
      productsList.innerHTML = list.map(p => `
        <div class="list-item">
          <div>
            <strong>${p.name}</strong> <span class="muted">ID: ${p.product_id}</span><br/>
            <span class="muted">${p.description ?? ''}</span>
            <div class="muted">Price: ${fmt(p.price)} • Stock: ${p.stock_quantity}</div>
          </div>
          <div>
            <button class="add-cart primary" data-id="${p.product_id}" data-name="${p.name}" data-price="${p.price}">Add to Cart</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      productsList.innerHTML = '<div class="muted">Could not load products. Please check the Product Service.</div>';
      showMessage(`Failed to load products: ${err.message}`, 'err');
    }
  }

  productForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name  = document.getElementById('prodName').value.trim();
    const price = Number(document.getElementById('prodPrice').value);
    const stock = Number(document.getElementById('prodStock').value);
    const desc  = document.getElementById('prodDesc').value.trim();

    if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
      showMessage('Please fill product name, price and stock.', 'warn');
      return;
    }

    try {
      const resp = await fetch(PRODUCT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name, price, stock_quantity: stock,
          description: desc || null
        })
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.detail || data?._raw || `POST /products failed (${resp.status})`);
      showMessage('Product added successfully.', 'ok');
      productForm.reset();
      await loadProducts();
    } catch (err) {
      console.error(err);
      showMessage(`Failed to add product: ${err.message}`, 'err');
    }
  });

  productsList.addEventListener('click', e => {
    if (e.target.classList.contains('add-cart')) {
      const id = Number(e.target.dataset.id);
      const name = e.target.dataset.name;
      const price = Number(e.target.dataset.price);
      const existing = cart.find(x => x.product_id === id);
      if (existing) existing.qty += 1;
      else cart.push({ product_id:id, name, price, qty:1 });
      renderCart();
      showMessage(`Added "${name}" to cart.`, 'ok');
    }
  });

  // ------------ Orders -------------
  async function loadOrders() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '<div class="muted">Loading orders…</div>';
    try {
      const resp = await fetch(ORDER_API, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`GET /orders failed: ${resp.status}`);
      const data = await safeJson(resp);
      const list = ensureArray(data);
      if (!list.length) {
        ordersList.innerHTML = '<div class="muted">No orders yet.</div>';
        return;
      }
      ordersList.innerHTML = list.map(o => `
        <div class="list-item">
          <div>
            <strong>Order #${o.order_id}</strong> — <span class="muted">Customer ${o.customer_id}</span><br/>
            <span class="muted">Total: ${fmt(o.total_price)} • ${new Date(o.created_at).toLocaleString()}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      document.getElementById('ordersList').innerHTML =
        '<div class="muted">Could not load orders. Please check the Order Service.</div>';
      showMessage(`Failed to load orders: ${err.message}`, 'err');
    }
  }

  orderForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!cart.length) {
      showMessage('Your cart is empty.', 'warn');
      return;
    }
    const customer_id = Number(orderCustomerId.value);
    const shipping_address = orderAddress.value.trim();
    if (!customer_id || !shipping_address) {
      showMessage('Customer ID and shipping address are required.', 'warn');
      return;
    }

    // Convert to {product_id, quantity}
    const items = cart.map(x => ({ product_id: x.product_id, quantity: x.qty }));

    try {
      const resp = await fetch(ORDER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ customer_id, shipping_address, items })
      });
      const data = await safeJson(resp);
      if (!resp.ok) throw new Error(data?.detail || data?._raw || `POST /orders failed (${resp.status})`);
      cart = [];
      renderCart();
      showMessage(`Order #${data?.order_id ?? ''} placed successfully.`, 'ok');
      await loadOrders();
    } catch (err) {
      console.error(err);
      showMessage(`Failed to place order: ${err.message}`, 'err');
    }
  });

  // ------------ Initial loads -------------
  (async () => {
    await Promise.all([loadCustomers(), loadProducts(), loadOrders()]);
  })();
})();
