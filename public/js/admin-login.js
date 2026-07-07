(function () {
  $(async function () {
    Blog.initThemeToggle(document.getElementById('theme-select'));

    try {
      const status = await Blog.fetchJSON('/api/auth/status');
      if (status.authenticated) {
        window.location.href = '/';
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
        window.location.href = '/';
      } catch (err) {
        $('#login-error').text(err.message);
      }
    });
  });
})();
