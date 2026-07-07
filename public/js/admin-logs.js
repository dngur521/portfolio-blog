(function () {
  const EVENT_LABELS = { LOGIN_SUCCESS: '성공', LOGIN_FAIL: '실패', LOGOUT: '로그아웃' };
  const ALERT_WINDOW_MS = 60 * 1000;

  async function loadAccountsFilter() {
    const data = await Blog.fetchJSON('/api/admin/accounts');
    const $select = $('#filter-username');
    (data.accounts || []).forEach((a) => {
      $select.append(`<option value="${Blog.escapeHtml(a.username)}">${Blog.escapeHtml(a.username)}</option>`);
    });
  }

  function computeAlertIds(logs) {
    const alertIds = new Set();
    const lastFailByUser = {};
    // 오래된 순으로 훑어야 "짧은 시간 내 다수 발생"을 정확히 감지할 수 있다.
    [...logs].reverse().forEach((log) => {
      if (log.event !== 'LOGIN_FAIL') return;
      const t = new Date(log.createdAt).getTime();
      const prevLog = lastFailByUser[log.username];
      if (prevLog && t - new Date(prevLog.createdAt).getTime() < ALERT_WINDOW_MS) {
        alertIds.add(log.id);
        alertIds.add(prevLog.id);
      }
      lastFailByUser[log.username] = log;
    });
    return alertIds;
  }

  function renderTable(logs) {
    const $tbody = $('#log-table-body');
    $tbody.empty();

    if (logs.length === 0) {
      $tbody.append('<tr><td colspan="6" class="empty-state">기록이 없습니다.</td></tr>');
      return;
    }

    const alertIds = computeAlertIds(logs);

    logs.forEach((log) => {
      const $tr = $('<tr>');
      if (alertIds.has(log.id)) $tr.addClass('alert-row');
      $tr.append($('<td>').text(Blog.formatDateTime(log.createdAt)));
      $tr.append($('<td>').text(log.username));
      $tr.append($('<td>').text(EVENT_LABELS[log.event] || log.event));
      $tr.append($('<td>').text(log.ip));
      $tr.append($('<td>').text(log.userAgent || ''));
      $tr.append($('<td>').text(log.reason || ''));
      $tbody.append($tr);
    });
  }

  function renderPagination(page, totalPages) {
    const $pg = $('#log-pagination');
    $pg.empty();

    const $prev = $('<button class="btn btn-secondary">이전</button>').prop('disabled', page <= 1);
    $prev.on('click', () => loadLogs(page - 1));

    const $info = $(`<span>${page} / ${totalPages}</span>`);

    const $next = $('<button class="btn btn-secondary">다음</button>').prop('disabled', page >= totalPages);
    $next.on('click', () => loadLogs(page + 1));

    $pg.append($prev, $info, $next);
  }

  async function loadLogs(page) {
    const username = $('#filter-username').val();
    const event = $('#filter-event').val();
    const params = new URLSearchParams();
    if (username) params.set('username', username);
    if (event) params.set('event', event);
    params.set('page', page);
    params.set('limit', 50);

    try {
      const data = await Blog.fetchJSON(`/api/admin/logs?${params.toString()}`);
      renderTable(data.logs || []);
      renderPagination(data.page, data.totalPages);
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }
  }

  $(async function () {
    const status = await Blog.renderNav('logs');
    if (Blog.redirectIfNotAuthenticated(status)) return;

    await loadAccountsFilter();
    $('#filter-username, #filter-event').on('change', () => loadLogs(1));
    await loadLogs(1);
  });
})();
