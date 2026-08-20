/**
 * 판정 콜아웃 사진 — Pexels 에서 후보 받기 → 고른 것만 확정 (TASK-90)
 *
 *   1) 후보 받기 (21종 × N장)
 *      node --env-file=.env.local scripts/fetch-verdict-photos.mjs --count=6
 *      → OS 임시 디렉터리에 `<slug>-cN.jpg` + **컨택트시트 `contact.html`**
 *
 *   2) 눈으로 보고 고르기 (슬러그:후보번호)
 *      node --env-file=.env.local scripts/fetch-verdict-photos.mjs --pick=gain-sigyok:2,element-su:1
 *      → `public/verdict/<slug>.jpg` 로 확정 + `photos.json` · `CREDITS.md` 갱신
 *
 * `scripts/fetch-card-photos.mjs` 와 같은 2단계다. 첫 장을 자동으로 물리면 세트 톤이
 * 깨진 채로 화면까지 간다. **다른 점은 컨택트시트**다 — 후보가 126장이라 파일 탐색기로
 * 훑으면 어느 슬러그의 몇 번인지 놓친다.
 *
 * ## 슬러그는 유형이 아니라 "축 값" 이다
 *
 * `components/VerdictCallout.tsx` 가 유형마다 축 하나를 골라 라벨을 만들고, 사진도 그
 * 축 값에 붙는다. 그래서 여기 표의 키는 `diet`·`exercise` 가 아니라 `metabolism-balsan`·
 * `movement-brisk` 다. 셋(이 표 · 컴포넌트 · `public/verdict/`)이 어긋나지 않는지는
 * `lib/reading/verdict-photo.test.ts` 가 본다.
 *
 * ## 피사체 규칙 (CLAUDE.md "유형 카드 사진")
 *
 * 사람이 없는 정물만 쓴다. 몸을 찍으면 신체 평가가 되고, 특정 음식 한 접시를 찍으면
 * `ELEMENT_FOOD` 닫힌 목록을 판정 코드 밖에서 우회하는 셈이 된다. 식사 도구까지가
 * 경계이고 운동 기구는 허용이다 (TASK-48 이 대표 종목을 콕 집는 유형을 열었다).
 *
 * **`element-*` 여섯 장이 이 규칙에 가장 가깝다.** "목 계열을 곁들이기" 를 채소 사진으로
 * 찍으면 그 우회가 그대로 일어난다. 그래서 재료가 아니라 **오행 자체의 상징**(잎·불꽃·
 * 흙·금속·물)을 찍는다 — 이미 `OhaengBars`·`OhaengCycle` 이 화면에 내는 개념이다.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(ROOT, "public", "verdict");
const CANDIDATES = path.join(os.tmpdir(), "diet-saju-verdict-photos");
const MANIFEST = path.join(CANDIDATES, "candidates.json");

const API = "https://api.pexels.com/v1/search";

/**
 * 슬롯이 `/` 리스트 카드와 같은 크기다(390px 화면에서 약 147 CSS 픽셀). 480 이면 DPR 3
 * 까지 덮는다. 화질 파라미터(`q`)는 Pexels 가 받지 않으므로 크기가 유일한 손잡이다.
 */
const SIZE = 480;

/**
 * 슬러그별 검색어. 전부 "사람 없는 정물" 로 좁혀 뒀다.
 *
 * **`exercise` 의 넷은 셋이 걷기라 소재로 가른다** — `movement-brisk` 는 운동화 정물,
 * `movement-slow` 는 숲길, `movement-rhythm` 은 횡단보도, `movement-strength` 는 계단이다.
 * 같은 낱말로 검색하면 네 장이 서로 구별되지 않는다.
 *
 * **`movement-rhythm` 은 한 번 갈아끼웠다** (TASK-94). `sneakers by front door` 로 받은 장이
 * `/cards/exercise.jpg` 와 **같은 Pexels 사진**(11513443)이었는데, TASK-92 가 그 장을
 * `/reading/exercise` 상단 히어로로 올리면서 **한 화면에 같은 사진이 두 번** 나오게 됐다 —
 * 콜아웃이 히어로의 꼬리처럼 읽혔다. `verdict-photo.test.ts` 가 이제 두 `photos.json` 의
 * id 가 겹치는지 본다.
 *
 * **운동 기구 검색은 거의 전부 인물 사진이다** (실측: `kettlebell`·`barbell` 8건 중 6건).
 * `gain-geunyuk` 이 그 자리라 후보를 늘려도 안 걸러진다 — 기구가 바닥에 놓인 장면
 * (`on floor`)으로 좁혀야 정물이 올라온다.
 */
