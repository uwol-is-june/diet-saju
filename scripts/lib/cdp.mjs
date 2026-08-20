/**
 * 헤드리스 크로미움을 띄우고 CDP 에 붙는 최소 도구 (TASK-87 에서 분리).
 *
 * `scripts/screenshot.mjs` 가 쓰던 것을 그대로 옮겼다. 두 번째 사용처(`measure-load.mjs`)가
 * 생겼는데 그 파일은 **import 만 해도 촬영이 시작되는** 구조라 재사용할 수 없었다 —
 * 실행부는 각자 두고 플러밍만 여기로 뺀다.
 *
 * **의존성이 없다.** Node 21+ 의 전역 `WebSocket` 으로 CDP 에 직접 붙는다
 * (`scripts/render-icons.mjs` 가 playwright 를 상시 의존성으로 두지 않는 것과 같은 판단).
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

export function findBrowser() {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      "크로미움을 찾지 못했습니다. CHROMIUM_PATH 로 실행 파일 위치를 알려 주세요.",
    );
  }
  return found;
}

export async function waitFor(check, { timeout = 15000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("시간 초과");
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * CDP 는 요청마다 id 를 매기고 같은 id 로 답이 온다. 최소한의 짝 맞추기와, 이벤트를
 * 구독할 수 있는 `on` 만 둔다.
 */
export function createClient(socket) {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const resolve = pending.get(message.id);
      if (!resolve) return;
      pending.delete(message.id);
      resolve(message.result ?? {});
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) listener(message.params ?? {});
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });

  send.on = (method, listener) => {
    const list = listeners.get(method) ?? [];
    list.push(listener);
    listeners.set(method, list);
  };

  return send;
}

/**
 * 브라우저를 띄우고 첫 페이지 타깃에 붙는다. 돌려주는 `close()` 가 프로필까지 치운다.
 *
 * 프로필 지우기는 **덤이다** — 브라우저가 아직 파일을 물고 있으면 윈도우에서 EPERM 이
 * 나는데, 그것 때문에 성공한 측정이 실패로 보고되면 안 된다.
 */
export async function launch({ args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "cdp-"));
  const port = 9200 + Math.floor(process.pid % 300);
  const browser = spawn(findBrowser(), [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    ...args,
    "about:blank",
  ]);

  const target = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      return targets.find((t) => t.type === "page");
    } catch {
      return null;
    }
  });

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));

  return {
    send: createClient(socket),
    async close() {
      browser.kill();
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // OS 임시 디렉터리라 남아도 무해하다.
      }
    },
  };
}
