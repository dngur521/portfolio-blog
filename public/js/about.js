(function () {
  $(async function () {
    await Blog.renderNav(null, 'about');

    try {
      const about = await Blog.fetchJSON('/api/about');
      const safeHtml = DOMPurify.sanitize(marked.parse(about.content || ''));
      $('#about-container').html(`
        <h1 class="page-title">About me</h1>
        <article class="post-body">${safeHtml}</article>
      `);
    } catch (err) {
      $('#about-container').html('<div class="empty-state">소개글을 불러오지 못했습니다.</div>');
    }
  });
})();
