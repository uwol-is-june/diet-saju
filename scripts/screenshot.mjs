/**
 * 모바일 폭 스크린샷 (TASK-69).
 *
 * ## 왜 CLI 플래그로는 안 되는가
 *
 * `chrome --headless --window-size=390,844 --screenshot` 은 **PNG 만 390px 로 자른다.**
 * 레이아웃 뷰포트는 창 최소 폭(약 500px)에 걸려 더 넓게 잡히고, 결과물은 넓게 배치된
 * 화면의 왼쪽 390px 를 오려낸 그림이 된다 — 글자가 오른쪽에서 잘려 **레이아웃이 깨진 것처럼
 * 보인다.** 실제로 한 번 속았다.
 *
 * 진짜 모바일 폭은 CDP 의 `Emulation.setDeviceMetricsOverride` 로만 만들 수 있다. 이 스크립트가
 * 그것을 한다. **의존성이 없다** — Node 21+ 의 전역 `WebSocket` 으로 CDP 에 직접 붙는다.
 * (`scripts/render-icons.mjs` 가 playwright 를 상시 의존성으로 두지 않는 것과 같은 판단이다.)
 *
 * ## 쓰는 법
 *
 * ```bash
 * npm run dev                                    # 다른 터미널에서
 * node scripts/screenshot.mjs http://localhost:3000/ out.png
 * node scripts/screenshot.mjs <url> <out.png> --width 768 --full
 * ```
 *
 * 기본값은 390×844(iPhone 기준) · DPR 2 · 모바일 모드다. **주 사용자가 모바일이므로
 * 기본값이 모바일이다** — 넓은 화면을 볼 때만 `--width` 를 준다.
 *
 * 크로미움 실행 파일은 이 순서로 찾는다: `CHROMIUM_PATH` → 설치된 Chrome → Edge.
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

function findBrowser() {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      "크로미움을 찾지 못했습니다. CHROMIUM_PATH 로 실행 파일 위치를 알려 주세요.",
    );
  }
  return found;
}

function parseArgs(argv) {
  const [url, out, ...rest] = argv;
  if (!url || !out) {
    throw new Error("사용법: node scripts/screenshot.mjs <url> <out.png> [--width N] [--height N] [--dpr N] [--full] [--desktop]");
  }
  const flag = (name, fallback) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(rest[i + 1]);
  };
  return {
    url,
    out,
    width: flag("width", 390),
    height: flag("height", 844),
    dpr: flag("dpr", 2),
    full: rest.includes("--full"),
    mobile: !rest.includes("--desktop"),
  };
}

/** CDP 는 요청마다 id 를 매기고 같은 id 로 답이 온다. 최소한의 짝 맞추기만 한다. */
function createClient(socket) {
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (!resolve) return;
    pending.delete(message.id);
    resolve(message.result ?? {});
  });
  return (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
}

async function waitFor(check, { timeout = 15000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("시간 초과");
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

const options = parseArgs(process.argv.slice(2));
const profile = mkdtempSync(join(tmpdir(), "shot-"));
const port = 9200 + Math.floor(process.pid % 300);

const browser = spawn(findBrowser(), [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
]);

try {
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
  const send = createClient(socket);

  await send("Page.enable");
  // **이 한 줄이 이 스크립트의 존재 이유다** — 레이아웃 뷰포트를 진짜로 좁힌다.
  await send("Emulation.setDeviceMetricsOverride", {
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.dpr,
    mobile: options.mobile,
  });

  await send("Page.navigate", { url: options.url });
  // `Page.loadEventFired` 를 기다리는 대신 렌더가 멎었는지를 본다 — 폰트·이미지가 늦게 와도
  // 잡히고, 이벤트를 놓쳐 영원히 기다리는 경우가 없다.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: options.full,
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(options.out, Buffer.from(data, "base64"));
  console.log(`${options.out} (${options.width}×${options.full ? "full" : options.height} · DPR ${options.dpr})`);
} finally {
  browser.kill();
  // 프로필 지우기는 **덤이다.** 브라우저가 아직 파일을 물고 있으면 윈도우에서 EPERM 이
  // 나는데, 그것 때문에 성공한 촬영이 실패로 보고되면 안 된다.
  await new Promise((resolve) => setTimeout(resolve, 300));
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // OS 임시 디렉터리라 남아도 무해하다.
  }
}
