(function () {
  async function loadPosts() {
    const $list = $('#post-list');
    try {
      const data = await Blog.fetchJSON('/api/posts');
      const posts = data.posts || [];
      if (posts.length === 0) {
        $list.html('<div class="empty-state">아직 작성된 글이 없습니다.</div>');
        return;
      }
      $list.html(posts.map(Blog.postCardHtml).join(''));
    } catch (err) {
      $list.html('<div class="empty-state">글 목록을 불러오지 못했습니다.</div>');
    }
  }

  $(async function () {
    Blog.bindPostCardNavigation('#post-list');
    const status = await Blog.renderNav(null, 'all');
    if (status.authenticated) $('#write-post-btn').show();
    await Blog.renderCategoryDropdown('category-filter', '');
    await loadPosts();
  });
})();
