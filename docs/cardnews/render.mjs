/**
 * cards.json + card.css → out/NN.png (1080×1350)
 *
 *   node docs/cardnews/render.mjs
 *   node docs/cardnews/render.mjs docs/cardnews/other.json
 *
 * 형식은 두 벌이다 — cards.json 의 `style` 이 고른다 (없으면 "a").
 *   "a" (기본)  흰 바탕 + 사진 한 조각        · card.css   · layout: cover|stack|split|plain|notice
 *   "b"         전면 사진 + 흰 글씨          · card-b.css · layout: b-cover|b-intro|b-type|b-summary|b-outro
 * 레이아웃 이름이 서로 겹치지 않으므로 어느 쪽인지 데이터만 봐도 안다.
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

/**
 * 사진과 출력물이 놓이는 폴더 — **데이터(json)가 있는 곳**이다.
 *
 * 주제가 늘면 폴더로 나눈다(`docs/cardnews_0818/`). 그때 형식(card.css · fonts ·
 * 로고 · 느낌표)은 HERE 에서 그대로 가져오고 내용물만 새 폴더에 둔다 — 형식을
 * 복사하면 두 벌이 되어 한쪽만 고쳐진다.
 */
let DATA_DIR = HERE;

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

/**
 * B_style 본문. richText 와 하나만 다르다 — **clauseBreaks 를 쓰지 않는다.**
 *
 * A_style 은 줄을 코드가 만들지만(마침표·쉼표 뒤), B_style 레퍼런스는 절 중간에서도
 * 끊는다 ("연구를 종합하면 특정 시간대의 운동이 / 모든 사람에게 압도적으로…").
 * 자동 규칙으로는 그 자리를 못 맞추므로 줄은 cards.json 의 `\n` 이 정한다.
 * 대신 문구를 고칠 때마다 줄을 다시 봐야 한다 — 렌더 결과를 눈으로 확인할 것.
 */
function richTextB(raw) {
  return escape(raw)
    .split(/\n\s*\n/)
    .map((block) => {
      const html = block
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replaceAll("\n", "<br>");
      return `<p>${html}</p>`;
    })
    .join("");
}

/** 한 줄짜리 값(제목·눈썹·팁)에는 문단이 필요 없다. 굵게와 줄바꿈만 받는다. */
function richLineB(raw) {
  return escape(raw)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replaceAll("\n", "<br>");
}

/** `제목{뒷부분}` → 뒷부분만 어두운 잉크로 */
function richTitle(raw) {
  return escape(raw)
    .replace(/\{(.+?)\}/g, '<span class="tail">$1</span>')
    .replaceAll("\n", "<br>");
}

/* ── 조각 ─────────────────────────────────────────────── */

/**
 * 로고와 느낌표는 레퍼런스에서 잘라낸 이미지를 그대로 쓴다 (extract-parts.mjs).
 * 다시 그리면 그 순간 변형이 되므로 도형으로 흉내내지 않는다.
 */
const assetUrl = (name) => pathToFileURL(path.join(HERE, "assets", name)).href;
const logoDiv = (variant = "") =>
  `<div class="logo${variant ? ` ${variant}` : ""}"><img src="${assetUrl("logo.png")}" alt="다시,"></div>`;
const LOGO = logoDiv();
/** 장식이므로 대체 텍스트를 비운다 — 뜻은 제목과 목록이 이미 전한다. */
const BANG = `<div class="bang"><img src="${assetUrl("bang.png")}" alt=""></div>`;

const WARN_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2.5 22.5 21H1.5L12 2.5Z" fill="#FFC107"/>
  <path d="M12 8.5v6M12 17.4v.2" stroke="#3A2E00" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

/**
 * 정보 출처 한 줄. **사진 출처와 다른 것이다** — 사진 쪽은 표기 의무가 없어
 * caption.txt 로 모으지만(buildCaption), 이건 카드에 적은 사실의 근거라
 * 그 사실과 같은 화면에 있어야 뜻이 있다. 캡션으로 내리면 카드만 캡처해
 * 퍼가는 경우 근거가 떨어져 나간다.
 *
 * 표지에는 붙이지 않는다 — 표지는 주장이 아니라 제목이라 댈 근거가 없다.
 * 라벨(`출처 ·`)은 코드가 붙인다. 데이터에 적게 하면 카드마다 표기가 갈린다.
 */
