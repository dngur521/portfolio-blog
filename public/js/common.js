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

  const THEME_KEY = 'theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }

  function setTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // localStorage 사용 불가 환경에서는 이번 페이지에서만 적용
    }
    applyTheme(theme);
  }

  function initThemeToggle(selectEl) {
    if (!selectEl) return;
    const current = getStoredTheme();
    selectEl.value = current;
    applyTheme(current);
    selectEl.addEventListener('change', () => setTheme(selectEl.value));
  }

  // 로그인 여부와 무관하게 항상 같은 공개 화면을 기본으로 보여주고,
  // 로그인된 경우에만 로그아웃/관리 링크를 얹어주는 단일 네비게이션.
  // 카테고리 목록은 페이지별 "카테고리별 보기" 드롭다운에서 이미 보여주므로
  // nav 자체에는 카테고리별 링크를 나열하지 않는다.
  async function renderNav(activePage) {
    const nav = document.getElementById('site-nav');
    if (!nav) return { authenticated: false };

    let status = { authenticated: false };
    try {
      status = await fetchJSON('/api/auth/status');
    } catch (e) {
      // 조회 실패 시 비로그인 상태의 기본 화면으로 진행
    }

    const allActive = activePage === 'all' ? ' active' : '';
    const aboutActive = activePage === 'about' ? ' active' : '';

    const authControlsHtml = status.authenticated
      ? `
        <a class="nav-cat${activePage === 'logs' ? ' active' : ''}" href="/admin/logs">이력 조회</a>
        <a class="nav-cat${activePage === 'accounts' ? ' active' : ''}" href="/admin/accounts">계정 관리</a>
        <span class="nav-user">${escapeHtml(status.displayName || status.username)}</span>
        <button class="btn btn-secondary" id="nav-logout-btn">로그아웃</button>
      `
      : `<a class="btn btn-secondary" href="/admin/login">관리자 로그인</a>`;

    nav.innerHTML = `
      <div class="nav-inner">
        <a class="site-title" href="/">김우혁의 블로그</a>
        <div class="nav-categories">
          <a class="nav-cat${allActive}" href="/">전체 글 보기</a>
          <a class="nav-cat${aboutActive}" href="/about">About me</a>
        </div>
        <form class="nav-search" id="nav-search-form">
          <input type="search" id="nav-search-input" placeholder="검색..." maxlength="100" />
        </form>
        <div class="nav-auth">${authControlsHtml}</div>
        <select id="theme-select" class="theme-select" aria-label="테마 선택">
          <option value="auto">자동</option>
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
      </div>
    `;

    initThemeToggle(document.getElementById('theme-select'));

    const form = document.getElementById('nav-search-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('nav-search-input').value.trim();
      if (q) {
        window.location.href = `/search?q=${encodeURIComponent(q)}`;
      }
    });

    if (status.authenticated) {
      document.getElementById('nav-logout-btn').addEventListener('click', async () => {
        try {
          await fetchJSON('/api/auth/logout', { method: 'POST' });
        } finally {
          window.location.href = '/';
        }
      });
    }

    return status;
  }

  // 관리자 전용 페이지(글 편집/About 편집/로그/계정)에서 사용: 비로그인이면 로그인 페이지로 보낸다.
  function redirectIfNotAuthenticated(status) {
    if (!status || !status.authenticated) {
      window.location.href = '/admin/login';
      return true;
    }
    return false;
  }

  function sortPosts(posts, field, order) {
    const dir = order === 'asc' ? 1 : -1;
    const sorted = [...posts];

    sorted.sort((a, b) => {
      if (field === 'title') {
        return dir * a.title.localeCompare(b.title, 'ko');
      }
      const aTime = new Date(field === 'updated' ? a.updatedAt || a.publishedAt : a.publishedAt).getTime();
      const bTime = new Date(field === 'updated' ? b.updatedAt || b.publishedAt : b.publishedAt).getTime();
      return dir * (aTime - bTime);
    });

    return sorted;
  }

  // 정렬 드롭다운 2개(기준/방향)를 채워 넣고, 값이 바뀔 때마다 onChange(field, order)를 호출한다.
  // 서버에 다시 요청하지 않고 이미 받아온 목록을 그대로 다시 정렬하는 용도라 즉시 반영된다.
  function initSortControls(fieldElId, orderElId, onChange) {
    const $field = $(`#${fieldElId}`);
    const $order = $(`#${orderElId}`);
    const trigger = () => onChange($field.val(), $order.val());
    $field.on('change', trigger);
    $order.on('change', trigger);
  }

  async function renderCategoryDropdown(elId, activeSlug) {
    const el = document.getElementById(elId);
    if (!el) return;

    let categories = [];
    try {
      const data = await fetchJSON('/api/categories');
      categories = data.categories || [];
    } catch (e) {
      categories = [];
    }

    const options = [`<option value="">카테고리별 보기</option>`].concat(
      categories.map(
        (c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)} (${c.postCount})</option>`
      )
    );
    el.innerHTML = options.join('');
    el.value = activeSlug || '';

    el.addEventListener('change', () => {
      const val = el.value;
      window.location.href = val ? `/category?slug=${encodeURIComponent(val)}` : '/';
    });
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
      window.location.href = `/post?category=${encodeURIComponent(category)}&slug=${encodeURIComponent(slug)}`;
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
    renderCategoryDropdown,
    sortPosts,
    initSortControls,
    redirectIfNotAuthenticated,
    initThemeToggle,
    getCsrfToken,
    postCardHtml,
    bindPostCardNavigation,
  };
})(window);
