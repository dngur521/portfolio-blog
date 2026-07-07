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
    // 관리자 글쓰기 화면에서는 방금 만든 빈 카테고리도 선택할 수 있어야 하므로 전부 불러온다.
    const data = await Blog.fetchJSON('/api/categories?includeEmpty=1');
    categories = data.categories || [];
    const $select = $('#post-category');
    $select.empty();
    categories.forEach((c) => {
      $select.append(`<option value="${Blog.escapeHtml(c.slug)}">${Blog.escapeHtml(c.name)}</option>`);
    });
    $select.append('<option value="__new__">+ 새 카테고리 만들기</option>');
    if (selected) $select.val(selected);
    updateDeleteCategoryButtonVisibility();
  }

  function updateDeleteCategoryButtonVisibility() {
    const value = $('#post-category').val();
    const isRealCategory = value && value !== '__new__';
    $('#delete-category-btn').toggle(Boolean(isRealCategory));
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
      hideNewCategoryForm();
      updateDeleteCategoryButtonVisibility();
      $('#post-tags').val((post.tags || []).join(', '));
      editor.setMarkdown(post.content || '');
      $('#delete-btn').show();
    } catch (err) {
      Blog.showToast('글을 불러오지 못했습니다: ' + err.message, 'error');
      window.location.href = '/';
    }
  }

  function categorySlugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function showNewCategoryForm() {
    $('#new-category-form').show();
    $('#new-category-slug').val('');
    $('#new-category-name').val('').focus();
  }

  function hideNewCategoryForm() {
    $('#new-category-form').hide();
  }

  function handleCategoryChange() {
    if ($('#post-category').val() === '__new__') {
      showNewCategoryForm();
    } else {
      hideNewCategoryForm();
    }
    updateDeleteCategoryButtonVisibility();
  }

  async function handleDeleteCategory() {
    const slug = $('#post-category').val();
    if (!slug || slug === '__new__') return;

    const category = categories.find((c) => c.slug === slug);
    const label = category ? category.name : slug;
    if (!window.confirm(`"${label}" 카테고리를 삭제하시겠습니까? (글이 있으면 삭제되지 않습니다)`)) return;

    try {
      await Blog.fetchJSON(`/api/admin/categories/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      Blog.showToast('카테고리가 삭제되었습니다.', 'success');
      await loadCategories();
      if ($('#post-category').val() === '__new__') {
        showNewCategoryForm();
      }
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }
  }

  async function handleCreateCategory() {
    const slug = $('#new-category-slug').val().trim();
    const name = $('#new-category-name').val().trim();

    if (!slug || !name) {
      Blog.showToast('카테고리 slug와 이름을 모두 입력해주세요.', 'error');
      return;
    }

    try {
      await Blog.fetchJSON('/api/admin/categories', { method: 'POST', body: { slug, name } });
      await loadCategories(slug);
      hideNewCategoryForm();
      Blog.showToast('카테고리가 생성되었습니다.', 'success');
    } catch (err) {
      Blog.showToast(err.message, 'error');
    }
  }

  function handleCancelNewCategory() {
    if (categories.length === 0) {
      // 카테고리가 하나도 없으면 취소해도 선택할 다른 옵션이 없으므로 폼을 다시 보여준다.
      showNewCategoryForm();
      return;
    }
    hideNewCategoryForm();
    $('#post-category').val(categories[0].slug);
    updateDeleteCategoryButtonVisibility();
  }

  let savedPost = null;

  function goToSavedPost() {
    window.location.href = `/post?category=${encodeURIComponent(savedPost.category.slug)}&slug=${encodeURIComponent(savedPost.slug)}`;
  }

  async function showGitCommitPanel(changeType) {
    $('#git-commit-panel').show();
    $('#git-commit-status').text('');
    $('#git-commit-btn').prop('disabled', false);
    const $msg = $('#git-commit-message');
    $msg.val('추천 메시지를 불러오는 중...').prop('disabled', true);
    try {
      const { message } = await Blog.fetchJSON('/api/admin/git/suggest-message', {
        method: 'POST',
        body: { category: savedPost.category.slug, slug: savedPost.slug, changeType },
      });
      $msg.val(message);
    } catch (err) {
      $msg.val('');
      $('#git-commit-status').text('추천 메시지를 불러오지 못했습니다: ' + err.message);
    } finally {
      $msg.prop('disabled', false);
    }
  }

  async function handleGitCommit() {
    const message = $('#git-commit-message').val().trim();
    if (!message) {
      $('#git-commit-status').text('커밋 메시지를 입력해주세요.');
      return;
    }
    $('#git-commit-btn').prop('disabled', true);
    $('#git-commit-status').text('커밋 & 푸시 중...');
    try {
      await Blog.fetchJSON('/api/admin/git/commit-push', {
        method: 'POST',
        body: { category: savedPost.category.slug, slug: savedPost.slug, message },
      });
      Blog.showToast('커밋 & 푸시 완료.', 'success');
      goToSavedPost();
    } catch (err) {
      $('#git-commit-status').text(err.message);
      $('#git-commit-btn').prop('disabled', false);
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
      let changeType;
      if (mode === 'create') {
        const slug = slugify(title);
        result = await Blog.fetchJSON('/api/admin/posts', {
          method: 'POST',
          body: { title, category, slug, tags, content },
        });
        changeType = 'create';
        Blog.showToast('글이 저장되었습니다.', 'success');
      } else {
        result = await Blog.fetchJSON(
          `/api/admin/posts/${encodeURIComponent(editingCategory)}/${encodeURIComponent(editingSlug)}`,
          { method: 'PUT', body: { title, category, tags, content } }
        );
        changeType = 'update';
        Blog.showToast('글이 수정되었습니다.', 'success');
      }
      savedPost = result;
      await showGitCommitPanel(changeType);
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
    const status = await Blog.renderNav('editor');
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

    // 카테고리가 하나도 없으면 드롭다운에 "+ 새 카테고리 만들기"만 남으므로,
    // change 이벤트를 기다리지 않고 바로 입력 폼을 보여준다.
    if ($('#post-category').val() === '__new__') {
      showNewCategoryForm();
    }

    $('#new-category-name').on('input', function () {
      const $slugInput = $('#new-category-slug');
      if (!$slugInput.data('touched')) {
        $slugInput.val(categorySlugify($(this).val()));
      }
    });
    $('#new-category-slug').on('input', function () {
      $(this).data('touched', true);
    });

    $('#post-category').on('change', handleCategoryChange);
    $('#delete-category-btn').on('click', handleDeleteCategory);
    $('#new-category-confirm').on('click', handleCreateCategory);
    $('#new-category-cancel').on('click', handleCancelNewCategory);
    $('#save-btn').on('click', handleSave);
    $('#delete-btn').on('click', handleDelete);
    $('#git-commit-btn').on('click', handleGitCommit);
    $('#git-skip-btn').on('click', goToSavedPost);
  });
})();
