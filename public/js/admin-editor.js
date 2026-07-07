(function () {
  let editor;
  let categories = [];
  let mode = 'create';
  let editingCategory = null;
  let editingSlug = null;

  function slugify(text) {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return base || `post-${Date.now()}`;
  }

  async function loadCategories(selected) {
    const data = await Blog.fetchJSON('/api/categories');
    categories = data.categories || [];
    const $select = $('#post-category');
    $select.empty();
    categories.forEach((c) => {
      $select.append(`<option value="${Blog.escapeHtml(c.slug)}">${Blog.escapeHtml(c.name)}</option>`);
    });
    $select.append('<option value="__new__">+ 새 카테고리 만들기</option>');
    if (selected) $select.val(selected);
  }

  async function loadPostIntoEditor(categorySlug, slug) {
    try {
      const post = await Blog.fetchJSON(`/api/posts/${encodeURIComponent(categorySlug)}/${encodeURIComponent(slug)}`);
      mode = 'edit';
      editingCategory = categorySlug;
      editingSlug = slug;
      $('#editor-heading').text('글 수정');
      $('#post-title').val(post.title);
      $('#post-category').val(post.category.slug);
      $('#post-tags').val((post.tags || []).join(', '));
      editor.setMarkdown(post.content || '');
      $('#delete-btn').show();
    } catch (err) {
      Blog.showToast('글을 불러오지 못했습니다: ' + err.message, 'error');
      window.location.href = '/';
    }
  }

  async function handleCategoryChange() {
    if ($('#post-category').val() !== '__new__') return;

    const fallback = categories[0] ? categories[0].slug : '';
    const slug = window.prompt('새 카테고리 slug (영문 소문자/숫자/하이픈만):');
    if (!slug) {
      $('#post-category').val(fallback);
      return;
    }
    const name = window.prompt('카테고리 이름:');
    if (!name) {
      $('#post-category').val(fallback);
      return;
    }

    try {
      await Blog.fetchJSON('/api/admin/categories', { method: 'POST', body: { slug, name } });
      await loadCategories(slug);
      Blog.showToast('카테고리가 생성되었습니다.', 'success');
    } catch (err) {
      Blog.showToast(err.message, 'error');
      await loadCategories(fallback);
    }
  }

  async function handleSave() {
    $('#editor-error').text('');
    const title = $('#post-title').val().trim();
    const category = $('#post-category').val();
    const tags = $('#post-tags')
      .val()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const content = editor.getMarkdown();

    if (!title) {
      $('#editor-error').text('제목을 입력해주세요.');
      return;
    }
    if (!category || category === '__new__') {
      $('#editor-error').text('카테고리를 선택해주세요.');
      return;
    }

    try {
      let result;
      if (mode === 'create') {
        const slug = slugify(title);
        result = await Blog.fetchJSON('/api/admin/posts', {
          method: 'POST',
          body: { title, category, slug, tags, content },
        });
        Blog.showToast('글이 저장되었습니다.', 'success');
      } else {
        result = await Blog.fetchJSON(
          `/api/admin/posts/${encodeURIComponent(editingCategory)}/${encodeURIComponent(editingSlug)}`,
          { method: 'PUT', body: { title, category, tags, content } }
        );
        Blog.showToast('글이 수정되었습니다.', 'success');
      }
      window.location.href = `/post.html?category=${encodeURIComponent(result.category.slug)}&slug=${encodeURIComponent(result.slug)}`;
    } catch (err) {
      $('#editor-error').text(err.message);
    }
  }

  async function handleDelete() {
    if (!editingCategory || !editingSlug) return;
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await Blog.fetchJSON(
        `/api/admin/posts/${encodeURIComponent(editingCategory)}/${encodeURIComponent(editingSlug)}`,
        { method: 'DELETE' }
      );
      Blog.showToast('글이 삭제되었습니다.', 'success');
      window.location.href = '/';
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }
  }

  async function handleImageUpload(blob, callback) {
    try {
      Blog.showToast('이미지 업로드 중...', 'success');
      const formData = new FormData();
      formData.append('image', blob, blob.name || 'image.png');
      const result = await Blog.fetchJSON('/api/admin/uploads', { method: 'POST', body: formData });
      callback(result.url, blob.name || 'image');
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }
  }

  $(async function () {
    const status = await Blog.renderNav(null, 'editor');
    if (Blog.redirectIfNotAuthenticated(status)) return;

    editor = new toastui.Editor({
      el: document.querySelector('#toastui-editor'),
      height: '520px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      hooks: {
        addImageBlobHook: handleImageUpload,
      },
    });

    const category = Blog.qs('category');
    const slug = Blog.qs('slug');

    await loadCategories();

    if (category && slug) {
      await loadPostIntoEditor(category, slug);
    }

    $('#post-category').on('change', handleCategoryChange);
    $('#save-btn').on('click', handleSave);
    $('#delete-btn').on('click', handleDelete);
  });
})();
