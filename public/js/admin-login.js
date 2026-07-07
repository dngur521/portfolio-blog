(function () {
  $(async function () {
    try {
      const status = await Blog.fetchJSON('/api/auth/status');
      if (status.authenticated) {
        window.location.href = '/admin/editor.html';
        return;
      }
    } catch (err) {
      // 상태 확인 실패 시 로그인 폼을 그대로 노출
    }

    $('#login-form').on('submit', async function (e) {
      e.preventDefault();
      $('#login-error').text('');

      const username = $('#username').val().trim();
      const password = $('#password').val();

      try {
        await Blog.fetchJSON('/api/auth/login', {
          method: 'POST',
          body: { username, password },
        });
        window.location.href = '/admin/editor.html';
      } catch (err) {
        $('#login-error').text(err.message);
      }
    });
  });
})();
