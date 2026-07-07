#!/usr/bin/env node
// 독립 실행 CLI: Express 서버가 실행 중이지 않아도 동작한다.
const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const accountService = require('../services/accountService');

const SALT_ROUNDS = 12;

const KEY_ENTER = ['\n', '\r', ''];
const KEY_CTRL_C = '\u0003';
const KEY_BACKSPACE = '\u007f';

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const match = /^--([a-zA-Z-]+)=(.*)$/.exec(raw);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

// stdin이 TTY가 아닌 경우(파이프 등)에는 마스킹 없이 한 줄씩 읽는다.
// readline 인터페이스를 프롬프트마다 새로 만들면 이미 버퍼에 들어온 다음 줄 데이터를
// 잃어버릴 수 있으므로, 인터페이스 하나를 재사용해 순차적으로 question()을 호출한다.
function createPrompter() {
  const stdin = process.stdin;

  if (!stdin.isTTY) {
    // 파이프 입력은 EOF 시점에 따라 question()을 두 번째로 호출하기 전에
    // readline이 스트림 종료를 먼저 처리해버릴 수 있다. 이를 피하기 위해
    // stdin 전체를 먼저 읽어 줄 단위로 버퍼링한 뒤 순서대로 소비한다.
    let linesPromise = null;
    let cursor = 0;

    function readAllLines() {
      if (!linesPromise) {
        linesPromise = new Promise((resolve) => {
          let data = '';
          stdin.setEncoding('utf8');
          stdin.on('data', (chunk) => {
            data += chunk;
          });
          stdin.on('end', () => resolve(data.split('\n')));
        });
      }
      return linesPromise;
    }

    return {
      prompt: async (question) => {
        const lines = await readAllLines();
        const line = (lines[cursor] || '').trim();
        cursor += 1;
        return line;
      },
      close: () => {},
    };
  }

  function promptHidden(question) {
    return new Promise((resolve) => {
      process.stdout.write(question);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      let input = '';

      const onData = (char) => {
        char = char.toString('utf8');

        if (KEY_ENTER.includes(char)) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
          return;
        }

        if (char === KEY_CTRL_C) {
          process.stdout.write('\n');
          process.exit(1);
          return;
        }

        if (char === KEY_BACKSPACE) {
          input = input.slice(0, -1);
          return;
        }

        input += char;
      };

      stdin.on('data', onData);
    });
  }

  return { prompt: promptHidden, close: () => {} };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username;

  if (!username || !username.trim()) {
    console.error('사용법: npm run create-admin -- --username=<아이디> [--display-name=<표시이름>]');
    process.exitCode = 1;
    return;
  }
  if (username.length > 50) {
    console.error('아이디는 50자를 초과할 수 없습니다.');
    process.exitCode = 1;
    return;
  }

  const existing = await accountService.getByUsername(username);
  if (existing) {
    console.error(`이미 존재하는 아이디입니다: ${username}`);
    process.exitCode = 1;
    return;
  }

  const { prompt, close } = createPrompter();
  const password = await prompt('비밀번호: ');
  const passwordConfirm = await prompt('비밀번호 확인: ');
  close();

  if (!password || password.length < 8) {
    console.error('비밀번호는 8자 이상이어야 합니다.');
    process.exitCode = 1;
    return;
  }
  if (password !== passwordConfirm) {
    console.error('비밀번호가 일치하지 않습니다.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const created = await accountService.createAccount({
    username,
    passwordHash,
    displayName: args['display-name'] || username,
  });

  console.log(`관리자 계정이 생성되었습니다: id=${created.id}, username=${created.username}`);
}

main()
  .catch((err) => {
    console.error('관리자 계정 생성 중 오류가 발생했습니다:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
