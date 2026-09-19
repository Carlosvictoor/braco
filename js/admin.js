document.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
  }
  function hideError(el) {
    el.hidden = true;
  }

  async function api(path, options = {}) {
    const res = await fetch(`/admin-api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* sem corpo */ }
    if (!res.ok) {
      throw new Error(data?.error || 'Erro inesperado.');
    }
    return data;
  }

  // ---- Sessão / Login ----
  async function checkSession() {
    try {
      const data = await api('/session');
      if (data.authenticated) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loadMessages();
    loadPortfolio();
    loadTestimonials();
    loadContactInfo();
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(loginError);
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;

    try {
      await api('/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
      loginForm.reset();
      showDashboard();
    } catch (err) {
      showError(loginError, err.message);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    showLogin();
  });

  // ---- Tabs ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  function formatDate(iso) {
    return new Date(iso).toLocaleString('pt-BR');
  }

  // ---- Mensagens ----
  const messagesList = document.getElementById('messagesList');
  const unreadBadge = document.getElementById('unreadBadge');

  async function loadMessages() {
    const messages = await api('/messages');
    unreadBadge.hidden = true;
    const unreadCount = messages.filter(m => !m.lida).length;
    if (unreadCount > 0) {
      unreadBadge.textContent = unreadCount;
      unreadBadge.hidden = false;
    }

    if (messages.length === 0) {
      messagesList.innerHTML = '<p class="empty-list">Nenhuma mensagem recebida ainda.</p>';
      return;
    }

    messagesList.innerHTML = '';
    messages.forEach(msg => {
      const card = document.createElement('div');
      card.className = `item-card${msg.lida ? '' : ' unread'}`;
      card.innerHTML = `
        <div class="item-main">
          <h3>${escapeHtml(msg.nome)}</h3>
          <p>${escapeHtml(msg.mensagem)}</p>
          <div class="item-meta">
            <span>📞 ${escapeHtml(msg.telefone)}</span>
            <span>${formatDate(msg.criadoEm)}</span>
            <span>${msg.lida ? 'Lida' : 'Não lida'}</span>
          </div>
        </div>
        <div class="item-actions">
          <a class="btn btn-outline btn-small" href="https://wa.me/${digitsOnly(msg.telefone)}" target="_blank" rel="noopener">Responder</a>
          <button class="btn btn-outline btn-small" data-action="toggle-read" data-id="${msg.id}" data-value="${!msg.lida}">${msg.lida ? 'Marcar não lida' : 'Marcar lida'}</button>
          <button class="btn btn-danger btn-small" data-action="delete-message" data-id="${msg.id}">Excluir</button>
        </div>
      `;
      messagesList.appendChild(card);
    });
  }

  messagesList.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'toggle-read') {
      await api(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ lida: btn.dataset.value === 'true' }) });
      loadMessages();
    }
    if (btn.dataset.action === 'delete-message') {
      if (confirm('Excluir esta mensagem?')) {
        await api(`/messages/${id}`, { method: 'DELETE' });
        loadMessages();
      }
    }
  });

  // ---- Portfólio ----
  const portfolioForm = document.getElementById('portfolioForm');
  const portfolioError = document.getElementById('portfolioError');
  const portfolioList = document.getElementById('portfolioList');

  async function loadPortfolio() {
    const items = await fetch('/admin-api/portfolio').then(r => r.json());
    if (items.length === 0) {
      portfolioList.innerHTML = '<p class="empty-list">Nenhuma foto cadastrada ainda.</p>';
      return;
    }
    portfolioList.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'admin-grid-item';
      div.innerHTML = `
        <img src="${item.url}" alt="${escapeHtml(item.legenda || '')}">
        <div class="admin-grid-item-body">
          <span>${escapeHtml(item.legenda || 'Sem legenda')}</span>
          <button class="btn btn-danger btn-small" data-id="${item.id}">Excluir</button>
        </div>
      `;
      portfolioList.appendChild(div);
    });
  }

  portfolioForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(portfolioError);
    const fileInput = document.getElementById('portfolioFile');
    const legenda = document.getElementById('portfolioLegenda').value;

    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('foto', fileInput.files[0]);
    formData.append('legenda', legenda);

    try {
      const res = await fetch('/admin-api/portfolio', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar foto.');
      portfolioForm.reset();
      loadPortfolio();
    } catch (err) {
      showError(portfolioError, err.message);
    }
  });

  portfolioList.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (confirm('Excluir esta foto do portfólio?')) {
      await api(`/portfolio/${btn.dataset.id}`, { method: 'DELETE' });
      loadPortfolio();
    }
  });

  // ---- Depoimentos ----
  const testimonialForm = document.getElementById('testimonialForm');
  const testimonialError = document.getElementById('testimonialError');
  const testimonialsList = document.getElementById('testimonialsList');

  async function loadTestimonials() {
    const items = await api('/testimonials');
    if (items.length === 0) {
      testimonialsList.innerHTML = '<p class="empty-list">Nenhum depoimento cadastrado ainda.</p>';
      return;
    }
    testimonialsList.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-main">
          <h3>${escapeHtml(item.nome)}</h3>
          <div class="stars-inline">${'★'.repeat(item.nota)}${'☆'.repeat(5 - item.nota)}</div>
          <p>${escapeHtml(item.texto)}</p>
          <div class="item-meta"><span>${formatDate(item.criadoEm)}</span></div>
        </div>
        <div class="item-actions">
          <label class="toggle-label">
            <input type="checkbox" data-action="toggle-published" data-id="${item.id}" ${item.published ? 'checked' : ''}>
            Publicado no site
          </label>
          <button class="btn btn-danger btn-small" data-action="delete-testimonial" data-id="${item.id}">Excluir</button>
        </div>
      `;
      testimonialsList.appendChild(card);
    });
  }

  testimonialForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(testimonialError);
    const nome = document.getElementById('testimonialNome').value.trim();
    const texto = document.getElementById('testimonialTexto').value.trim();
    const nota = document.getElementById('testimonialNota').value;

    try {
      await api('/testimonials', { method: 'POST', body: JSON.stringify({ nome, texto, nota }) });
      testimonialForm.reset();
      loadTestimonials();
    } catch (err) {
      showError(testimonialError, err.message);
    }
  });

  testimonialsList.addEventListener('change', async e => {
    if (e.target.dataset.action === 'toggle-published') {
      await api(`/testimonials/${e.target.dataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ published: e.target.checked }),
      });
    }
  });

  testimonialsList.addEventListener('click', async e => {
    const btn = e.target.closest('button');
    if (!btn || btn.dataset.action !== 'delete-testimonial') return;
    if (confirm('Excluir este depoimento?')) {
      await api(`/testimonials/${btn.dataset.id}`, { method: 'DELETE' });
      loadTestimonials();
    }
  });

  // ---- Contato ----
  const contactInfoForm = document.getElementById('contactInfoForm');
  const contactInfoSuccess = document.getElementById('contactInfoSuccess');

  async function loadContactInfo() {
    const info = await api('/contact-info');
    document.getElementById('ciWhatsapp').value = info.whatsapp || '';
    document.getElementById('ciTelefone').value = info.telefone || '';
    document.getElementById('ciCidade').value = info.cidade || '';
    document.getElementById('ciRegiao').value = info.regiao || '';
    document.getElementById('ciInstagram').value = info.instagram || '';
  }

  contactInfoForm.addEventListener('submit', async e => {
    e.preventDefault();
    contactInfoSuccess.hidden = true;

    await api('/contact-info', {
      method: 'PUT',
      body: JSON.stringify({
        whatsapp: digitsOnly(document.getElementById('ciWhatsapp').value),
        telefone: digitsOnly(document.getElementById('ciTelefone').value),
        cidade: document.getElementById('ciCidade').value.trim(),
        regiao: document.getElementById('ciRegiao').value.trim(),
        instagram: document.getElementById('ciInstagram').value.trim(),
      }),
    });

    contactInfoSuccess.hidden = false;
    setTimeout(() => { contactInfoSuccess.hidden = true; }, 3000);
  });

  // ---- Conta / senha ----
  const passwordForm = document.getElementById('passwordForm');
  const passwordError = document.getElementById('passwordError');
  const passwordSuccess = document.getElementById('passwordSuccess');

  passwordForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideError(passwordError);
    passwordSuccess.hidden = true;

    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha = document.getElementById('novaSenha').value;

    try {
      await api('/change-password', { method: 'POST', body: JSON.stringify({ senhaAtual, novaSenha }) });
      passwordForm.reset();
      passwordSuccess.hidden = false;
    } catch (err) {
      showError(passwordError, err.message);
    }
  });

  // ---- Helpers ----
  function digitsOnly(str) {
    return (str || '').replace(/\D/g, '');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  checkSession();
});
