(function () {
  $(async function () {
    const status = await Blog.renderNav(null, 'about');
    if (Blog.redirectIfNotAuthenticated(status)) return;

    let initialContent = '';
    try {
      const about = await Blog.fetchJSON('/api/about');
      initialContent = about.content || '';
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }

    const editor = new toastui.Editor({
      el: document.querySelector('#toastui-editor'),
      height: '520px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      initialValue: initialContent,
    });

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