const sourceLine = (card) =>
  card.source ? `<p class="source">출처 · ${escape(card.source)}</p>` : "";

function photoDiv(card) {
  const [a, b] = card.tone ?? [];
  const tone = a && b ? `--tone-a:${a};--tone-b:${b};` : "";

  if (!card.photo) {
    return `<div class="photo is-placeholder" style="${tone}" data-hint="${escape(card.photoHint ?? "사진 자리")}"></div>`;
  }
  const url = pathToFileURL(path.resolve(DATA_DIR, card.photo)).href;
  /* 사진을 어디를 보여줄지 카드마다 정할 수 있다 (`photoPosition`, 기본 center).
   * B_style 은 글이 사진 위에 얹히므로 **피사체가 글자 자리에 걸리면 사진을
   * 옮기는 것이 사진을 바꾸는 것보다 먼저다** — `center 20%` 처럼 위쪽을 더
   * 보여주면 피사체가 아래로 내려간다. 값은 CSS background-position 그대로다. */
  const pos = card.photoPosition ? `background-position:${card.photoPosition};` : "";
  return `<div class="photo" style="background-image:url('${url}');${pos}"></div>`;
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
    ${sourceLine(c)}
    ${photoDiv(c)}`,

  split: (c) => `
    ${photoDiv(c)}
    ${LOGO}
    <div class="copy">
      <h2 class="title">${richTitle(c.title)}</h2>
      <div class="body">${richText(c.body)}</div>
    </div>
    ${sourceLine(c)}`,

  plain: (c) => `
    ${LOGO}
    <div class="copy">
      <h2 class="title">${richTitle(c.title)}</h2>
      <div class="body">${richText(c.body)}</div>
    </div>
    ${sourceLine(c)}`,

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
    ${sourceLine(c)}
    ${BANG}`,
};

/* ── B_style 레이아웃 ──────────────────────────────────
 * 사진이 카드를 통째로 덮고 그 위에 흰 글씨가 얹힌다. 그래서 다섯 레이아웃이
 * 모두 `photoDiv + scrim` 으로 시작한다 — 스크림 없이 글을 얹으면 사진 밝기에
 * 따라 읽히거나 안 읽힌다.
 *
 * 조각 이름은 A_style 과 겹치지 않게 `b-` 를 붙였다. 한 폴더 안에 두 형식이
 * 있으므로 이름이 겹치면 CSS 가 서로를 덮는다.                              */

const bBase = (c) => `${photoDiv(c)}<div class="scrim"></div>`;

const LAYOUTS_B = {
  /** 표지 — 가운데 두 줄 + 아래 마크. 근거를 대는 장이 아니라 source 를 받지 않는다. */
  "b-cover": (c) => `
    ${bBase(c)}
    <div class="copy">
      <h1 class="cover-title">${richLineB(c.title)}</h1>
    </div>
    ${logoDiv("is-middle")}`,

  /** 도입 — 개념 한 덩어리 + 아래 세 칸(유형 미리보기). */
  "b-intro": (c) => `
    ${bBase(c)}
    ${logoDiv("is-corner")}
    <div class="copy">
      <h2 class="title">${richLineB(c.title)}</h2>
      <div class="body">${richTextB(c.body)}</div>
    </div>
    <div class="tri">
      ${(c.columns ?? [])
        .map(
          (col) =>
            `<div class="col"><b>${richLineB(col.head)}</b><span>${escape(col.name)}</span></div>`,
        )
        // 칸 사이의 세로선은 칸의 테두리가 아니라 **칸 사이에 놓이는 조각**이다.
        // 테두리로 하면 남는 폭이 칸 사이로 몰릴 때 선이 오른쪽 칸에 붙어 보인다
        // (레퍼런스는 선이 두 칸 사이 가운데에 있다 — card-b.css 의 .tri 참고).
        .join("<i></i>")}
    </div>
    ${sourceLine(c)}`,

  /** 유형 카드 — 눈썹·제목(위) · 라벨·값·본문(가운데) · 팁(아래). */
  "b-type": (c) => `
    ${bBase(c)}
    ${logoDiv("is-corner")}
    <div class="head">
      <p class="eyebrow">${richLineB(c.eyebrow)}</p>
      <h2 class="title">${richLineB(c.title)}</h2>
    </div>
    <div class="mid">
      ${c.label ? `<p class="label">${escape(c.label)}</p>` : ""}
      ${c.value ? `<p class="value">${escape(c.value)}</p>` : ""}
      <div class="body">${richTextB(c.body)}</div>
    </div>
    ${
      c.tip
        ? `<div class="tip"><span class="k">${escape(c.tipLabel ?? "팁")}</span><span>${richLineB(c.tip)}</span></div>`
        : ""
    }
    ${sourceLine(c)}`,

  /** 마무리 — 제목 + 본문, 세로 가운데. */
  "b-summary": (c) => `
    ${bBase(c)}
    ${logoDiv("is-corner")}
    <div class="copy">
      <h2 class="title">${richLineB(c.title)}</h2>
      <div class="body">${richTextB(c.body)}</div>
    </div>
    ${sourceLine(c)}`,

  /** 마지막 장 — 사진 + 가운데 마크. 글자를 얹지 않는다. */
  "b-outro": (c) => `
    ${bBase(c)}
    ${logoDiv("is-middle")}`,
};

