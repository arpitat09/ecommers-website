let currentUser = null;
let products = [];
let cart = [];

// Elements
const authDiv = document.getElementById('auth');
const shopDiv = document.getElementById('shop');
const userDisplay = document.getElementById('userDisplay');
const productsDiv = document.getElementById('products');
const cartUl = document.getElementById('cart');
const totalSpan = document.getElementById('total');
const receiptArea = document.getElementById('receiptArea');
const adminPanel = document.getElementById('adminPanel');
const adminTable = document.getElementById('adminTable');

function showMessage(msg) {
  alert(msg);
}

async function register() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value.trim();
  if (!username || !password) return showMessage('Fill all registration fields');

  const res = await fetch('/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password})
  });
  const data = await res.json();
  if (data.success) {
    showMessage('Registration successful! Please login.');
  } else {
    showMessage(data.message || 'Registration failed');
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!username || !password) return showMessage('Fill all login fields');

  const res = await fetch('/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password})
  });
  const data = await res.json();
  if (data.success) {
    currentUser = username;
    showShop();
  } else {
    showMessage(data.message || 'Login failed');
  }
}

async function fetchProducts() {
  const res = await fetch('/products');
  products = await res.json();
  renderProducts();
}

function renderProducts() {
  productsDiv.innerHTML = '';
  products.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product';
    div.innerHTML = `
      <h4>${p.name}</h4>
      <p>Price: ₹${p.price}</p>
      <button onclick="addToCart(${p.id})">Add to Cart</button>
    `;
    productsDiv.appendChild(div);
  });
}

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  const cartItem = cart.find(c => c.id === productId);
  if (cartItem) {
    cartItem.quantity++;
  } else {
    cart.push({...product, quantity: 1});
  }
  renderCart();
}

function renderCart() {
  cartUl.innerHTML = '';
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
    const li = document.createElement('li');
    li.innerHTML = `
      ${item.name} (₹${item.price}) x${item.quantity}
      <button onclick="removeFromCart(${item.id})">Remove</button>
    `;
    cartUl.appendChild(li);
  });
  totalSpan.textContent = total.toFixed(2);
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.id !== productId);
  renderCart();
}

async function placeOrder() {
  if (cart.length === 0) return showMessage('Cart is empty');
  const items = cart.map(({id, name, price, quantity}) => ({id, name, price, quantity}));
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const res = await fetch('/order', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({items, total})
  });
  const data = await res.json();
  if (data.success) {
    showMessage('Order placed successfully!');
    cart = [];
    renderCart();
    receiptArea.innerHTML = `<a href="${data.receipt}" target="_blank" download>Download Receipt</a>`;
  } else {
    showMessage('Order failed');
  }
}

async function showShop() {
  authDiv.classList.add('hidden');
  shopDiv.classList.remove('hidden');
  userDisplay.textContent = currentUser;
  receiptArea.innerHTML = '';
  await fetchProducts();
  renderCart();
}

function showAdmin() {
  adminPanel.classList.toggle('hidden');
  adminTable.innerHTML = '';
}

async function loadAdminOrders() {
  const pass = document.getElementById('adminPassword').value;
  if (!pass) return showMessage('Enter admin password');

  const res = await fetch(`/admin/orders?password=${encodeURIComponent(pass)}`);
  if (res.status === 403) return showMessage('Unauthorized');

  const orders = await res.json();
  if (orders.length === 0) {
    adminTable.innerHTML = '<tr><td>No orders found</td></tr>';
    return;
  }

  let html = `<tr><th>Order ID</th><th>User</th><th>Details</th><th>Total (₹)</th><th>Placed At</th></tr>`;
  orders.forEach(o => {
    html += `<tr>
      <td>${o.id}</td>
      <td>${o.username}</td>
      <td>${o.details}</td>
      <td>${o.total}</td>
      <td>${new Date(o.created_at).toLocaleString()}</td>
    </tr>`;
  });
  adminTable.innerHTML = html;
}
