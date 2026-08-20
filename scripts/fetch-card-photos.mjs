/**
 * `/` 유형 카드 사진 — Pexels 에서 후보 받기 → 고른 것만 확정 (TASK-86)
 *
 *   1) 후보 받기
 *      node --env-file=.env.local scripts/fetch-card-photos.mjs
 *      → OS 임시 디렉터리에 `<type>-cN.jpg` 로 유형마다 여러 장 (커밋하지 않는다)
 *
 *   2) 눈으로 보고 고르기 (유형:후보번호)
 *      node --env-file=.env.local scripts/fetch-card-photos.mjs --pick=diet:2,exercise:1
 *      → `public/cards/<type>.jpg` 로 확정 + `public/cards/CREDITS.md` 갱신
 *
 * 두 단계로 나눈 이유는 `docs/cardnews/fetch-photos.mjs` 와 같다 — 스톡 검색 결과가
 * 들쭉날쭉해서 첫 장을 자동으로 물리면 세트 톤이 깨진 채로 화면까지 가버린다.
 *
 * ## 자산은 우리 도메인에서 서빙한다
 *
 * Pexels URL 을 화면에서 직접 물지 않는다. 방문자 브라우저가 제3자에 요청을 보내면
 * `app/privacy/page.tsx` 4·5항("외부 도구를 전혀 쓰지 않습니다")이 거짓이 된다
 * (`public/dasii/` QR 두 개와 같은 판단).
 *
 * ## 크기는 받을 때 정한다
 *
 * Pexels 이미지 URL 은 `?w=&h=&fit=crop` 을 받는다. 원본(수 MB)을 받아 저장소에 넣고
 * 화면에서 줄이는 대신 **필요한 크기로 잘라서 받는다** — 커밋되는 자산이 작아지고
 * 리사이즈 의존성(sharp 등)이 필요 없다. 받는 크기는 아래 `SIZE` 가 정한다.
 *
 * ## 피사체 규칙 (CLAUDE.md "유형 카드 사진")
 *
 * 사람이 없는 정물만 쓴다. 몸을 찍으면 신체 평가가 되고, 특정 음식 한 접시를 찍으면
 * `ELEMENT_FOOD` 닫힌 목록을 판정 코드 밖에서 우회하는 셈이 된다. 식사 도구까지가 경계다.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(ROOT, "public", "cards");
const CANDIDATES = path.join(os.tmpdir(), "diet-saju-card-photos");
const MANIFEST = path.join(CANDIDATES, "candidates.json");

const API = "https://api.pexels.com/v1/search";
/**
 * 카드 슬롯이 정사각에 가깝다 — 세로 사진이 오면 위아래가 심하게 잘린다.
 *
 * 480 인 이유: 슬롯이 390px 화면에서 약 150 CSS 픽셀이라 DPR 3 까지 덮는다. 640 으로
 * 받으면 필름 그레인이 있는 사진 하나가 590KB 가 되는데(480 에서 327KB) 150px 장식에
 * 치를 값이 아니다. 화면에서는 `next/image` 가 여기서 한 번 더 줄여 webp 로 내보낸다.
 */
const SIZE = 480;

/**
 * 유형별 검색어. **`PUBLIC_READING_TYPES` 를 여기 베껴 둔 것이 아니다** — 유형이 늘면
 * 화면 쪽 `Record<ReadingType, …>` 가 컴파일 오류로 잡고, 이 표는 그때 검색어를 더한다.
 * 아래 검색어는 전부 "사람 없는 정물" 로 좁혀 둔 것이다 (위 피사체 규칙).
 */
const QUERY = {
  diet: "green leaves close up soft natural light",
  "gain-cause": "cozy sofa living room evening warm light",
  "diet-method": "open notebook pen wooden table morning light",
  "diet-food": "empty white bowl wooden table sunlight kitchen",
  exercise: "white sneakers minimal clean background",
};

function parseArgs(argv) {
  const args = { pick: null, count: 5, only: null };
  for (const a of argv) {
    if (a.startsWith("--pick=")) {
      args.pick = new Map(
        a
          .slice(7)
          .split(",")
          .map((pair) => {
            const [type, index] = pair.split(":");
            return [type?.trim(), Number(index)];
          })
          .filter(([type, index]) => type && Number.isFinite(index)),
      );
    } else if (a.startsWith("--only=")) {
      // 한 유형만 다시 받는다 — 검색어를 다듬는 동안 나머지 후보를 헛되게 받지 않는다.
      args.only = a.slice(7).split(",").map((t) => t.trim());
    } else if (a.startsWith("--count=")) {
      args.count = Math.max(1, Math.min(10, Number(a.slice(8)) || 5));
    }
  }
  return args;
}

/*
 * `size=large` 를 걸지 않는다. 우리가 쓰는 크기가 480px 라 초고해상도만 남길 이유가 없고,
 * 걸면 후보 풀이 확 줄어 검색어와 상관없는 사진이 올라온다 (실제로 `dumbbells` 검색에
 * 성운 사진과 고양이가 나왔다).
 */