const QUERY = {
  // 대사 기조 (diet) — 밖으로 쓰는 쪽 / 안으로 모으는 쪽
  "metabolism-balsan": "open window sheer curtain morning breeze",
  "metabolism-chukjeok": "folded wool blanket warm lamp corner",

  // 살이 붙는 패턴 (gain-cause)
  "gain-geunyuk": "gym equipment weights on floor no people",
  "gain-sigyok": "stacked empty ceramic plates on table",
  "gain-bulgyuchik": "vintage alarm clock on bedside table",
  "gain-stress": "knotted rope close up texture",
  "gain-jeongche": "empty wooden chair by window quiet room",

  // 다이어트 접근 순서 (diet-method)
  "approach-activity": "empty park walking path morning pavement",
  "approach-meal": "single empty ceramic bowl on dark table minimalist",
  "approach-recovery": "neatly made bed white linen morning light",
  "approach-rhythm": "minimal wall calendar on white wall",

  // 곁들일 계열 (diet-food) — 재료가 아니라 오행 상징이다
  "element-mok": "young green leaves branch close up",
  "element-hwa": "single candle flame dark background",
  "element-to": "handmade clay pottery bowls earth tone",
  "element-geum": "silver spoons on linen still life",
  "element-su": "still water surface ripple close up",
  "element-even": "balanced smooth stones stacked",

  // 대표 종목 (exercise)
  "movement-brisk": "athletic running shoes flat lay white background",
  "movement-strength": "empty concrete staircase sunlight minimal",
  "movement-slow": "quiet forest trail soft light",
  "movement-rhythm": "empty crosswalk zebra stripes asphalt",
};

function parseArgs(argv) {
  const args = { pick: null, count: 6, only: null };
  for (const a of argv) {
    if (a.startsWith("--pick=")) {
      args.pick = new Map(
        a
          .slice(7)
          .split(",")
          .map((pair) => {
            const [slug, index] = pair.split(":");
            return [slug?.trim(), Number(index)];
          })
          .filter(([slug, index]) => slug && Number.isFinite(index)),
      );
    } else if (a.startsWith("--only=")) {
      // 한 슬러그만 다시 받는다 — 검색어를 다듬는 동안 나머지 후보를 헛되게 받지 않는다.
      args.only = a
        .slice(7)
        .split(",")
        .map((s) => s.trim());
    } else if (a.startsWith("--count=")) {
      args.count = Math.max(1, Math.min(10, Number(a.slice(8)) || 6));
    }
  }
  return args;
}

/** Pexels 이미지 URL 에 크기·크롭을 얹는다. `src.original` 은 파라미터를 받지 않는다. */
function sized(src, width, height) {
  const url = new URL(src);
  url.searchParams.set("auto", "compress");
  url.searchParams.set("cs", "tinysrgb");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  return url.toString();
}

