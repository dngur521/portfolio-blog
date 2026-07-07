(function () {
  let cachedPosts = [];

  function renderPosts() {
    const $list = $('#post-list');
    if (cachedPosts.length === 0) {
      $list.html('<div class="empty-state">아직 작성된 글이 없습니다.</div>');
      return;
    }
    const sorted = Blog.sortPosts(cachedPosts, $('#sort-field').val(), $('#sort-order').val());
    $list.html(sorted.map(Blog.postCardHtml).join(''));
  }

  async function loadPosts() {
    try {
      const data = await Blog.fetchJSON('/api/posts');
      cachedPosts = data.posts || [];
      renderPosts();
    } catch (err) {
      $('#post-list').html('<div class="empty-state">글 목록을 불러오지 못했습니다.</div>');
    }
  }

  $(async function () {
    Blog.bindPostCardNavigation('#post-list');
    Blog.initSortControls('sort-field', 'sort-order', renderPosts);

    // 서로 무관한 요청들이라 병렬로 보내 초기 로딩 시간을 줄인다.
    const [status] = await Promise.all([
      Blog.renderNav('all'),
      Blog.renderCategoryDropdown('category-filter', ''),
      loadPosts(),
    ]);
    if (status.authenticated) $('#write-post-btn').show();
  });
})();
