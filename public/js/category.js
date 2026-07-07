(function () {
  let cachedPosts = [];

  async function loadCategoryTitle(slug) {
    try {
      const data = await Blog.fetchJSON('/api/categories');
      const category = (data.categories || []).find((c) => c.slug === slug);
      $('#category-title').text(category ? category.name : '카테고리');
    } catch (err) {
      $('#category-title').text('카테고리');
    }
  }

  function renderPosts() {
    const $list = $('#post-list');
    if (cachedPosts.length === 0) {
      $list.html('<div class="empty-state">아직 글이 없습니다.</div>');
      return;
    }
    const sorted = Blog.sortPosts(cachedPosts, $('#sort-field').val(), $('#sort-order').val());
    $list.html(sorted.map(Blog.postCardHtml).join(''));
  }

  async function loadPosts(slug) {
    try {
      const data = await Blog.fetchJSON(`/api/posts?category=${encodeURIComponent(slug)}`);
      cachedPosts = data.posts || [];
      renderPosts();
    } catch (err) {
      $('#post-list').html('<div class="empty-state">글 목록을 불러오지 못했습니다.</div>');
    }
  }

  $(async function () {
    const slug = Blog.qs('slug') || '';
    Blog.bindPostCardNavigation('#post-list');
    Blog.initSortControls('sort-field', 'sort-order', renderPosts);

    // 서로 무관한 요청들이라 병렬로 보내 초기 로딩 시간을 줄인다.
    const [status] = await Promise.all([
      Blog.renderNav(),
      Blog.renderCategoryDropdown('category-filter', slug),
      loadCategoryTitle(slug),
      loadPosts(slug),
    ]);
    if (status.authenticated) $('#write-post-btn').show();
  });
})();