/** Pexels 이미지 URL 에 크기·크롭을 얹는다. `src.original` 은 파라미터를 받지 않으므로 쓰지 않는다. */
function sized(src, width, height) {
  const url = new URL(src);
  url.searchParams.set("auto", "compress");
  url.searchParams.set("cs", "tinysrgb");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  /* **화질 파라미터(`q`)는 먹히지 않는다** — Pexels 는 `auto`·`cs`·`fit`·`w`·`h`·`dpr`
     만 받는다(실측: q=72 와 q=50 이 같은 바이트 수). 파일 크기를 줄이는 손잡이는
     `w`/`h` 하나뿐이라 `SIZE` 를 슬롯에 맞게 정한다. */
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

async function collectCandidates(apiKey, count, only) {
  await mkdir(CANDIDATES, { recursive: true });
  /* 한 유형만 다시 받을 때 나머지 후보 목록을 잃지 않는다. */
  let manifest = {};
  if (only) {
    try {
      manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
    } catch {
      manifest = {};
    }
  }

  for (const [type, query] of Object.entries(QUERY)) {
    if (only && !only.includes(type)) continue;
    const photos = await search(apiKey, query, count);
    manifest[type] = [];

    for (const [index, photo] of photos.entries()) {
      const n = index + 1;
      const file = path.join(CANDIDATES, `${type}-c${n}.jpg`);
      // 후보는 눈으로 고르기만 하면 되므로 작게 받는다 (확정본만 640 으로 다시 받는다).
      await download(sized(photo.src.large, 320, 320), file);
      manifest[type].push({
        n,
        id: photo.id,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pageUrl: photo.url,
        alt: photo.alt,
        src: photo.src.large,
        file,
      });
      console.log(`${type} c${n}  ${photo.alt || "(설명 없음)"}  — ${photo.photographer}`);
    }
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\n후보 ${CANDIDATES}`);
  console.log("고르기: --pick=diet:2,gain-cause:1,... (유형:후보번호)");
}

async function finalize(pick) {
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  await mkdir(OUT, { recursive: true });

  /*
   * 이미 확정된 사진 목록을 먼저 읽어 **고른 유형만 덮어쓴다.** 한 유형만 다시 고르는
   * 일이 흔한데(검색어를 다듬다 보면 그렇게 된다) 이 병합이 없으면 CREDITS.md 가
   * 방금 고른 한 줄짜리로 줄어들어 나머지 사진의 출처가 사라진다.
   */
  let chosen = {};
  try {
    chosen = JSON.parse(await readFile(path.join(OUT, "photos.json"), "utf8"));
  } catch {
    chosen = {};
  }

  for (const [type, n] of pick) {
    const entry = manifest[type]?.find((c) => c.n === n);
    if (!entry) throw new Error(`후보를 찾지 못했습니다: ${type} c${n}`);
    await download(sized(entry.src, SIZE, SIZE), path.join(OUT, `${type}.jpg`));
    chosen[type] = {
      id: entry.id,
      photographer: entry.photographer,
      photographerUrl: entry.photographerUrl,
      pageUrl: entry.pageUrl,
      alt: entry.alt,
    };
    console.log(`확정 ${type} ← c${n} (${entry.photographer})`);
  }

  await writeFile(path.join(OUT, "photos.json"), `${JSON.stringify(chosen, null, 2)}\n`, "utf8");

  /**
   * 출처 표기. Pexels 라이선스는 표기를 요구하지 않지만 API 가이드라인이 촬영자
   * 표기를 권한다. **화면에는 넣지 않는다** — 카드 사진은 `alt=""` 인 장식이라
   * 크레딧 줄이 붙으면 그 자리가 정보처럼 읽힌다. 대신 자산 옆에 적어 둔다.
   */
  const credits = [
    "# `/` 유형 카드 사진 출처",
    "",
    "`node --env-file=.env.local scripts/fetch-card-photos.mjs` 가 만든 파일이다.",
    "**손으로 고치지 말 것** — 사진을 갈아끼우면 그 스크립트가 `photos.json` 과 이 표를",
    "다시 쓴다.",
    "",
    "Pexels 라이선스는 출처 표기를 요구하지 않지만(무료·상업적 사용 가능) API",
    "가이드라인이 촬영자 표기를 권하므로 여기에 남긴다. 화면에는 넣지 않는다 —",
    '사진은 `alt=""` 인 장식이고, 크레딧 줄을 붙이면 그 자리가 정보처럼 읽힌다.',
    "",
    "| 유형 | 파일 | 무엇이 찍혔나 | 촬영 | 원본 |",
    "| --- | --- | --- | --- | --- |",
    ...Object.entries(chosen).map(
      ([type, c]) =>
        `| \`${type}\` | \`${type}.jpg\` | ${c.alt || "(설명 없음)"} | [${c.photographer}](${c.photographerUrl}) | [Pexels ${c.id}](${c.pageUrl}) |`,
    ),
    "",
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
