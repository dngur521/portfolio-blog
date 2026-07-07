(function () {
  $(async function () {
    const [status, about] = await Promise.all([
      Blog.renderNav('about'),
      Blog.fetchJSON('/api/about').catch(() => null),
    ]);

    if (!about) {
      $('#about-container').html('<div class="empty-state">소개글을 불러오지 못했습니다.</div>');
      return;
    }

    const editButtonHtml = status.authenticated
      ? '<a class="btn btn-secondary" href="/admin/about">수정</a>'
      : '';
    const safeHtml = DOMPurify.sanitize(marked.parse(about.content || ''));
    $('#about-container').html(`
      <div class="page-header">
        <h1 class="page-title">About me</h1>
        ${editButtonHtml}
      </div>
      <article class="post-body">${safeHtml}</article>
    `);
  });
})();
