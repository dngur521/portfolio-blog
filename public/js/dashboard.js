(function () {
  let cachedPosts = [];
  let currentPage = 1;

  function renderPosts() {
    const $list = $('#post-list');
    if (cachedPosts.length === 0) {
      $list.html('<div class="empty-state">아직 작성된 글이 없습니다.</div>');
      $('#post-pagination').empty();
      return;
    }
    const sorted = Blog.sortPosts(cachedPosts, $('#sort-field').val(), $('#sort-order').val());
    const pageSize = parseInt($('#page-size').val(), 10) || 10;
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * pageSize;
    $list.html(sorted.slice(start, start + pageSize).map(Blog.postCardHtml).join(''));
    Blog.renderPagination('post-pagination', {
      page: currentPage,
      totalPages,
      onChange: (page) => {
        currentPage = page;
        renderPosts();
      },
    });
  }

  function renderFromStart() {
    currentPage = 1;
    renderPosts();
  }

  async function loadPosts() {
    try {
      const data = await Blog.fetchJSON('/api/posts');
      cachedPosts = data.posts || [];
      renderFromStart();
    } catch (err) {
      $('#post-list').html('<div class="empty-state">글 목록을 불러오지 못했습니다.</div>');
    }
  }

  $(async function () {
    Blog.bindPostCardNavigation('#post-list');
    Blog.initSortControls('sort-field', 'sort-order', renderFromStart);
    $('#page-size').on('change', renderFromStart);

    // 서로 무관한 요청들이라 병렬로 보내 초기 로딩 시간을 줄인다.
    const [status] = await Promise.all([
      Blog.renderNav('all'),
      Blog.renderCategoryDropdown('category-filter', ''),
      loadPosts(),
    ]);
    if (status.authenticated) $('#write-post-btn').show();
  });
})();
