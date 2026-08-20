/**
 * cards.json 의 photoQuery → Pexels 에서 후보 사진 내려받기 → 고른 것만 확정
 *
 *   1) 후보 받기
 *      node --env-file=.env.local docs/cardnews/fetch-photos.mjs
 *      → assets/candidates/<slug>-NN-cN.jpg 로 카드마다 여러 장
 *
 *   2) 눈으로 보고 고르기 (카드번호:후보번호)
 *      node --env-file=.env.local docs/cardnews/fetch-photos.mjs --pick=1:2,2:1,3:4
 *      → assets/<slug>-NN.jpg 로 확정 + cards.json 의 photo·photoCredit 갱신
 *
 * 두 단계로 나눈 이유는 스톡 검색 결과가 들쭉날쭉해서다. 첫 장을 자동으로
 * 물리면 세트 톤이 깨진 채로 렌더까지 가버린다 — 고르는 건 사람이 해야 한다.
 *
 * Pexels 라이선스는 출처 표기를 요구하지 않지만, API 가이드라인이 링크백을
 * 권하고 브랜드 콘텐츠에서는 촬영자를 밝히는 편이 맞아 photoCredit 에 적는다.
 */

import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* 사진은 **데이터(json)가 있는 폴더** 아래에 놓인다 — 주제마다 폴더를 나눌 수
 * 있게 하기 위해서다 (render.mjs 의 DATA_DIR 과 같은 규칙). */
let ASSETS = path.join(HERE, "assets");
let CANDIDATES = path.join(ASSETS, "candidates");

const API = "https://api.pexels.com/v1/search";

/** 사진 슬롯의 모양에 맞는 방향. 가로 슬롯에 세로 사진이 오면 심하게 잘린다. */
const ORIENTATION = {
  cover: "portrait",
  stack: "landscape",
  split: "portrait",
};

function parseArgs(argv) {
  const args = { pick: null, count: 5, data: null, force: false };
  for (const a of argv) {
    if (a === "--force") args.force = true;
    else if (a.startsWith("--pick=")) {
      args.pick = new Map(
        a
          .slice(7)
          .split(",")
          .map((pair) => {
            const [card, cand] = pair.split(":").map((n) => Number(n.trim()));
            return [card, cand];
          })
          .filter(([c, n]) => Number.isFinite(c) && Number.isFinite(n)),
      );
    } else if (a.startsWith("--count=")) {
      args.count = Math.max(1, Math.min(15, Number(a.slice(8)) || 5));
    } else if (!a.startsWith("--")) args.data = a;
  }
  return args;
}

async function search(apiKey, query, orientation, perPage) {
  const url = new URL(API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("size", "large");
  if (orientation) url.searchParams.set("orientation", orientation);

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (res.status === 401) {
    throw new Error("PEXELS_API_KEY 가 거부됐습니다. 키 값을 확인하세요.");
  }
  if (res.status === 429) {
    throw new Error("Pexels 요청 한도를 넘었습니다 (시간당 200). 잠시 후 다시.");
  }
  if (!res.ok) {
    throw new Error(`Pexels 오류 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()).photos ?? [];
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`내려받기 실패 ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/** 후보 파일명에 촬영자를 심어두면 --pick 단계에서 다시 조회하지 않아도 된다. */
const slugify = (s) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 24) || "unknown";

async function collect(args, data, apiKey) {
  await mkdir(CANDIDATES, { recursive: true });
  let found = 0;

  for (const [i, card] of data.cards.entries()) {
    const no = i + 1;
    const tag = String(no).padStart(2, "0");
    if (!card.photoQuery) continue;
    if (card.photo && !args.force) {
      console.log(`  ${tag} 건너뜀 (이미 photo 있음 — --force 로 다시)`);
      continue;
    }

    const orientation = ORIENTATION[card.layout];
    const photos = await search(apiKey, card.photoQuery, orientation, args.count);
    if (!photos.length) {
      console.log(`  ${tag} 결과 없음 — photoQuery 를 바꿔보세요: "${card.photoQuery}"`);
      continue;
    }

    console.log(`  ${tag} "${card.photoQuery}" (${orientation ?? "any"}) — ${photos.length}장`);
    for (const [j, photo] of photos.entries()) {
      const file = `${data.slug}-${tag}-c${j + 1}--${slugify(photo.photographer)}.jpg`;
      await download(photo.src.large2x ?? photo.src.large, path.join(CANDIDATES, file));
      console.log(`     c${j + 1}  ${photo.photographer}`);
      found += 1;
    }
  }

  console.log(`\n후보 ${found}장을 assets/candidates/ 에 받았습니다.`);
  console.log("보고 고른 뒤:");
  console.log("  node --env-file=.env.local docs\\cardnews\\fetch-photos.mjs --pick=1:2,2:1,3:4");
}

async function pick(args, data, dataPath) {
  const files = await readdir(CANDIDATES).catch(() => []);
  if (!files.length) throw new Error("후보가 없습니다. 먼저 --pick 없이 실행하세요.");

  for (const [cardNo, candNo] of args.pick) {
    const card = data.cards[cardNo - 1];
    if (!card) {
      console.log(`  카드 ${cardNo} 없음 — 건너뜀`);
      continue;
    }
    const tag = String(cardNo).padStart(2, "0");
    const prefix = `${data.slug}-${tag}-c${candNo}--`;
    const hit = files.find((f) => f.startsWith(prefix));
    if (!hit) {
      console.log(`  ${tag}: 후보 c${candNo} 를 찾지 못했습니다`);
      continue;
    }

    const final = `${data.slug}-${tag}.jpg`;
    await copyFile(path.join(CANDIDATES, hit), path.join(ASSETS, final));

    const photographer = hit.slice(prefix.length, -4).replace(/-/g, " ");
    card.photo = `assets/${final}`;
    card.photoCredit = `사진: Pexels / ${photographer}`;
    console.log(`  ${tag} ← c${candNo}  (${photographer})`);
  }

  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("\ncards.json 갱신 완료. 이어서 렌더:");
  console.log("  node docs\\cardnews\\render.mjs");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.PEXELS_API_KEY;
  const dataPath = path.resolve(args.data ?? path.join(HERE, "cards.json"));
  ASSETS = path.join(path.dirname(dataPath), "assets");
  CANDIDATES = path.join(ASSETS, "candidates");
  const data = JSON.parse(await readFile(dataPath, "utf8"));

  if (args.pick) return pick(args, data, dataPath);

  if (!apiKey) {
    throw new Error(
      "PEXELS_API_KEY 가 없습니다.\n" +
        "  https://www.pexels.com/api/ 에서 발급받아 .env.local 에 넣고:\n" +
        "  node --env-file=.env.local docs/cardnews/fetch-photos.mjs",
    );
  }
  return collect(args, data, apiKey);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
