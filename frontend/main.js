// EXACT SAME UI/logic as your file; only change is how the API URLs are formed.
// We call relative paths and let Nginx proxy to the AKS services.

document.addEventListener('DOMContentLoaded', () => {
    // Use relative paths so requests go to the same host (your LB IP)
    // and get proxied by Nginx to the cluster services.
    const PRODUCT_API_BASE_URL  = '';
    const ORDER_API_BASE_URL    = '';
    const CUSTOMER_API_BASE_URL = '';

    const messageBox = document.getElementById('message-box');
    const productForm = document.getElementById('product-form');
    const productListDiv = document.getElementById('product-list');
    const customerForm = document.getElementById('customer-form');
    const customerListDiv = document.getElementById('customer-list');
    const cartItemsList = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const placeOrderForm = document.getElementById('place-order-form');
    const orderListDiv = document.getElementById('order-list');

    let cart = [];
    let productsCache = {};

    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = 'block';
        setTimeout(() => { messageBox.style.display = 'none'; }, 5000);
    }

    function formatCurrency(amount) {
        return `$${parseFloat(amount).toFixed(2)}`;
    }

    // ---------- Products ----------
    async function fetchProducts() {
        productListDiv.innerHTML = '<p>Loading products...</p>';
        try {
            const res = await fetch(`/products/`);
            if (!res.ok) {
                let e; try { e = await res.json(); } catch {}
                throw new Error((e && e.detail) || `HTTP ${res.status}`);
            }
            const products = await res.json();
            productListDiv.innerHTML = '';
            productsCache = {};

            if (!products.length) {
                productListDiv.innerHTML = '<p>No products available yet. Add some above!</p>';
                return;
            }

            products.forEach(p => {
                productsCache[p.product_id] = p;
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <img src="${p.image_url || 'https://placehold.co/300x200/cccccc/333333?text=No+Image'}"
                         alt="${p.name}"
                         onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/333333?text=Image+Error';"/>
                    <h3>${p.name} (ID: ${p.product_id})</h3>
                    <p>${p.description || 'No description available.'}</p>
                    <p class="price">${formatCurrency(p.price)}</p>
                    <p class="stock">Stock: ${p.stock_quantity}</p>
                    <p><small>Created: ${new Date(p.created_at).toLocaleString()}</small></p>
                    <p><small>Last Updated: ${new Date(p.updated_at).toLocaleString()}</small></p>
                    <div class="upload-image-group">
                        <label for="image-upload-${p.product_id}">Upload Image:</label>
                        <input type="file" id="image-upload-${p.product_id}" accept="image/*" data-product-id="${p.product_id}">
                        <button class="upload-btn" data-id="${p.product_id}">Upload Photo</button>
                    </div>
                    <div class="card-actions">
                        <button class="add-to-cart-btn" data-id="${p.product_id}" data-name="${p.name}" data-price="${p.price}">Add to Cart</button>
                        <button class="delete-btn" data-id="${p.product_id}">Delete</button>
                    </div>`;
                productListDiv.appendChild(card);
            });
        } catch (err) {
            console.error(err);
            showMessage(`Failed to load products: ${err.message}`, 'error');
            productListDiv.innerHTML = '<p>Could not load products. Please check the Product Service.</p>';
        }
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const stock_quantity = parseInt(document.getElementById('product-stock').value, 10);
        const description = document.getElementById('product-description').value;
        const body = { name, price, stock_quantity, description };

        try {
            const res = await fetch(`/products/`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                let e; try { e = await res.json(); } catch {}
                throw new Error((e && e.detail && JSON.stringify(e.detail)) || `HTTP ${res.status}`);
            }
            const p = await res.json();
            showMessage(`Product "${p.name}" added successfully! ID: ${p.product_id}`, 'success');
            productForm.reset();
            fetchProducts();
        } catch (err) {
            showMessage(`Error adding product: ${err.message}`, 'error');
        }
    });

    productListDiv.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (!confirm(`Delete product ID: ${id}?`)) return;
            try {
                const res = await fetch(`/products/${id}`, { method: 'DELETE' });
                if (res.status === 204) {
                    showMessage(`Product ${id} deleted.`, 'success');
                    fetchProducts();
                } else {
                    let dj; try { dj = await res.json(); } catch {}
                    throw new Error((dj && dj.detail && JSON.stringify(dj.detail)) || `HTTP ${res.status}`);
                }
            } catch (err) {
                showMessage(`Error deleting product: ${err.message}`, 'error');
            }
        }

        if (e.target.classList.contains('add-to-cart-btn')) {
            const id = e.target.dataset.id;
            const name = e.target.dataset.name;
            const price = parseFloat(e.target.dataset.price);
            addToCart(id, name, price);
        }

        if (e.target.classList.contains('upload-btn')) {
            const id = e.target.dataset.id;
            const input = document.getElementById(`image-upload-${id}`);
            const file = input.files[0];
            if (!file) { showMessage('Select an image first.', 'info'); return; }
            const fd = new FormData(); fd.append('file', file);
            try {
                showMessage(`Uploading image for product ${id}...`, 'info');
                const res = await fetch(`/products/${id}/upload-image`, { method: 'POST', body: fd });
                if (!res.ok) {
                    let dj; try { dj = await res.json(); } catch {}
                    throw new Error((dj && dj.detail && JSON.stringify(dj.detail)) || `HTTP ${res.status}`);
                }
                const upd = await res.json();
                showMessage(`Image uploaded for ${upd.name}!`, 'success');
                input.value = '';
                fetchProducts();
            } catch (err) {
                showMessage(`Error uploading image: ${err.message}`, 'error');
            }
        }
    });

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
                li.innerHTML = `<span>${item.name} (x${item.quantity})</span>
                                <span>${formatCurrency(item.price)} each - ${formatCurrency(itemTotal)}</span>`;
                cartItemsList.appendChild(li);
            });
        }
        cartTotalSpan.textContent = `Total: ${formatCurrency(total)}`;
    }

    // ---------- Customers ----------
    async function fetchCustomers() {
        customerListDiv.innerHTML = '<p>Loading customers...</p>';
        try {
            const res = await fetch(`/customers/`);
            if (!res.ok) {
                let e; try { e = await res.json(); } catch {}
                throw new Error((e && e.detail) || `HTTP ${res.status}`);
            }
            const customers = await res.json();
            customerListDiv.innerHTML = '';
            if (!customers.length) {
                customerListDiv.innerHTML = '<p>No customers available yet. Add some above!</p>';
                return;
            }
            customers.forEach(c => {
                const card = document.createElement('div');
                card.className = 'customer-card';
                card.innerHTML = `
                    <h3>${c.first_name} ${c.last_name} (ID: ${c.customer_id})</h3>
                    <p>Email: ${c.email}</p>
                    <p>Phone: ${c.phone_number || 'N/A'}</p>
                    <p>Shipping Address: ${c.shipping_address || 'N/A'}</p>
                    <p><small>Created: ${new Date(c.created_at).toLocaleString()}</small></p>
                    <div class="card-actions">
                        <button class="delete-customer-btn" data-id="${c.customer_id}">Delete</button>
                    </div>`;
                customerListDiv.appendChild(card);
            });
        } catch (err) {
            showMessage(`Failed to load customers: ${err.message}`, 'error');
            customerListDiv.innerHTML = '<p>Could not load customers. Please check the Customer Service.</p>';
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

        const body = { email, password, first_name, last_name, phone_number, shipping_address };
        try {
            const res = await fetch(`/customers/`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                let e; try { e = await res.json(); } catch {}
                throw new Error((e && e.detail && JSON.stringify(e.detail)) || `HTTP ${res.status}`);
            }
            const added = await res.json();
            showMessage(`Customer "${added.email}" added! ID: ${added.customer_id}`, 'success');
            customerForm.reset();
            fetchCustomers();
        } catch (err) {
            showMessage(`Error adding customer: ${err.message}`, 'error');
        }
    });

    customerListDiv.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('delete-customer-btn')) return;
        const id = e.target.dataset.id;
        if (!confirm(`Delete customer ${id}?`)) return;
        try {
            const res = await fetch(`/customers/${id}`, { method: 'DELETE' });
            if (res.status === 204) {
                showMessage(`Customer ${id} deleted.`, 'success');
                fetchCustomers();
            } else {
                let dj; try { dj = await res.json(); } catch {}
                throw new Error((dj && dj.detail && JSON.stringify(dj.detail)) || `HTTP ${res.status}`);
            }
        } catch (err) {
            showMessage(`Error deleting customer: ${err.message}`, 'error');
        }
    });

    // ---------- Orders ----------
    placeOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!cart.length) { showMessage('Your cart is empty. Add products first.', 'info'); return; }

        const user_id = parseInt(document.getElementById('order-user-id').value, 10);
        const shipping_address = document.getElementById('shipping-address').value;
        const items = cart.map(i => ({
            product_id: parseInt(i.product_id, 10),
            quantity: i.quantity,
            price_at_purchase: i.price
        }));
        const body = { user_id, shipping_address, items };

        try {
            showMessage('Placing order... (status will update asynchronously)', 'info');
            const res = await fetch(`/orders/`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                let e; try { e = await res.json(); } catch {}
                throw new Error((e && e.detail && JSON.stringify(e.detail)) || `HTTP ${res.status}`);
            }
            const placed = await res.json();
            showMessage(`Order ${placed.order_id} created with status: ${placed.status}`, 'success');
            cart = []; updateCartDisplay(); placeOrderForm.reset();
            fetchOrders();
        } catch (err) {
            showMessage(`Error placing order: ${err.message}`, 'error');
        }
    });

    async function fetchOrders() {
        orderListDiv.innerHTML = '<p>Loading orders...</p>';
        try {
            const res = await fetch(`/orders/`);
            if (!res.ok) {
                let e; try { e = await res.json(); } catch {}
                throw new Error((e && e.detail) || `HTTP ${res.status}`);
            }
            const orders = await res.json();
            orderListDiv.innerHTML = '';
            if (!orders.length) { orderListDiv.innerHTML = '<p>No orders available yet.</p>'; return; }

            orders.forEach(o => {
                const card = document.createElement('div');
                card.className = 'order-card';
                card.innerHTML = `
                    <h3>Order ID: ${o.order_id}</h3>
                    <p>User ID: ${o.user_id}</p>
                    <p>Order Date: ${new Date(o.order_date).toLocaleString()}</p>
                    <p>Status: <span id="order-status-${o.order_id}">${o.status}</span></p>
                    <p>Total Amount: ${formatCurrency(o.total_amount)}</p>
                    <p>Shipping Address: ${o.shipping_address || 'N/A'}</p>
                    <p><small>Created: ${new Date(o.created_at).toLocaleString()}</small></p>
                    <p><small>Last Updated: ${new Date(o.updated_at).toLocaleString()}</small></p>
                    <h4>Items:</h4>
                    <ul class="order-items">
                        ${o.items.map(it => `
                            <li>
                              <span>Product ID: ${it.product_id}</span> - Qty: ${it.quantity}
                              @ ${formatCurrency(it.price_at_purchase)} (Total: ${formatCurrency(it.item_total)})
                            </li>`).join('')}
                    </ul>
                    <div class="status-selector">
                        <select id="status-select-${o.order_id}" data-order-id="${o.order_id}">
                            <option value="pending"   ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="processing"${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                            <option value="shipped"   ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="failed"    ${o.status === 'failed' ? 'selected' : ''}>Failed</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                        <button class="status-update-btn" data-id="${o.order_id}">Update Status</button>
                    </div>
                    <div class="card-actions">
                        <button class="delete-btn" data-id="${o.order_id}">Delete Order</button>
                    </div>`;
                orderListDiv.appendChild(card);
            });
        } catch (err) {
            showMessage(`Failed to load orders: ${err.message}`, 'error');
            orderListDiv.innerHTML = '<p>Could not load orders. Please check the Order Service.</p>';
        }
    }

    orderListDiv.addEventListener('click', async (e) => {
        if (e.target.classList.contains('status-update-btn')) {
            const id = e.target.dataset.id;
            const sel = document.getElementById(`status-select-${id}`);
            const status = sel.value;
            try {
                const res = await fetch(`/orders/${id}/status`, {
                    method: 'PATCH',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ status })
                });
                if (!res.ok) {
                    let dj; try { dj = await res.json(); } catch {}
                    throw new Error((dj && dj.detail && JSON.stringify(dj.detail)) || `HTTP ${res.status}`);
                }
                const upd = await res.json();
                document.getElementById(`order-status-${id}`).textContent = upd.status;
                showMessage(`Order ${id} status updated to "${upd.status}"!`, 'success');
                fetchOrders();
            } catch (err) {
                showMessage(`Error updating order status: ${err.message}`, 'error');
            }
        }

        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (!confirm(`Delete order ${id}? This removes its items too.`)) return;
            try {
                const res = await fetch(`/orders/${id}`, { method: 'DELETE' });
                if (res.status === 204) {
                    showMessage(`Order ${id} deleted.`, 'success');
                    fetchOrders();
                } else {
                    let dj; try { dj = await res.json(); } catch {}
                    throw new Error((dj && dj.detail && JSON.stringify(dj.detail)) || `HTTP ${res.status}`);
                }
            } catch (err) {
                showMessage(`Error deleting order: ${err.message}`, 'error');
            }
        }
    });

    // initial loads + periodic refresh (same as your file’s behavior)
    fetchProducts();
    fetchCustomers();
    fetchOrders();
    setInterval(fetchOrders, 10000);
    setInterval(fetchProducts, 15000);
});
