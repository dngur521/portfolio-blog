(function () {
  async function toggleActive(id, nextActive) {
    try {
      await Blog.fetchJSON(`/api/admin/accounts/${id}`, {
        method: 'PATCH',
        body: { isActive: nextActive },
      });
      Blog.showToast('계정 상태가 변경되었습니다.', 'success');
      await loadAccounts();
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }
  }

  async function loadAccounts() {
    const $tbody = $('#accounts-table-body');
    try {
      const data = await Blog.fetchJSON('/api/admin/accounts');
      const accounts = data.accounts || [];
      $tbody.empty();

      accounts.forEach((account) => {
        const $tr = $('<tr>');
        $tr.append($('<td>').text(account.username));
        $tr.append($('<td>').text(account.displayName || ''));

        const $toggle = $('<button>')
          .addClass('btn account-toggle')
          .addClass(account.isActive ? '' : 'btn-secondary')
          .text(account.isActive ? '활성' : '비활성')
          .on('click', () => toggleActive(account.id, !account.isActive));
        $tr.append($('<td>').append($toggle));

        $tr.append($('<td>').text(Blog.formatDate(account.createdAt)));
        $tbody.append($tr);
      });
    } catch (err) {
      $tbody.html('<tr><td colspan="4" class="empty-state">계정 목록을 불러오지 못했습니다.</td></tr>');
    }
  }

  $(async function () {
    const status = await Blog.renderNav('accounts');
    if (Blog.redirectIfNotAuthenticated(status)) return;
    await loadAccounts();
  });
})();
