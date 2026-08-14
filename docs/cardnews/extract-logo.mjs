/**
 * 레퍼런스 카드에서 "다시," 로고를 그대로 잘라낸다 → assets/logo.png
 *
 *   node docs/cardnews/extract-logo.mjs
 *
 * 로고를 SVG 로 다시 그리지 않는 이유는 그리는 순간 변형이 되기 때문이다.
 * 원본 벡터 파일을 받으면 이 스크립트를 지우고 그 파일을 쓰면 된다.
 *
 * 잘라낸 것은 **흰 바탕 위의 회색 로고** 한 장뿐이다. 어두운 사진 위에 흰 로고가
 * 필요한 커버는 CSS 가 뒤집어 쓴다 (card.css 의 .is-cover .logo 참조) —
 * 두 벌을 만들면 나중에 한쪽만 바뀐다.
 *
 * 좌표는 ref2.png(1080×1350) 에서 실측한 값이다. 카드 캔버스가 같은 크기라
 * 여기서 잰 위치가 곧 렌더에서 쓸 위치가 된다.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** ref2.png 안에서 로고가 차지하는 사각형 (실측) */
export const LOGO_BOX = { x: 906, y: 46, w: 124, h: 40 };

const SOURCE = path.join(HERE, "..", "card_ref", "ref2.png");
const DEST = path.join(HERE, "assets", "logo.png");

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

async function main() {
  if (!existsSync(SOURCE)) {
    throw new Error(`레퍼런스를 찾지 못했습니다: ${SOURCE}`);
  }
  const browser = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!browser) throw new Error("브라우저를 찾지 못했습니다. EDGE_PATH 로 넘겨주세요.");

  await mkdir(path.dirname(DEST), { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), "logo-"));

  // 원본을 실제 크기로 깔고 음수 오프셋으로 밀어, 뷰포트에 로고만 남긴다.
  // 캔버스에 그려 데이터를 빼내는 것보다 단순하고 리샘플링이 끼지 않는다.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${LOGO_BOX.w}px;height:${LOGO_BOX.h}px;overflow:hidden}
    div{position:absolute;left:${-LOGO_BOX.x}px;top:${-LOGO_BOX.y}px;
        width:1080px;height:1350px;
        background:url('${pathToFileURL(SOURCE).href}') no-repeat 0 0/1080px 1350px}
  </style></head><body><div></div></body></html>`;

  const htmlPath = path.join(work, "crop.html");
  await writeFile(htmlPath, html, "utf8");

  try {
    await run(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--force-device-scale-factor=1",
        `--user-data-dir=${path.join(work, "prof")}`,
        `--window-size=${LOGO_BOX.w},${LOGO_BOX.h}`,
        "--virtual-time-budget=1500",
        `--screenshot=${DEST}`,
        pathToFileURL(htmlPath).href,
      ],
      { windowsHide: true },
    );
  } finally {
    await rm(work, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }

  if (!existsSync(DEST)) throw new Error("로고를 만들지 못했습니다.");
  console.log(`assets/logo.png  (${LOGO_BOX.w}×${LOGO_BOX.h})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
