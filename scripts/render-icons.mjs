/**
 * 파비콘·앱 아이콘 렌더 (TASK-26).
 *
 *   node scripts/render-icons.mjs
 *
 * `docs/icon.html` 을 헤드리스 크로미움으로 렌더해 `app/` 에 세 파일을 만든다.
 * 결과물은 커밋되므로 배포할 때 이 스크립트가 필요하지 않다 — 아이콘 디자인을 고칠 때만 돌린다.
 *
 * ## playwright 를 devDependency 로 넣지 않았다
 *
 * 아이콘을 다시 그릴 일은 드문데 브라우저 바이너리까지 딸려 오는 의존성을 상시로 두면
 * 설치와 CI 가 무거워진다. 이 스크립트는 **있으면 쓰고 없으면 안내하고 멈춘다.**
 * (`npm i -D playwright-core` 후 크로미움 경로를 `CHROMIUM_PATH` 로 주면 된다.)
 * 같은 이유로 `npm test` 에도 넣지 않았다 — 결과 PNG 를 커밋해 두는 것이 계약이다.
 */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = join(ROOT, "docs", "icon.html");

/** 만들 파일들. `favicon.ico` 는 아래에서 PNG 를 ICO 로 감싼다. */
const TARGETS = [
  { file: "icon.png", size: 512, variant: "browser" },
  { file: "apple-icon.png", size: 180, variant: "apple" },
];
/** ICO 안에 넣을 PNG 크기. 48 이면 대부분의 브라우저 UI 에서 선명하다. */
const FAVICON_SIZE = 48;

/**
 * PNG 하나를 ICO 컨테이너로 감싼다.
 *
 * ICO 는 Vista 이후 **PNG 를 그대로 품을 수 있다.** 그래서 별도 인코더 없이
 * 헤더(6B) + 디렉터리 항목(16B) 만 붙이면 유효한 파일이 된다.
 * 크기 필드는 1바이트라 256 은 0 으로 적는 규칙이 있는데, 여기서는 48 이라 해당 없다.
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // 이미지 1개

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size % 256, 0); // width
  entry.writeUInt8(size % 256, 1); // height
  entry.writeUInt8(0, 2); // 팔레트 색 수 (트루컬러면 0)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // 이미지 바이트 수
  entry.writeUInt32LE(header.length + entry.length, 12); // 이미지 시작 위치

  return Buffer.concat([header, entry, png]);
}

/**
 * 두 경로 다 환경변수로 열어 둔다 — 이 저장소에 playwright 를 설치하지 않고
 * 다른 곳에 있는 것을 빌려 쓸 수 있게 하기 위해서다 (위 주석 참고).
 *
 * - `PLAYWRIGHT_CORE_PATH` — `playwright-core` 모듈 위치
 * - `CHROMIUM_PATH` — 크로미움 실행 파일 위치
 */
async function loadChromium() {
  const specifier = process.env.PLAYWRIGHT_CORE_PATH
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE_PATH)).href
    : "playwright-core";

  let playwright;
  try {
    playwright = await import(specifier);
  } catch (error) {
    throw new Error(
      "playwright-core 를 찾지 못했습니다. `npm i -D playwright-core` 후 다시 실행하거나,\n" +
        "이미 설치된 것이 있으면 PLAYWRIGHT_CORE_PATH 로 위치를 알려 주세요.\n" +
        "크로미움 실행 파일은 CHROMIUM_PATH 로 지정합니다.\n" +
        `(원인: ${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const executablePath = process.env.CHROMIUM_PATH;
  return playwright.chromium.launch(executablePath ? { executablePath } : {});
}

const browser = await loadChromium();
const scratch = await mkdtemp(join(tmpdir(), "diet-saju-icons-"));
const html = await readFile(SOURCE, "utf8");
const pagePath = join(scratch, "icon.html");
await writeFile(pagePath, html);

/** 크기·변형별로 한 장 찍는다. 배경을 투명으로 두어 둥근 모서리 밖이 비도록 한다. */
async function shoot(size, variant) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(pagePath).href, { waitUntil: "load" });
  await page.evaluate((value) => {
    document.body.dataset.variant = value;
  }, variant);
  await page.evaluateHandle("document.fonts.ready");
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

for (const { file, size, variant } of TARGETS) {
  const png = await shoot(size, variant);
  await writeFile(join(ROOT, "app", file), png);
  console.log(`app/${file} — ${size}×${size} (${png.length.toLocaleString()}B)`);
}

const faviconPng = await shoot(FAVICON_SIZE, "browser");
const ico = pngToIco(faviconPng, FAVICON_SIZE);
await writeFile(join(ROOT, "app", "favicon.ico"), ico);
console.log(`app/favicon.ico — ${FAVICON_SIZE}×${FAVICON_SIZE} (${ico.length.toLocaleString()}B)`);

await browser.close();
