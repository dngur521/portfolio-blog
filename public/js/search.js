(function () {
  function resultCardHtml(result) {
    return `
      <div class="post-card" data-category="${Blog.escapeHtml(result.category.slug)}" data-slug="${Blog.escapeHtml(result.slug)}">
        <span class="cat-badge">${Blog.escapeHtml(result.category.name)}</span>
        <h3>${Blog.escapeHtml(result.title)}</h3>
        <div class="search-snippet">${Blog.escapeHtml(result.snippet)}</div>
      </div>
    `;
  }

  async function runSearch(q) {
    const $results = $('#search-results');
    const $title = $('#search-title');

    if (!q) {
      $title.text('검색');
      $results.html('<div class="empty-state">검색어를 입력해주세요.</div>');
      return;
    }

    $title.text(`"${q}" 검색 결과`);

    try {
      const data = await Blog.fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
      const results = data.results || [];
      if (results.length === 0) {
        $results.html('<div class="empty-state">검색 결과가 없습니다.</div>');
        return;
      }
      $results.html(results.map(resultCardHtml).join(''));
    } catch (err) {
      $results.html(`<div class="empty-state">${Blog.escapeHtml(err.message)}</div>`);
    }
  }

  $(async function () {
    const q = Blog.qs('q') || '';
    Blog.bindPostCardNavigation('#search-results');
    await Promise.all([Blog.renderNav(), runSearch(q)]);
    $('#nav-search-input').val(q);
  });
})();
