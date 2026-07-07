(function () {
  async function loadCategoryTitle(slug) {
    try {
      const data = await Blog.fetchJSON('/api/categories');
      const category = (data.categories || []).find((c) => c.slug === slug);
      $('#category-title').text(category ? category.name : '카테고리');
    } catch (err) {
      $('#category-title').text('카테고리');
    }
  }

  async function loadPosts(slug) {
    const $list = $('#post-list');
    try {
      const data = await Blog.fetchJSON(`/api/posts?category=${encodeURIComponent(slug)}`);
      const posts = data.posts || [];
      if (posts.length === 0) {
        $list.html('<div class="empty-state">아직 글이 없습니다.</div>');
        return;
      }
      $list.html(posts.map(Blog.postCardHtml).join(''));
    } catch (err) {
      $list.html('<div class="empty-state">글 목록을 불러오지 못했습니다.</div>');
    }
  }

  $(async function () {
    const slug = Blog.qs('slug') || '';
    Blog.bindPostCardNavigation('#post-list');
    await Blog.renderNav(slug);
    await loadCategoryTitle(slug);
    await loadPosts(slug);
  });
})();
