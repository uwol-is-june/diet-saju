/**
 * cards.json + card.css → out/NN.png (1080×1350)
 *
 *   node docs/cardnews/render.mjs
 *   node docs/cardnews/render.mjs docs/cardnews/other.json
 *
 * 브라우저는 시스템의 Edge 를 헤드리스로 쓴다 — playwright 를 의존성으로
 * 들이지 않기 위해서다 (scripts/render-icons.mjs 와 같은 이유).
 * 다른 크로미움을 쓰려면 EDGE_PATH 로 넘긴다.
 *
 * 한글은 시스템 폰트(Noto Sans KR)로 렌더된다. 웹폰트를 받지 않으므로
 * 네트워크 없이 동작하고, 글자가 이미지로 뭉개지지 않는다.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");

const WIDTH = 1080;
const HEIGHT = 1350;

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

function findBrowser() {
  const hit = EDGE_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      `크로미움 계열 브라우저를 찾지 못했습니다. EDGE_PATH 로 경로를 넘겨주세요.\n찾아본 곳:\n${EDGE_CANDIDATES.join("\n")}`,
    );
  }
  return hit;
}

/* ── 텍스트 표기 → HTML ────────────────────────────────
 * 사용자가 쓰는 표기는 두 가지뿐이다. 먼저 이스케이프하고 나서 바꾸므로
 * 데이터에 태그를 적어도 태그로 살아나지 않는다.                        */

const escape = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * 마침표·쉼표 뒤에서 줄을 바꾼다.
 *
 * 브라우저에 맡기면 줄이 꽉 찼을 때 아무 어절에서나 끊겨 문장이 어중간하게
 * 잘린다. 절 끝에서 끊으면 한 줄이 뜻의 단위가 되어 읽는 리듬이 산다 —
 * 풀이 본문에서 문장마다 문단을 나누는 것(lib/reading/line-breaks.ts)과 같은 이유다.
 *
 * 숫자 안의 점(`0.5g`)이나 천 단위 쉼표(`1,000`)는 **뒤에 공백이 없어서**
 * 애초에 걸리지 않는다. 예외 목록을 따로 관리하지 않아도 되는 이유다.
 * 구두점이 굵은 글씨 안에서 끝나는 경우(`...않아요.**`)도 잡도록 `</b>` 를 함께 본다.
 */
const clauseBreaks = (html) => html.replace(/([.,!?])(<\/b>)?[ \t]+/g, "$1$2<br>");

/** `**굵게**` → <b>, 줄바꿈 → <br>, 빈 줄 → 문단 */
function richText(raw) {
  return escape(raw)
    .split(/\n\s*\n/)
    .map((block) => {
      const html = block
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replaceAll("\n", "<br>");
      return `<p>${clauseBreaks(html)}</p>`;
    })
    .join("");
}

/** `제목{뒷부분}` → 뒷부분만 어두운 잉크로 */
function richTitle(raw) {
  return escape(raw)
    .replace(/\{(.+?)\}/g, '<span class="tail">$1</span>')
    .replaceAll("\n", "<br>");
}

/* ── 조각 ─────────────────────────────────────────────── */

/**
 * 로고는 레퍼런스에서 잘라낸 이미지를 그대로 쓴다 (extract-logo.mjs).
 * 다시 그리면 그 순간 변형이 되므로 도형으로 흉내내지 않는다.
 */
const LOGO_SRC = pathToFileURL(path.join(HERE, "assets", "logo.png")).href;
const LOGO = `<div class="logo"><img src="${LOGO_SRC}" alt="다시,"></div>`;

const WARN_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.5 22.5 21H1.5L12 2.5Z" fill="#FFC107"/>
  <path d="M12 8.5v6M12 17.4v.2" stroke="#3A2E00" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

function photoDiv(card) {
  const [a, b] = card.tone ?? [];
  const tone = a && b ? `--tone-a:${a};--tone-b:${b};` : "";

  if (!card.photo) {
    return `<div class="photo is-placeholder" style="${tone}" data-hint="${escape(card.photoHint ?? "사진 자리")}"></div>`;
  }
  const url = pathToFileURL(path.resolve(HERE, card.photo)).href;
  return `<div class="photo" style="background-image:url('${url}')"></div>`;
}

/* ── 레이아웃 ─────────────────────────────────────────── */

const LAYOUTS = {
  cover: (c) => `
    ${photoDiv(c)}
    <div class="scrim"></div>
    ${LOGO}
    <div class="copy">
      <h1 class="cover-title">${richTitle(c.title)}</h1>
      ${c.sub ? `<p class="cover-sub">${escape(c.sub)}</p>` : ""}
    </div>`,

  stack: (c) => `
    ${LOGO}
    <div class="copy">
      <h2 class="title">${richTitle(c.title)}</h2>
      <div class="body">${richText(c.body)}</div>
    </div>
    ${photoDiv(c)}`,

  split: (c) => `
    ${photoDiv(c)}
    ${LOGO}
    <div class="copy">
      <h2 class="title">${richTitle(c.title)}</h2>
      <div class="body">${richText(c.body)}</div>
    </div>`,

  plain: (c) => `
    ${LOGO}
    <div class="copy">
      <h2 class="title">${richTitle(c.title)}</h2>
      <div class="body">${richText(c.body)}</div>
    </div>`,

  notice: (c) => `
    ${LOGO}
    <div class="copy">
      <h2 class="title">${richTitle(c.title)}</h2>
      ${c.lede ? `<p class="lede">${escape(c.lede)}</p>` : ""}
      <ul>
        ${(c.items ?? [])
          .map(
            (it) => `
          <li>
            <div class="warn">${WARN_ICON}<span>${escape(it.warn)}</span></div>
            <div class="detail"><span class="arrow">→</span><span>${clauseBreaks(escape(it.detail).replaceAll("\n", "<br>"))}</span></div>
          </li>`,
          )
          .join("")}
      </ul>
    </div>
    <div class="bang"><i class="stem"></i><i class="dot"></i></div>`,
};

