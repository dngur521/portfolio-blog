(function (global) {
  let csrfTokenPromise = null;

  function getCsrfToken() {
    if (!csrfTokenPromise) {
      csrfTokenPromise = fetch('/api/csrf-token', { credentials: 'same-origin' })
        .then((res) => res.json())
        .then((data) => data.csrfToken);
    }
    return csrfTokenPromise;
  }

  async function fetchJSON(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = Object.assign({}, options.headers);
    let body = options.body;

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }

    if (method !== 'GET' && method !== 'HEAD') {
      headers['X-CSRF-Token'] = await getCsrfToken();
    }

    const res = await fetch(url, {
      ...options,
      method,
      headers,
      body,
      credentials: 'same-origin',
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = null;
      }
    }

    if (!res.ok) {
      const message = (data && data.message) || '요청 처리 중 오류가 발생했습니다.';
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const date = formatDate(value);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${date} ${hh}:${mi}:${ss}`;
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  async function renderNav(activeCategorySlug) {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    let categories = [];
    try {
      const data = await fetchJSON('/api/categories');
      categories = data.categories || [];
    } catch (e) {
      categories = [];
    }

    const catLinks = categories
      .map((c) => {
        const active = c.slug === activeCategorySlug ? ' active' : '';
        return `<a class="nav-cat${active}" href="/category.html?slug=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)} <span class="badge">${c.postCount}</span></a>`;
      })
      .join('');

    nav.innerHTML = `
      <div class="nav-inner">
        <a class="site-title" href="/">김우혁의 블로그</a>
        <div class="nav-categories">${catLinks}</div>
        <form class="nav-search" id="nav-search-form">
          <input type="search" id="nav-search-input" placeholder="검색..." maxlength="100" />
        </form>
        <a class="btn btn-secondary" href="/admin/login.html">관리자 로그인</a>
      </div>
    `;

    const form = document.getElementById('nav-search-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('nav-search-input').value.trim();
      if (q) {
        window.location.href = `/search.html?q=${encodeURIComponent(q)}`;
      }
    });
  }

  async function renderAdminNav(activeLink) {
    const nav = document.getElementById('admin-nav');
    if (!nav) return null;

    let status;
    try {
      status = await fetchJSON('/api/auth/status');
    } catch (e) {
      status = { authenticated: false };
    }

    if (!status.authenticated) {
      window.location.href = '/admin/login.html';
      return null;
    }

    const links = [
      { href: '/admin/editor.html', key: 'editor', label: '글 작성' },
      { href: '/admin/logs.html', key: 'logs', label: '로그인 이력' },
      { href: '/admin/accounts.html', key: 'accounts', label: '계정 관리' },
    ];

    const linkHtml = links
      .map((l) => `<a class="nav-cat${l.key === activeLink ? ' active' : ''}" href="${l.href}">${l.label}</a>`)
      .join('');

    nav.innerHTML = `
      <div class="nav-inner">
        <a class="site-title" href="/admin/editor.html">김우혁의 블로그 관리자</a>
        <div class="nav-categories">${linkHtml}</div>
        <div>
          <span style="margin-right:10px;color:var(--color-muted);font-size:0.85rem;">${escapeHtml(status.displayName || status.username)}</span>
          <button class="btn btn-secondary" id="admin-logout-btn">로그아웃</button>
        </div>
      </div>
    `;

    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
      try {
        await fetchJSON('/api/auth/logout', { method: 'POST' });
      } finally {
        window.location.href = '/admin/login.html';
      }
    });

    return status;
  }

  function postCardHtml(post) {
    const tags = (post.tags || [])
      .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
      .join('');

    return `
      <div class="post-card" data-category="${escapeHtml(post.category.slug)}" data-slug="${escapeHtml(post.slug)}">
        <span class="cat-badge">${escapeHtml(post.category.name)}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <div class="post-meta"><span>${formatDate(post.publishedAt)}</span></div>
        <div class="tag-list">${tags}</div>
      </div>
    `;
  }

  function bindPostCardNavigation(container) {
    $(container).on('click', '.post-card', function () {
      const category = $(this).data('category');
      const slug = $(this).data('slug');
      window.location.href = `/post.html?category=${encodeURIComponent(category)}&slug=${encodeURIComponent(slug)}`;
    });
  }

  global.Blog = {
    fetchJSON,
    formatDate,
    formatDateTime,
    qs,
    escapeHtml,
    showToast,
    renderNav,
    renderAdminNav,
    getCsrfToken,
    postCardHtml,
    bindPostCardNavigation,
  };
})(window);
