const $ = (id) => document.getElementById(id);
let currentUser = null;
let token = localStorage.getItem('estulanches_token');
let authMode = 'login';
let products = [];

function notify(message, error = false) {
  $('message').textContent = message;
  $('message').classList.remove('hidden', 'error');
  if (error) $('message').classList.add('error');
}
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Não foi possível concluir a operação.');
  return data;
}
function money(value) { return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function renderSession() {
  $('session-area').innerHTML = currentUser
    ? `<span class="muted">Olá, ${escapeHtml(currentUser.name)}</span> <button class="button secondary" id="logout">Sair</button>`
    : '<button class="button secondary" id="login-open">Entrar</button>';
  $('logout')?.addEventListener('click', logout);
  $('login-open')?.addEventListener('click', openAuth);
  $('orders-open').classList.toggle('hidden', !currentUser);
  $('admin-panel').classList.toggle('hidden', currentUser?.role !== 'admin');
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function loadProducts() {
  try {
    products = await api('/products');
    $('products').innerHTML = products.length ? products.map(p => `<article class="product"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description || 'Disponível na cantina.')}</p><div class="price">${money(p.price)}</div><button class="button" data-order="${p.id}" ${currentUser ? '' : 'disabled'}>${currentUser ? 'Adicionar ao pedido' : 'Entre para pedir'}</button></article>`).join('') : '<p class="muted">Nenhum produto disponível no momento.</p>';
    document.querySelectorAll('[data-order]').forEach(button => button.addEventListener('click', () => createOrder(Number(button.dataset.order))));
  } catch (error) { notify(error.message, true); }
}
function openAuth(mode = 'login') {
  authMode = mode;
  $('auth-panel').classList.remove('hidden');
  $('auth-title').textContent = mode === 'login' ? 'Entrar na conta' : 'Criar cadastro';
  $('auth-submit').textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
  $('name-wrap').classList.toggle('hidden', mode === 'login');
  $('auth-switch').innerHTML = mode === 'login' ? 'Ainda não tem conta? <button class="text-button" id="register-open">Criar cadastro</button>' : 'Já tem conta? <button class="text-button" id="register-open">Entrar</button>';
  $('register-open').addEventListener('click', () => openAuth(mode === 'login' ? 'register' : 'login'));
}
async function logout() {
  token = null; currentUser = null; localStorage.removeItem('estulanches_token');
  renderSession(); await loadProducts(); notify('Sessão encerrada.');
}
async function createOrder(productId) {
  try {
    const order = await api('/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId, quantity: 1 }] }) });
    notify(`Pedido #${order.id} recebido. Total: ${money(order.total)}.`);
  } catch (error) { notify(error.message, true); }
}
async function loadOrders() {
  try {
    const orders = await api('/orders');
    $('orders-list').innerHTML = orders.length ? orders.map(o => `<div class="order-row"><div><strong>Pedido #${o.id}</strong><br><span class="muted">${o.status} · ${new Date(o.created_at).toLocaleString('pt-BR')}</span></div><strong>${money(o.total)}</strong></div>`).join('') : '<p class="muted">Você ainda não realizou pedidos.</p>';
    $('orders-panel').classList.remove('hidden');
  } catch (error) { notify(error.message, true); }
}
$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = { email: $('email').value, password: $('password').value };
    if (authMode === 'register') payload.name = $('name').value;
    if (authMode === 'register') await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: payload.email, password: payload.password }) });
    token = result.token; currentUser = result.user; localStorage.setItem('estulanches_token', token);
    $('auth-panel').classList.add('hidden'); renderSession(); await loadProducts(); notify('Login realizado com sucesso.');
  } catch (error) { notify(error.message, true); }
});
$('product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/products', { method: 'POST', body: JSON.stringify({ name: $('product-name').value, description: $('product-description').value, price: Number($('product-price').value) }) });
    $('product-form').reset(); await loadProducts(); notify('Produto cadastrado.');
  } catch (error) { notify(error.message, true); }
});
$('login-open')?.addEventListener('click', openAuth);
$('auth-close').addEventListener('click', () => $('auth-panel').classList.add('hidden'));
$('orders-open').addEventListener('click', loadOrders);
$('orders-close').addEventListener('click', () => $('orders-panel').classList.add('hidden'));

async function initialize() {
  if (token) {
    try {
      const me = await api('/orders');
      // A validação do token ocorre pela rota protegida; os dados do usuário ficam no token JWT.
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      currentUser = { id: payload.id, name: payload.name, role: payload.role };
      void me;
    } catch { token = null; localStorage.removeItem('estulanches_token'); }
  }
  renderSession(); await loadProducts();
}
initialize();
