(function () {
  function renderPost(post, isAuthenticated) {
    const tags = (post.tags || [])
      .map((t) => `<span class="tag-chip">#${Blog.escapeHtml(t)}</span>`)
      .join('');

    const safeHtml = Blog.renderMarkdown(post.content || '');

    const adminActionsHtml = isAuthenticated
      ? `
        <div class="post-admin-actions">
          <a class="btn btn-secondary" href="/admin/editor?category=${encodeURIComponent(post.category.slug)}&slug=${encodeURIComponent(post.slug)}">수정</a>
          <button class="btn btn-danger" id="delete-post-btn">삭제</button>
        </div>
      `
      : '';

    $('#post-container').html(`
      <div class="post-detail-header">
        <a class="cat-badge" href="/category?slug=${encodeURIComponent(post.category.slug)}">${Blog.escapeHtml(post.category.name)}</a>
        <h1>${Blog.escapeHtml(post.title)}</h1>
        <div class="post-meta">
          <span>작성일 ${Blog.formatDate(post.publishedAt)}</span>
        </div>
        <div class="tag-list">${tags}</div>
        ${adminActionsHtml}
      </div>
      <article class="post-body">${safeHtml}</article>
    `);

    if (window.hljs) {
      document.querySelectorAll('.post-body pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
    Blog.renderMermaidDiagrams('#post-container');

    if (isAuthenticated) {
      $('#delete-post-btn').on('click', async () => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        try {
          await Blog.fetchJSON(
            `/api/admin/posts/${encodeURIComponent(post.category.slug)}/${encodeURIComponent(post.slug)}`,
            { method: 'DELETE' }
          );
          Blog.showToast('글이 삭제되었습니다.', 'success');
          window.location.href = '/';
        } catch (err) {
          Blog.showToast(err.message, 'error');
        }
      });
    }
  }

  function renderNotFound() {
    $('#post-container').html('<div class="empty-state">글을 찾을 수 없습니다.</div>');
  }

  $(async function () {
    const category = Blog.qs('category') || '';
    const slug = Blog.qs('slug') || '';

    const [status, post] = await Promise.all([
      Blog.renderNav(),
      Blog.fetchJSON(`/api/posts/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`).catch(() => null),
    ]);

    if (post) {
      renderPost(post, status.authenticated);
    } else {
      renderNotFound();
    }
  });
})();
