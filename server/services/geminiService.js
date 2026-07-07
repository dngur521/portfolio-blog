const env = require('../config/env');

function buildPrompt(items) {
  const fileSummaries = items
    .map(({ path: relPath, content }) => {
      if (content == null) return `- 삭제됨: ${relPath}`;
      return `- 변경됨: ${relPath}\n  내용 일부:\n${content.slice(0, 1500)}`;
    })
    .join('\n\n');

  return [
    '너는 이 개인 블로그 프로젝트의 git 커밋 메시지를 작성해주는 도우미다.',
    '이 저장소의 커밋 메시지 컨벤션은 "<이모지> <종류>: <한 줄 요약>" 형식이다.',
    '예시: "✨ feat: About 페이지 다크모드 지원 추가", "🔒 fix: 서버 바인딩을 127.0.0.1로 제한", "📝 docs: README 업데이트".',
    '이번에 커밋할 변경 사항들:',
    fileSummaries,
    '',
    '위 컨벤션에 맞는 커밋 메시지를 딱 한 줄, 한국어로 추천해라 (파일이 여러 개면 전체를 아우르는 요약으로).',
    '이모지 하나 + 공백 + 종류(feat/docs/fix/chore 중 가장 알맞은 것) + ": " + 간결한 요약 형태로만 답하고,',
    '다른 설명, 따옴표, 코드블록 없이 그 한 줄만 출력해라.',
  ].join('\n');
}

async function suggestCommitMessage(items) {
  if (!env.geminiApiKey) {
    const err = new Error('Gemini API 키가 설정되어 있지 않습니다.');
    err.status = 500;
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(items) }] }],
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = (data && data.error && data.error.message) || `Gemini API 오류 (${res.status})`;
    const err = new Error(message);
    err.status = 502;
    throw err;
  }

  const text = data && data.candidates && data.candidates[0]
    && data.candidates[0].content && data.candidates[0].content.parts
    && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

  if (!text || !text.trim()) {
    const err = new Error('Gemini가 커밋 메시지를 생성하지 못했습니다.');
    err.status = 502;
    throw err;
  }

  return text.trim().split('\n')[0].trim();
}

module.exports = { suggestCommitMessage };
