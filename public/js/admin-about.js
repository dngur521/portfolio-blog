(function () {
  $(async function () {
    const status = await Blog.renderNav('about');
    if (Blog.redirectIfNotAuthenticated(status)) return;

    // 에디터 생성(무거운 DOM 작업)과 기존 글 조회를 동시에 진행한다.
    const aboutPromise = Blog.fetchJSON('/api/about').catch((err) => {
      Blog.showToast(err.message, 'error');
      return { content: '' };
    });

    const editor = new toastui.Editor({
      el: document.querySelector('#toastui-editor'),
      height: '520px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
    });

    const about = await aboutPromise;
    editor.setMarkdown(about.content || '');

    $('#save-btn').on('click', async () => {
      $('#about-error').text('');
      try {
        await Blog.fetchJSON('/api/admin/about', {
          method: 'PUT',
          body: { content: editor.getMarkdown() },
        });
        Blog.showToast('About 소개글이 저장되었습니다.', 'success');
        window.location.href = '/about';
      } catch (err) {
        $('#about-error').text(err.message);
      }
    });
  });
})();
