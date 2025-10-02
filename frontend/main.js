// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);

function showAlert(kind, msg) {
  const el = $("alert");
  el.innerHTML = `
    <div class="alert alert-${kind} alert-dismissible fade show" role="alert">
      ${msg}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

async function parseJsonOrText(resp) {
  const text = await resp.text();
  try { return { ok: resp.ok, json: JSON.parse(text), raw: text }; }
  catch { return { ok: resp.ok, json: null, raw: text }; }
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

// ---------- API base (always /api/* so NGINX proxies it) ----------
const API = {
  customers: "/api/customers/",
  products : "/api/products/",
  orders   : "/api/orders/"
};

// ---------- Customers ----------
async function loadCustomers() {
  $("customersList").textContent = "Loading customers…";
  try {
    const r = await fetch(API.customers);
    const p = await parseJsonOrText(r);
    if (!p.ok) throw new Error(p.raw || "Failed to load customers");
    const items = asList(p.json);
    $("customersList").innerHTML =
      items.length
        ? items.map(c => `#${c.id ?? "?"} — ${c.email ?? ""} (${c.first_name ?? ""} ${c.last_name ?? ""})`).join("<br>")
        : "No customers yet.";
  } catch (e) {
    $("customersList").textContent = "Could not load customers. Please check the Customer Service.";
    showAlert("danger", `Failed to load customers: ${e.message}`);
  }
}

async function addCustomer() {
  const body = {
    email:       $("custEmail").value.trim(),
    password:    $("custPassword").value,
    first_name:  $("custFirstName").value.trim(),
    last_name:   $("custLastName").value.trim(),
    phone:       $("custPhone").value.trim(),
    address:     $("custAddress").value.trim()
  };
  try {
    const r = await fetch(API.customers, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const p = await parseJsonOrText(r);
    if (!p.ok) throw new Error(p.raw || "Unknown error");
    showAlert("success", "Customer added successfully.");
    await loadCustomers();
  } catch (e) {
    showAlert("danger", `Failed to add customer: ${e.message}`);
  }
}

// ---------- Products ----------
async function loadProducts() {
  $("productsList").textContent = "Loading products…";
  try {
    const r = await fetch(API.products);
    const p = await parseJsonOrText(r);
    if (!p.ok) throw new Error(p.raw || "Failed to load products");
    const items = asList(p.json);
    $("productsList").innerHTML =
      items.length
        ? items.map(pr => `#${pr.id ?? "?"} — ${pr.name ?? ""} ($${Number(pr.price ?? 0).toFixed(2)}) x ${pr.stock ?? 0}`).join("<br>")
        : "No products yet.";
  } catch (e) {
    $("productsList").textContent = "Could not load products. Please check the Product Service.";
    showAlert("danger", `Failed to load products: ${e.message}`);
  }
}

async function addProduct() {
  const body = {
    name:  $("prodName").value.trim(),
    price: Number($("prodPrice").value),
    stock: Number($("prodStock").value),
    description: $("prodDesc").value.trim()
  };
  try {
    const r = await fetch(API.products, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const p = await parseJsonOrText(r);
    if (!p.ok) throw new Error(p.raw || "Unknown error");
    showAlert("success", "Product added successfully.");
    await loadProducts();
  } catch (e) {
    showAlert("danger", `Failed to add product: ${e.message}`);
  }
}

// ---------- Orders ----------
async function loadOrders() {
  $("ordersList").textContent = "Loading orders…";
  try {
    const r = await fetch(API.orders);
    const p = await parseJsonOrText(r);
    if (!p.ok) throw new Error(p.raw || "Failed to load orders");
    const items = asList(p.json);
    $("ordersList").innerHTML =
      items.length
        ? items.map(o => `#${o.id ?? "?"} — customer ${o.customer_id ?? "?"} — total $${Number(o.total_amount ?? 0).toFixed(2)} — status ${o.status ?? "unknown"}`).join("<br>")
        : "No orders yet.";
  } catch (e) {
    $("ordersList").textContent = "Could not load orders. Please check the Order Service.";
    showAlert("danger", `Failed to load orders: ${e.message}`);
  }
}

async function placeOrder() {
  const body = {
    customer_id: Number($("orderCustomerId").value),
    shipping_address: $("orderAddress").value.trim()
  };
  try {
    const r = await fetch(API.orders, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const p = await parseJsonOrText(r);
    if (!p.ok) throw new Error(p.raw || "Unknown error");
    showAlert("success", "Order placed. Check Products & Order Services for async flow.");
    await loadOrders();
  } catch (e) {
    showAlert("danger", `Failed to place order: ${e.message}`);
  }
}

// ---------- Wire up & initial loads ----------
window.addEventListener("DOMContentLoaded", () => {
  $("btnAddCustomer").addEventListener("click", addCustomer);
  $("btnAddProduct").addEventListener("click", addProduct);
  $("btnPlaceOrder").addEventListener("click", placeOrder);

  loadCustomers();
  loadProducts();
  loadOrders();
});
