(function () {
  function renderPost(post) {
    const tags = (post.tags || [])
      .map((t) => `<span class="tag-chip">#${Blog.escapeHtml(t)}</span>`)
      .join('');

    const rawHtml = marked.parse(post.content || '');
    const safeHtml = DOMPurify.sanitize(rawHtml);

    $('#post-container').html(`
      <div class="post-detail-header">
        <a class="cat-badge" href="/category.html?slug=${encodeURIComponent(post.category.slug)}">${Blog.escapeHtml(post.category.name)}</a>
        <h1>${Blog.escapeHtml(post.title)}</h1>
        <div class="post-meta">
          <span>작성일 ${Blog.formatDate(post.publishedAt)}</span>
        </div>
        <div class="tag-list">${tags}</div>
      </div>
      <article class="post-body">${safeHtml}</article>
    `);

    if (window.hljs) {
      document.querySelectorAll('.post-body pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  }

  function renderNotFound() {
    $('#post-container').html('<div class="empty-state">글을 찾을 수 없습니다.</div>');
  }

  $(async function () {
    const category = Blog.qs('category') || '';
    const slug = Blog.qs('slug') || '';

    await Blog.renderNav(category);

    try {
      const post = await Blog.fetchJSON(`/api/posts/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`);
      renderPost(post);
    } catch (err) {
      renderNotFound();
    }
  });
})();
