(function () {
  let changes = [];

  const STATUS_LABELS = { new: '신규', modified: '수정', deleted: '삭제' };

  function describe(change) {
    if (change.path === 'content/about.md') return 'About 페이지';
    const m = /^posts\/([^/]+)\/([^/]+)\.md$/.exec(change.path);
    return m ? `${m[1]} / ${m[2]}` : change.path;
  }

  function renderChanges() {
    const $list = $('#git-change-list');
    if (changes.length === 0) {
      $list.html('<div class="empty-state">커밋할 변경 사항이 없습니다.</div>');
      $('#git-commit-panel').hide();
      return;
    }

    $list.html(
      changes
        .map(
          (c, i) => `
        <label class="git-change-row">
          <input type="checkbox" class="git-change-checkbox" data-index="${i}" checked />
          <span class="git-change-status git-status-${c.status}">${STATUS_LABELS[c.status] || c.status}</span>
          <span class="git-change-path">${Blog.escapeHtml(describe(c))}</span>
        </label>
      `
        )
        .join('')
    );
    $('#git-commit-panel').show();
  }

  function selectedPaths() {
    return $('.git-change-checkbox:checked')
      .map(function () {
        return changes[$(this).data('index')].path;
      })
      .get();
  }

  async function loadStatus() {
    try {
      const data = await Blog.fetchJSON('/api/admin/git/status');
      changes = data.changes || [];
      renderChanges();
    } catch (err) {
      $('#git-change-list').html(`<div class="empty-state">${Blog.escapeHtml(err.message)}</div>`);
    }
  }

  async function handleSuggest() {
    const paths = selectedPaths();
    if (paths.length === 0) {
      $('#git-commit-status').text('선택된 항목이 없습니다.');
      return;
    }
    const $msg = $('#git-commit-message');
    $msg.val('추천 메시지를 불러오는 중...').prop('disabled', true);
    $('#git-commit-status').text('');
    try {
      const { message } = await Blog.fetchJSON('/api/admin/git/suggest-message', {
        method: 'POST',
        body: { paths },
      });
      $msg.val(message);
    } catch (err) {
      $msg.val('');
      $('#git-commit-status').text('추천 메시지를 불러오지 못했습니다: ' + err.message);
    } finally {
      $msg.prop('disabled', false);
    }
  }

  async function handleCommit() {
    const paths = selectedPaths();
    const message = $('#git-commit-message').val().trim();
    if (paths.length === 0) {
      $('#git-commit-status').text('선택된 항목이 없습니다.');
      return;
    }
    if (!message) {
      $('#git-commit-status').text('커밋 메시지를 입력해주세요.');
      return;
    }
    $('#git-commit-btn').prop('disabled', true);
    $('#git-commit-status').text('커밋 & 푸시 중...');
    try {
      await Blog.fetchJSON('/api/admin/git/commit-push', {
        method: 'POST',
        body: { paths, message },
      });
      Blog.showToast('커밋 & 푸시 완료.', 'success');
      $('#git-commit-message').val('');
      await loadStatus();
    } catch (err) {
      $('#git-commit-status').text(err.message);
    } finally {
      $('#git-commit-btn').prop('disabled', false);
    }
  }

  $(async function () {
    const status = await Blog.renderNav('git');
    if (Blog.redirectIfNotAuthenticated(status)) return;

    $('#git-suggest-btn').on('click', handleSuggest);
    $('#git-commit-btn').on('click', handleCommit);

    await loadStatus();
  });
})();