/** cards.json 의 style → 스타일시트. 없으면 A_style 이다 (기존 편들이 그렇다). */
const STYLES = {
  a: { css: "card.css", layouts: LAYOUTS },
  b: { css: "card-b.css", layouts: LAYOUTS_B },
};

function pickStyle(data) {
  const key = data.style ?? "a";
  const style = STYLES[key];
  if (!style) {
    throw new Error(
      `알 수 없는 style: ${key} (가능한 값: ${Object.keys(STYLES).join(", ")})`,
    );
  }
  return style;
}

function buildHtml(card, css, layouts) {
  const layout = layouts[card.layout];
  if (!layout) {
    throw new Error(
      `알 수 없는 layout: ${card.layout} (가능한 값: ${Object.keys(layouts).join(", ")})`,
    );
  }
  // 사진 출처는 카드에 찍지 않는다 — Pexels 라이선스가 표기를 요구하지 않고,
  // 다섯 장마다 같은 줄이 들어가면 읽는 데 방해가 된다. 대신 out/caption.txt 로
  // 모아서 인스타그램 본문에 한 번 붙인다 (buildCaption).
  // 반대로 **정보 출처**(card.source)는 카드에 찍는다 — sourceLine 참고.
  // 출처 한 줄이 있으면 카드에 표시를 남긴다 — B_style 이 팁 덩어리를 그만큼
  // 올리는 데 쓴다. 레이아웃 안에서 형제 선택자로는 알 수 없는 정보다.
  const flags = card.source ? " is-has-source" : "";
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="card is-${card.layout}${flags}">${layout(card)}</div></body></html>`;
}

/**
 * 인스타그램 본문에 붙일 캡션. 본문 문구(`caption`)와 사진 출처를 여기 모은다.
 * Pexels 라이선스는 표기 의무가 없지만 API 가이드라인이 링크백을 권하고,
 * 촬영자를 밝히는 편이 브랜드 콘텐츠로서 맞다.
 *
 * `caption` 이 없으면 표지 제목만 올린다 — 새 주제를 잡는 도중에도 렌더가
 * 멈추지 않아야 하고, 캡션은 카드가 다 나온 뒤에 쓰는 것이라 순서가 늦다.
 */
function buildCaption(data) {
  const lines = [];
  const cover = data.cards.find((c) => c.layout === "cover" || c.layout === "b-cover");
  const lede = data.caption?.trim() || cover?.title.replaceAll("\n", " ");
  if (lede) lines.push(lede, "");

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
  DATA_DIR = path.dirname(dataPath);
  const OUT = path.join(DATA_DIR, "out");
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  const browser = findBrowser();
  const style = pickStyle(data);

  // HTML 은 임시 폴더에 쓰이므로 CSS 안의 상대 경로가 깨진다.
  // 폰트 폴더만 절대 경로로 바꿔 넣는다.
  const css = (await readFile(path.join(HERE, style.css), "utf8")).replaceAll(
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

      await writeFile(htmlPath, buildHtml(card, css, style.layouts), "utf8");
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
