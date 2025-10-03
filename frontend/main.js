// IMPORTANT: All requests go via NGINX at /api so the browser never talks to cluster DNS directly.
// The rest of the code/behaviour matches your working reference UI.

document.addEventListener('DOMContentLoaded', () => {
    // Single base; specific resources are appended below.
    const API_BASE = '/api';

    // DOM Elements
    const messageBox = document.getElementById('message-box');
    const productForm = document.getElementById('product-form');
    const productListDiv = document.getElementById('product-list');
    const customerForm = document.getElementById('customer-form');
    const customerListDiv = document.getElementById('customer-list');
    const cartItemsList = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const placeOrderForm = document.getElementById('place-order-form');
    const orderListDiv = document.getElementById('order-list');

    // Shopping Cart State
    let cart = [];
    let productsCache = {};

    // --- Utility Functions ---
    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = 'block';
        setTimeout(() => { messageBox.style.display = 'none'; }, 5000);
    }

    function formatCurrency(amount) {
        return `$${parseFloat(amount).toFixed(2)}`;
    }

    // --- Product Service Interactions ---
    async function fetchProducts() {
        productListDiv.innerHTML = '<p>Loading products...</p>';
        try {
            const response = await fetch(`${API_BASE}/products/`);
            if (!response.ok) {
                let detail;
                try { detail = (await response.json()).detail; } catch (_) {}
                throw new Error(detail || `HTTP error! status: ${response.status}`);
            }
            const products = await response.json();
            productListDiv.innerHTML = '';
            productsCache = {};

            if (!products.length) {
                productListDiv.innerHTML = '<p>No products available yet. Add some above!</p>';
                return;
            }

            products.forEach(product => {
                productsCache[product.product_id] = product;
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h3>${product.name} (ID: ${product.product_id})</h3>
                    <p>${product.description || 'No description available.'}</p>
                    <p class="price">${formatCurrency(product.price)}</p>
                    <p class="stock">Stock: ${product.stock_quantity}</p>
                    <div class="upload-image-group">
                      <input type="file" id="image-upload-${product.product_id}" accept="image/*" data-product-id="${product.product_id}">
                      <button class="upload-btn" data-id="${product.product_id}">Upload Photo</button>
                    </div>
                    <div class="card-actions">
                        <button class="add-to-cart-btn" data-id="${product.product_id}" data-name="${product.name}" data-price="${product.price}">Add to Cart</button>
                        <button class="delete-btn danger" data-id="${product.product_id}">Delete</button>
                    </div>
                `;
                productListDiv.appendChild(card);
            });
        } catch (err) {
            console.error('Error fetching products:', err);
            showMessage(`Failed to load products: ${err.message}`, 'error');
            productListDiv.innerHTML = '<p>Could not load products. Please check the Product Service.</p>';
        }
    }

    productForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const stock_quantity = parseInt(document.getElementById('product-stock').value, 10);
        const description = document.getElementById('product-description').value;

        // Use stock_quantity (not "stock") to satisfy the backend schema
        const newProduct = { name, price, stock_quantity, description };

        try {
            const response = await fetch(`${API_BASE}/products/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct),
            });

            if (!response.ok) {
                let detail;
                try { detail = (await response.json()).detail; } catch (_) {}
                throw new Error(detail ? JSON.stringify(detail) : `HTTP error! status: ${response.status}`);
            }

            const added = await response.json();
            showMessage(`Product "${added.name}" added successfully! ID: ${added.product_id}`, 'success');
            productForm.reset();
            fetchProducts();
        } catch (err) {
            console.error('Error adding product:', err);
            showMessage(`Error adding product: ${err.message}`, 'error');
        }
    });

    productListDiv.addEventListener('click', async (event) => {
        // Delete
        if (event.target.classList.contains('delete-btn')) {
            const id = event.target.dataset.id;
            if (!confirm(`Delete product ${id}?`)) return;
            try {
                const resp = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
                if (resp.status === 204) {
                    showMessage(`Product ${id} deleted.`, 'success');
                    fetchProducts();
                } else {
                    let detail;
                    try { detail = (await resp.json()).detail; } catch (_) {}
                    throw new Error(detail ? JSON.stringify(detail) : `HTTP error! status: ${resp.status}`);
                }
            } catch (err) {
                console.error('Error deleting product:', err);
                showMessage(`Error deleting product: ${err.message}`, 'error');
            }
        }

        // Add to cart
        if (event.target.classList.contains('add-to-cart-btn')) {
            const productId = event.target.dataset.id;
            const name = event.target.dataset.name;
            const price = parseFloat(event.target.dataset.price);
            addToCart(productId, name, price);
        }

        // Upload image
        if (event.target.classList.contains('upload-btn')) {
            const productId = event.target.dataset.id;
            const fileInput = document.getElementById(`image-upload-${productId}`);
            const file = fileInput.files[0];
            if (!file) { showMessage("Select an image file first.", 'info'); return; }

            const formData = new FormData();
            formData.append("file", file);

            try {
                showMessage(`Uploading image for product ${productId}...`, 'info');
                const resp = await fetch(`${API_BASE}/products/${productId}/upload-image`, {
                    method: 'POST',
                    body: formData,
                });
                if (!resp.ok) {
                    let detail;
                    try { detail = (await resp.json()).detail; } catch (_) {}
                    throw new Error(detail ? JSON.stringify(detail) : `HTTP error! status: ${resp.status}`);
                }
                const updated = await resp.json();
                showMessage(`Image uploaded for "${updated.name}".`, 'success');
                fileInput.value = '';
                fetchProducts();
            } catch (err) {
                console.error('Error uploading image:', err);
                showMessage(`Error uploading image: ${err.message}`, 'error');
            }
        }
    });

    // --- Cart ---
    function addToCart(product_id, name, price) {
        const i = cart.findIndex(x => x.product_id === product_id);
        if (i !== -1) cart[i].quantity += 1;
        else cart.push({ product_id, name, price, quantity: 1 });
        updateCartDisplay();
        showMessage(`Added "${name}" to cart!`, 'info');
    }

    function updateCartDisplay() {
        cartItemsList.innerHTML = '';
        let total = 0;
        if (!cart.length) {
            cartItemsList.innerHTML = '<li>Your cart is empty.</li>';
        } else {
            cart.forEach(item => {
                const li = document.createElement('li');
                const itemTotal = item.quantity * item.price;
                total += itemTotal;
                li.innerHTML = `<span>${item.name} (x${item.quantity})</span><span>${formatCurrency(item.price)} each - ${formatCurrency(itemTotal)}</span>`;
                cartItemsList.appendChild(li);
            });
        }
        cartTotalSpan.textContent = `Total: ${formatCurrency(total)}`;
    }

    // --- Customers ---
    async function fetchCustomers() {
        customerListDiv.innerHTML = '<p>Loading customers...</p>';
        try {
            const resp = await fetch(`${API_BASE}/customers/`);
            if (!resp.ok) {
                let d; try { d = (await resp.json()).detail; } catch (_) {}
                throw new Error(d || `HTTP error! status: ${resp.status}`);
            }
            const customers = await resp.json();
            customerListDiv.innerHTML = '';
            if (!customers.length) { customerListDiv.innerHTML = '<p>No customers yet.</p>'; return; }
            customers.forEach(c => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                  <h3>${c.first_name} ${c.last_name} (ID: ${c.customer_id})</h3>
                  <p>Email: ${c.email}</p>
                  <p>Phone: ${c.phone_number || 'N/A'}</p>
                  <p>Shipping: ${c.shipping_address || 'N/A'}</p>
                  <div class="card-actions">
                    <button class="delete-customer-btn danger" data-id="${c.customer_id}">Delete</button>
                  </div>`;
                customerListDiv.appendChild(card);
            });
        } catch (err) {
            console.error('Error fetching customers:', err);
            showMessage(`Failed to load customers: ${err.message}`, 'error');
            customerListDiv.innerHTML = '<p>Could not load customers. Check the Customer Service.</p>';
        }
    }

    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('customer-email').value;
        const password = document.getElementById('customer-password').value;
        const first_name = document.getElementById('customer-first-name').value;
        const last_name = document.getElementById('customer-last-name').value;
        const phone_number = document.getElementById('customer-phone').value;
        const shipping_address = document.getElementById('customer-shipping-address').value;

        const payload = { email, password, first_name, last_name, phone_number, shipping_address };
        try {
            const resp = await fetch(`${API_BASE}/customers/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                let d; try { d = (await resp.json()).detail; } catch (_) {}
                throw new Error(d ? JSON.stringify(d) : `HTTP error! status: ${resp.status}`);
            }
            const added = await resp.json();
            showMessage(`Customer "${added.email}" added (ID ${added.customer_id}).`, 'success');
            customerForm.reset();
            fetchCustomers();
        } catch (err) {
            console.error('Error adding customer:', err);
            showMessage(`Error adding customer: ${err.message}`, 'error');
        }
    });

    customerListDiv.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('delete-customer-btn')) return;
        const id = e.target.dataset.id;
        if (!confirm(`Delete customer ${id}?`)) return;
        try {
            const resp = await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
            if (resp.status === 204) {
                showMessage(`Customer ${id} deleted.`, 'success');
                fetchCustomers();
            } else {
                let d; try { d = (await resp.json()).detail; } catch (_) {}
                throw new Error(d ? JSON.stringify(d) : `HTTP error! status: ${resp.status}`);
            }
        } catch (err) {
            console.error('Error deleting customer:', err);
            showMessage(`Error deleting customer: ${err.message}`, 'error');
        }
    });

    // --- Orders ---
    placeOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!cart.length) { showMessage("Your cart is empty.", 'info'); return; }

        const user_id = parseInt(document.getElementById('order-user-id').value, 10);
        const shipping_address = document.getElementById('shipping-address').value;

        const items = cart.map(it => ({
            product_id: parseInt(it.product_id, 10),
            quantity: it.quantity,
            price_at_purchase: it.price
        }));

        const payload = { user_id, shipping_address, items };
        try {
            showMessage("Placing order (stock deduction will update asynchronously)...", 'info');
            const resp = await fetch(`${API_BASE}/orders/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                let d; try { d = (await resp.json()).detail; } catch (_) {}
                throw new Error(d ? JSON.stringify(d) : `HTTP error! status: ${resp.status}`);
            }
            const placed = await resp.json();
            showMessage(`Order ${placed.order_id} created (status: ${placed.status}).`, 'success');
            cart = []; updateCartDisplay(); placeOrderForm.reset();
            fetchOrders();
        } catch (err) {
            console.error('Error placing order:', err);
            showMessage(`Error placing order: ${err.message}`, 'error');
        }
    });

    async function fetchOrders() {
        orderListDiv.innerHTML = '<p>Loading orders...</p>';
        try {
            const resp = await fetch(`${API_BASE}/orders/`);
            if (!resp.ok) {
                let d; try { d = (await resp.json()).detail; } catch (_) {}
                throw new Error(d || `HTTP error! status: ${resp.status}`);
            }
            const orders = await resp.json();
            orderListDiv.innerHTML = '';
            if (!orders.length) { orderListDiv.innerHTML = '<p>No orders yet.</p>'; return; }

            orders.forEach(o => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h3>Order ID: ${o.order_id}</h3>
                    <p>User ID: ${o.user_id}</p>
                    <p>Order Date: ${new Date(o.order_date).toLocaleString()}</p>
                    <p>Status: <span id="order-status-${o.order_id}">${o.status}</span></p>
                    <p>Total Amount: ${formatCurrency(o.total_amount)}</p>
                    <p>Shipping Address: ${o.shipping_address || 'N/A'}</p>
                    <p class="small muted">Created: ${new Date(o.created_at).toLocaleString()} | Updated: ${new Date(o.updated_at).toLocaleString()}</p>

                    <h4>Items</h4>
                    <ul class="small">
                        ${o.items.map(it => `
                          <li>Product ${it.product_id} — Qty ${it.quantity} @ ${formatCurrency(it.price_at_purchase)} (Total: ${formatCurrency(it.item_total)})</li>
                        `).join('')}
                    </ul>

                    <div class="bar">
                        <select id="status-select-${o.order_id}" data-order-id="${o.order_id}">
                            <option value="pending" ${o.status==='pending'?'selected':''}>Pending</option>
                            <option value="processing" ${o.status==='processing'?'selected':''}>Processing</option>
                            <option value="shipped" ${o.status==='shipped'?'selected':''}>Shipped</option>
                            <option value="confirmed" ${o.status==='confirmed'?'selected':''}>Confirmed</option>
                            <option value="failed" ${o.status==='failed'?'selected':''}>Failed</option>
                            <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelled</option>
                            <option value="completed" ${o.status==='completed'?'selected':''}>Completed</option>
                        </select>
                        <button class="status-update-btn">Update Status</button>
                        <button class="delete-btn danger" data-id="${o.order_id}">Delete Order</button>
                    </div>
                `;
                orderListDiv.appendChild(card);
            });
        } catch (err) {
            console.error('Error fetching orders:', err);
            showMessage(`Failed to load orders: ${err.message}`, 'error');
            orderListDiv.innerHTML = '<p>Could not load orders. Please check the Order Service.</p>';
        }
    }

    orderListDiv.addEventListener('click', async (e) => {
        if (e.target.classList.contains('status-update-btn')) {
            const wrapper = e.target.closest('.card');
            const select = wrapper.querySelector('select[id^="status-select-"]');
            const orderId = select.dataset.orderId;
            const newStatus = select.value;
            try {
                const resp = await fetch(`${API_BASE}/orders/${orderId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus }),
                });
                if (!resp.ok) {
                    let d; try { d = (await resp.json()).detail; } catch (_) {}
                    throw new Error(d ? JSON.stringify(d) : `HTTP error! status: ${resp.status}`);
                }
                const updated = await resp.json();
                document.getElementById(`order-status-${orderId}`).textContent = updated.status;
                showMessage(`Order ${orderId} status updated to "${updated.status}"`, 'success');
                fetchOrders();
            } catch (err) {
                console.error('Error updating order status:', err);
                showMessage(`Error updating order: ${err.message}`, 'error');
            }
        }

        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (!confirm(`Delete order ${id} (and its items)?`)) return;
            try {
                const resp = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
                if (resp.status === 204) {
                    showMessage(`Order ${id} deleted.`, 'success');
                    fetchOrders();
                } else {
                    let d; try { d = (await resp.json()).detail; } catch (_) {}
                    throw new Error(d ? JSON.stringify(d) : `HTTP error! status: ${resp.status}`);
                }
            } catch (err) {
                console.error('Error deleting order:', err);
                showMessage(`Error deleting order: ${err.message}`, 'error');
            }
        }
    });

    // Initial loads + periodic refresh
    fetchProducts();
    fetchCustomers();
    fetchOrders();
    setInterval(fetchOrders, 10000);
    setInterval(fetchProducts, 15000);
});
