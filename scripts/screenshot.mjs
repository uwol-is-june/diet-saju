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
 * 브라우저를 띄우고 붙는 부분은 `scripts/lib/cdp.mjs` 에 있다 — `measure-load.mjs`(TASK-87)가
 * 같은 플러밍을 쓰면서 뺐다.
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

import { writeFile } from "node:fs/promises";
import { launch } from "./lib/cdp.mjs";

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

const options = parseArgs(process.argv.slice(2));
const { send, close } = await launch();

try {
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
  await writeFile(options.out, Buffer.from(data, "base64"));
  console.log(`${options.out} (${options.width}×${options.full ? "full" : options.height} · DPR ${options.dpr})`);
} finally {
  await close();
}
