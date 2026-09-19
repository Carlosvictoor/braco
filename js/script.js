document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const contactForm = document.getElementById('contactForm');

  // Header shadow on scroll
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };
  onScroll();
  window.addEventListener('scroll', onScroll);

  // Mobile nav toggle
  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
  });

  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
    });
  });

  // Highlight active nav link based on section in view
  const sections = document.querySelectorAll('section[id]');
  const navLinks = mainNav.querySelectorAll('a');

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );
  sections.forEach(section => observer.observe(section));

  // ---- Dados dinâmicos vindos do backend ----
  let currentWhatsapp = '5513974044813';

  function digitsOnly(str) {
    return (str || '').replace(/\D/g, '');
  }

  function applyContactInfo(info) {
    if (!info) return;

    if (info.whatsapp) {
      currentWhatsapp = digitsOnly(info.whatsapp);
      document.querySelectorAll('[data-field="whatsapp-link"]').forEach(el => {
        el.setAttribute('href', `https://wa.me/${currentWhatsapp}`);
      });
    }
    if (info.whatsapp) {
      const display = formatPhoneDisplay(info.whatsapp);
      document.querySelectorAll('[data-field="whatsapp-text"]').forEach(el => {
        el.textContent = display;
      });
    }
    if (info.telefone) {
      const digits = digitsOnly(info.telefone);
      document.querySelectorAll('[data-field="phone-link"]').forEach(el => {
        el.setAttribute('href', `tel:+${digits}`);
      });
      const display = formatPhoneDisplay(info.telefone);
      document.querySelectorAll('[data-field="phone-text"]').forEach(el => {
        el.textContent = display;
      });
    }
    if (info.cidade) {
      document.querySelectorAll('[data-field="cidade-text"]').forEach(el => {
        el.textContent = info.cidade;
      });
    }
    if (info.regiao) {
      document.querySelectorAll('[data-field="regiao-text"]').forEach(el => {
        el.textContent = info.regiao;
      });
    }
    if (info.instagram) {
      const handle = info.instagram.replace(/^@/, '');
      document.querySelectorAll('[data-field="instagram-link"]').forEach(el => {
        el.setAttribute('href', `https://instagram.com/${handle}`);
      });
      document.querySelectorAll('[data-field="instagram-text"]').forEach(el => {
        el.textContent = `@${handle}`;
      });
    }
  }

  function formatPhoneDisplay(raw) {
    const digits = digitsOnly(raw);
    // Remove código do país 55 se presente, para exibir no formato local (DD 9XXXX-XXXX)
    const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    if (local.length === 11) {
      return `${local.slice(0, 2)} ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    if (local.length === 10) {
      return `${local.slice(0, 2)} ${local.slice(2, 6)}-${local.slice(6)}`;
    }
    return raw;
  }

  function renderPortfolio(items) {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!items || items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.id = 'portfolioEmpty';
      empty.textContent = 'Em breve, fotos dos nossos trabalhos.';
      grid.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'portfolio-item has-photo';
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.legenda || 'Foto de trabalho realizado pela Elétrica Vallerini';
      img.loading = 'lazy';
      div.appendChild(img);
      grid.appendChild(div);
    });
  }

  function initials(name) {
    return (name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || '')
      .join('');
  }

  function renderTestimonials(items) {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!items || items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.id = 'testimonialsEmpty';
      empty.textContent = 'Em breve, depoimentos de clientes reais.';
      grid.appendChild(empty);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'testimonial-card';

      const head = document.createElement('div');
      head.className = 'testimonial-head';

      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = initials(item.nome);
      avatar.setAttribute('aria-hidden', 'true');

      const stars = document.createElement('div');
      stars.className = 'stars';
      const nota = Math.min(5, Math.max(1, Number(item.nota) || 5));
      stars.textContent = '★'.repeat(nota) + '☆'.repeat(5 - nota);

      head.appendChild(avatar);
      head.appendChild(stars);

      const text = document.createElement('p');
      text.textContent = `"${item.texto}"`;

      const author = document.createElement('strong');
      author.textContent = `— ${item.nome}`;

      card.appendChild(head);
      card.appendChild(text);
      card.appendChild(author);
      grid.appendChild(card);
    });
  }

  async function loadDynamicContent() {
    try {
      const res = await fetch('/api/contact-info');
      if (res.ok) applyContactInfo(await res.json());
    } catch (e) { /* mantém os valores padrão do HTML */ }

    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) renderPortfolio(await res.json());
    } catch (e) { /* mantém o estado vazio padrão */ }

    try {
      const res = await fetch('/api/testimonials');
      if (res.ok) renderTestimonials(await res.json());
    } catch (e) { /* mantém o estado vazio padrão */ }
  }

  loadDynamicContent();

  // Contact form -> registra no backend e abre o WhatsApp
  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nome = contactForm.nome.value.trim();
      const telefone = contactForm.telefone.value.trim();
      const mensagem = contactForm.mensagem.value.trim();
      const submitBtn = contactForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;

      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, telefone, mensagem }),
        });
      } catch (err) {
        // Mesmo se o backend estiver fora do ar, ainda deixamos o visitante falar pelo WhatsApp
      }

      const texto = `Olá! Meu nome é ${nome}.\nTelefone: ${telefone}\nMensagem: ${mensagem}`;
      const url = `https://wa.me/${currentWhatsapp}?text=${encodeURIComponent(texto)}`;
      window.open(url, '_blank', 'noopener');

      contactForm.reset();
      submitBtn.disabled = false;
    });
  }
});
