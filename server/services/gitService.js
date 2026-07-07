const { execFile } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function run(args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: PROJECT_ROOT, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function getStatus(paths) {
  const { stdout } = await run(['status', '--porcelain', '--', ...paths]);
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const file = line.slice(3);
      let status = 'modified';
      if (code.includes('?')) status = 'new';
      else if (code.includes('D')) status = 'deleted';
      return { path: file, status };
    });
}

// filePaths는 항상 호출하는 쪽(routes/adminGit.js)이 safeResolve로 검증한 posts/ 하위 상대경로만 넘긴다.
// 커밋 범위를 그 경로들로 한정해서(-- pathspec), 배포 중인 저장소에 그 순간 우연히 staged된
// 다른 변경사항이 있더라도 함께 커밋되지 않게 한다.
async function commitAndPush({ filePaths, message }) {
  const { stdout: statusOut } = await run(['status', '--porcelain', '--', ...filePaths]);
  if (!statusOut.trim()) {
    const err = new Error('커밋할 변경 사항이 없습니다.');
    err.status = 400;
    throw err;
  }

  await run(['add', '--', ...filePaths]);

  try {
    await run(['commit', '-m', message, '--', ...filePaths]);
  } catch (err) {
    const err2 = new Error(`git commit 실패: ${(err.stderr || err.message || '').trim()}`);
    err2.status = 500;
    throw err2;
  }

  try {
    await run(['push']);
  } catch (err) {
    const err2 = new Error(`커밋은 됐지만 push에 실패했습니다: ${(err.stderr || err.message || '').trim()}`);
    err2.status = 502;
    throw err2;
  }

  const { stdout: hashOut } = await run(['rev-parse', 'HEAD']);
  return { commitHash: hashOut.trim() };
}

module.exports = { getStatus, commitAndPush };
