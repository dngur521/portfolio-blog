const path = require('path');

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function isValidSlug(value) {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

function assertValidSlug(value, label = 'slug') {
  if (!isValidSlug(value)) {
    const err = new Error(`유효하지 않은 ${label} 형식입니다.`);
    err.status = 400;
    throw err;
  }
}

// baseDir 하위로만 경로를 조립하도록 강제한다 (path traversal 방지).
// segments는 이미 slug 화이트리스트 검증을 통과한 값이어야 한다.
function safeResolve(baseDir, ...segments) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, ...segments);
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const err = new Error('허용되지 않은 경로입니다.');
    err.status = 400;
    throw err;
  }
  return resolvedTarget;
}

module.exports = { isValidSlug, assertValidSlug, safeResolve, SLUG_PATTERN };