async function search(apiKey, query, perPage) {
  const url = new URL(API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "square");

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (res.status === 401) throw new Error("PEXELS_API_KEY 가 거부됐습니다. 키 값을 확인하세요.");
  if (res.status === 429) throw new Error("Pexels 요청 한도를 넘었습니다 (시간당 200).");
  if (!res.ok) throw new Error(`Pexels 오류 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).photos ?? [];
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`내려받기 실패 ${res.status}: ${url}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

/**
 * 컨택트시트. 슬러그마다 한 줄이고 후보 번호가 사진 아래에 찍힌다 — `--pick=` 에 그대로
 * 옮겨 적으면 된다. 후보가 126장이라 이게 없으면 어느 슬러그의 몇 번인지 놓친다.
 */
async function writeContactSheet(manifest) {
  const rows = Object.entries(manifest)
    .map(([slug, list]) => {
      const cells = list
        .map(
          (c) =>
            `<figure><img src="${path.basename(c.file)}" alt=""><figcaption>${slug}:${c.n}</figcaption></figure>`,
        )
        .join("");
      return `<section><h2>${slug} <small>${QUERY[slug] ?? ""}</small></h2><div class="row">${cells}</div></section>`;
    })
    .join("\n");

  const html = `<!doctype html><meta charset="utf-8"><title>판정 사진 후보</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; background: #fafafa; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  h2 small { font-weight: 400; color: #888; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  figure { margin: 0; }
  img { width: 160px; height: 160px; object-fit: cover; border-radius: 8px; display: block; }
  figcaption { font-size: 12px; color: #555; margin-top: 4px; text-align: center; }
</style>
${rows}
`;
  await writeFile(path.join(CANDIDATES, "contact.html"), html, "utf8");
}

async function collectCandidates(apiKey, count, only) {
  await mkdir(CANDIDATES, { recursive: true });
  /* 한 슬러그만 다시 받을 때 나머지 후보 목록을 잃지 않는다. */
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    manifest = {};
  }

  for (const [slug, query] of Object.entries(QUERY)) {
    if (only && !only.includes(slug)) continue;
    const photos = await search(apiKey, query, count);
    manifest[slug] = [];

    for (const [index, photo] of photos.entries()) {
      const n = index + 1;
      const file = path.join(CANDIDATES, `${slug}-c${n}.jpg`);
      // 후보는 눈으로 고르기만 하면 되므로 작게 받는다 (확정본만 SIZE 로 다시 받는다).
      await download(sized(photo.src.large, 320, 320), file);
      manifest[slug].push({
        n,
        id: photo.id,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pageUrl: photo.url,
        alt: photo.alt,
        src: photo.src.large,
        file,
      });
      console.log(`${slug} c${n}  ${photo.alt || "(설명 없음)"}  — ${photo.photographer}`);
    }
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
  await writeContactSheet(manifest);
  console.log(`\n후보 ${CANDIDATES}`);
  console.log(`컨택트시트 ${path.join(CANDIDATES, "contact.html")}`);
  console.log("고르기: --pick=metabolism-balsan:2,element-su:1,... (슬러그:후보번호)");
}

async function finalize(pick) {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  await mkdir(OUT, { recursive: true });

  /*
   * 이미 확정된 목록을 먼저 읽어 **고른 슬러그만 덮어쓴다.** 21종을 한 번에 고르는 일은
   * 드물고, 병합이 없으면 CREDITS.md 가 방금 고른 몇 줄짜리로 줄어 나머지 출처가 사라진다.
   */
  let chosen = {};
  try {
    chosen = JSON.parse(await readFile(path.join(OUT, "photos.json"), "utf8"));
  } catch {
    chosen = {};
  }

  for (const [slug, n] of pick) {
    if (!(slug in QUERY)) throw new Error(`모르는 슬러그입니다: ${slug}`);
    const entry = manifest[slug]?.find((c) => c.n === n);
    if (!entry) throw new Error(`후보를 찾지 못했습니다: ${slug} c${n}`);
    await download(sized(entry.src, SIZE, SIZE), path.join(OUT, `${slug}.jpg`));
    chosen[slug] = {
      id: entry.id,
      photographer: entry.photographer,
      photographerUrl: entry.photographerUrl,
      pageUrl: entry.pageUrl,
      alt: entry.alt,
    };
    console.log(`확정 ${slug} ← c${n} (${entry.photographer})`);
  }

  await writeFile(path.join(OUT, "photos.json"), `${JSON.stringify(chosen, null, 2)}\n`, "utf8");

  const missing = Object.keys(QUERY).filter((slug) => !(slug in chosen));
  const credits = [
    "# 판정 콜아웃 사진 출처",
    "",
    "`node --env-file=.env.local scripts/fetch-verdict-photos.mjs` 가 만든 파일이다.",
    "**손으로 고치지 말 것** — 사진을 갈아끼우면 그 스크립트가 `photos.json` 과 이 표를",
    "다시 쓴다.",
    "",
    "Pexels 라이선스는 출처 표기를 요구하지 않지만(무료·상업적 사용 가능) API",
    "가이드라인이 촬영자 표기를 권하므로 여기에 남긴다. 화면에는 넣지 않는다 —",
    "사진은 장식(`alt` 이 빈 문자열)이고, 크레딧 줄을 붙이면 그 자리가 정보처럼 읽힌다.",
    "",
    "슬러그는 유형이 아니라 **판정 축의 값**이다 (`components/VerdictCallout.tsx`).",
    "",
    "| 슬러그 | 파일 | 무엇이 찍혔나 | 촬영 | 원본 |",
    "| --- | --- | --- | --- | --- |",
    ...Object.entries(chosen).map(
      ([slug, c]) =>
        `| \`${slug}\` | \`${slug}.jpg\` | ${c.alt || "(설명 없음)"} | [${c.photographer}](${c.photographerUrl}) | [Pexels ${c.id}](${c.pageUrl}) |`,
    ),
    "",
    ...(missing.length > 0
      ? [`> 아직 고르지 않은 슬러그: ${missing.map((s) => `\`${s}\``).join(", ")}`, ""]
      : []),
  ].join("\n");
  await writeFile(path.join(OUT, "CREDITS.md"), credits, "utf8");
}

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.PEXELS_API_KEY;
if (!apiKey) {
  console.error("PEXELS_API_KEY 가 없습니다. `node --env-file=.env.local ...` 로 실행하세요.");
  process.exit(1);
}

if (args.pick) await finalize(args.pick);
else await collectCandidates(apiKey, args.count, args.only);
