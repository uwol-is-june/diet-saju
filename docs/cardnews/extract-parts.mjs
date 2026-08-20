/**
 * 레퍼런스 카드에서 그림 조각을 그대로 잘라낸다 → assets/*.png
 *
 *   node docs/cardnews/extract-parts.mjs          # 전부
 *   node docs/cardnews/extract-parts.mjs bang     # 하나만
 *
 * 도형으로 다시 그리지 않는 이유는 그리는 순간 변형이 되기 때문이다. 로고는
 * 물론이고 느낌표도 그렇다 — 원본은 하이라이트와 그림자가 들어간 입체 그림이라
 * CSS 도형으로는 납작한 다른 물건이 나온다.
 *
 * 잘라낸 것은 **흰 바탕 위의 그림** 한 장씩이다. 카드 바탕이 흰색이 아니어도
 * CSS 가 multiply 로 합성해 흰 바탕만 사라진다 (card.css). 어두운 사진 위에
 * 밝은 로고가 필요한 커버도 CSS 가 뒤집어 쓴다 — 두 벌을 만들면 나중에
 * 한쪽만 바뀐다.
 *
 * 좌표는 레퍼런스 PNG(1080×1350) 에서 실측한 값이다. 카드 캔버스가 같은 크기라
 * 여기서 잰 위치가 곧 렌더에서 쓸 위치가 된다 (card.css 의 배치도 같은 값).
 * 원본 벡터 파일을 받으면 그 조각을 표에서 지우고 받은 파일로 교체한다.
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

/**
 * 잘라낼 조각들. `box` 는 레퍼런스 안에서 그 그림이 차지하는 사각형이다.
 *
 * 느낌표는 **그림자까지** 담는다. 그림자를 떼면 원본과 다른 그림이 되고, 흰 바탕이
 * multiply 로 사라지므로 그림자가 함께 들어와도 사각형이 보이지 않는다.
 */
export const PARTS = {
  logo: { ref: "ref2.png", box: { x: 906, y: 46, w: 124, h: 40 } },
  bang: { ref: "ref4.png", box: { x: 858, y: 1052, w: 158, h: 224 } },
};

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

async function crop(browser, name, { ref, box }) {
  const source = path.join(HERE, "..", "card_ref", "ref_origin", ref);
  if (!existsSync(source)) {
    throw new Error(`레퍼런스를 찾지 못했습니다: ${source}`);
  }

  const dest = path.join(HERE, "assets", `${name}.png`);
  await mkdir(path.dirname(dest), { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), `part-${name}-`));

  // 원본을 실제 크기로 깔고 음수 오프셋으로 밀어, 뷰포트에 그 조각만 남긴다.
  // 캔버스에 그려 데이터를 빼내는 것보다 단순하고 리샘플링이 끼지 않는다.
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${box.w}px;height:${box.h}px;overflow:hidden}
    div{position:absolute;left:${-box.x}px;top:${-box.y}px;
        width:1080px;height:1350px;
        background:url('${pathToFileURL(source).href}') no-repeat 0 0/1080px 1350px}
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
        `--window-size=${box.w},${box.h}`,
        "--virtual-time-budget=1500",
        `--screenshot=${dest}`,
        pathToFileURL(htmlPath).href,
      ],
      { windowsHide: true },
    );
  } finally {
    await rm(work, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }

  if (!existsSync(dest)) throw new Error(`${name} 을 만들지 못했습니다.`);
  console.log(`assets/${name}.png  (${box.w}×${box.h})  ← card_ref/ref_origin/${ref}`);
}

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(PARTS);

  const unknown = names.filter((n) => !PARTS[n]);
  if (unknown.length) {
    throw new Error(
      `알 수 없는 조각: ${unknown.join(", ")} (가능한 값: ${Object.keys(PARTS).join(", ")})`,
    );
  }

  const browser = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!browser) throw new Error("브라우저를 찾지 못했습니다. EDGE_PATH 로 넘겨주세요.");

  for (const name of names) await crop(browser, name, PARTS[name]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