function buildHtml(card, css) {
  const layout = LAYOUTS[card.layout];
  if (!layout) {
    throw new Error(
      `알 수 없는 layout: ${card.layout} (가능한 값: ${Object.keys(LAYOUTS).join(", ")})`,
    );
  }
  // 사진 출처는 카드에 찍지 않는다 — Pexels 라이선스가 표기를 요구하지 않고,
  // 다섯 장마다 같은 줄이 들어가면 읽는 데 방해가 된다. 대신 out/caption.txt 로
  // 모아서 인스타그램 본문에 한 번 붙인다 (buildCaption).
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="card is-${card.layout}">${layout(card)}</div></body></html>`;
}

/**
 * 인스타그램 본문에 붙일 캡션. 사진 출처를 여기 모은다.
 * Pexels 라이선스는 표기 의무가 없지만 API 가이드라인이 링크백을 권하고,
 * 촬영자를 밝히는 편이 브랜드 콘텐츠로서 맞다.
 */
function buildCaption(data) {
  const lines = [];
  const cover = data.cards.find((c) => c.layout === "cover");
  if (cover) lines.push(cover.title.replaceAll("\n", " "), "");

  const credits = data.cards
    .map((c) => c.photoCredit)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  if (credits.length) {
    lines.push("사진 출처", ...credits.map((c) => `· ${c}`), "https://www.pexels.com", "");
  }
  if (data.hashtags?.length) lines.push(data.hashtags.map((t) => `#${t}`).join(" "));

  return `${lines.join("\n").trim()}\n`;
}

/* ── 렌더 ─────────────────────────────────────────────── */

async function shoot(browser, htmlPath, pngPath, profileDir) {
  await run(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--force-device-scale-factor=1",
      // 로컬 HTML 이 같은 폴더의 폰트·사진을 읽어야 한다 (@font-face 는
      // 이미지와 달리 교차 출처 검사를 받아서 이 플래그 없이는 조용히 폴백된다)
      "--allow-file-access-from-files",
      `--user-data-dir=${profileDir}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "--virtual-time-budget=1500",
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { windowsHide: true },
  );

  // 브라우저는 페이지를 못 열어도 오류 화면을 그대로 찍는다 — 조용히 실패한
  // 카드가 세트에 섞이지 않도록 최소한 파일 생성 여부는 확인한다.
  if (!existsSync(pngPath)) {
    throw new Error(
      `스크린샷이 생성되지 않았습니다: ${pngPath}\n` +
        `브라우저가 임시 HTML 을 읽지 못한 경우입니다. 파일 접근이 제한된 셸에서 ` +
        `실행하면 이 증상이 납니다 — 일반 터미널(PowerShell)에서 다시 실행하세요.`,
    );
  }
}

async function main() {
  const dataPath = path.resolve(process.argv[2] ?? path.join(HERE, "cards.json"));
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  const browser = findBrowser();

  // HTML 은 임시 폴더에 쓰이므로 CSS 안의 상대 경로가 깨진다.
  // 폰트 폴더만 절대 경로로 바꿔 넣는다.
  const css = (await readFile(path.join(HERE, "card.css"), "utf8")).replaceAll(
    "%FONTS%",
    pathToFileURL(path.join(HERE, "fonts")).href,
  );

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const work = await mkdtemp(path.join(tmpdir(), "cardnews-"));

  try {
    for (const [i, card] of data.cards.entries()) {
      const no = String(i + 1).padStart(2, "0");
      const htmlPath = path.join(work, `${no}.html`);
      const pngPath = path.join(OUT, `${no}-${card.layout}.png`);

      await writeFile(htmlPath, buildHtml(card, css), "utf8");
      await shoot(browser, htmlPath, pngPath, path.join(work, `p${no}`));
      console.log(`  ${path.relative(process.cwd(), pngPath)}`);
    }
    const captionPath = path.join(OUT, "caption.txt");
    await writeFile(captionPath, buildCaption(data), "utf8");
    console.log(`  ${path.relative(process.cwd(), captionPath)}`);

    console.log(`\n${data.cards.length}장 완료 · ${data.topic ?? data.slug}`);
    console.log("사진 출처는 카드가 아니라 caption.txt 에 있습니다 — 본문에 붙일 것.");
  } finally {
    // 브라우저가 아직 프로필을 붙들고 있으면 지워지지 않는다. 임시 폴더가
    // 남는 것뿐이므로 렌더 결과를 이 실패로 덮지 않는다.
    await rm(work, { recursive: true, force: true, maxRetries: 3 }).catch(
      () => {},
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
