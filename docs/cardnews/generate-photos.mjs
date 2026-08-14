/**
 * cards.json 의 photoPrompt → 카드 사진 생성 → assets/*.png
 *
 *   node --env-file=.env.local docs/cardnews/generate-photos.mjs
 *   node --env-file=.env.local docs/cardnews/generate-photos.mjs --only=1,3
 *   node --env-file=.env.local docs/cardnews/generate-photos.mjs --force
 *   node --env-file=.env.local docs/cardnews/generate-photos.mjs --variants=3
 *
 * 이미 photo 가 채워진 카드는 건너뛴다 (--force 로 다시 생성).
 * --variants 를 주면 카드마다 여러 장을 뽑아 고를 수 있게 한다. 생성 이미지는
 * 재료 형태가 어긋나는 경우가 있어서 사람 눈으로 걸러야 한다.
 *
 * 키는 서비스와 분리된 CARDNEWS_API_KEY 를 쓴다. 이 스크립트는
 * GEMINI_API_KEY 를 절대 읽지 않는다 — 두 키의 등급·프로젝트가 다르다.
 */

import { GoogleGenAI } from "@google/genai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "assets");

/**
 * 세트 전체의 톤을 맞추는 고정 문장. 카드마다 다른 프롬프트를 쓰더라도 이 문장이
 * 붙어 있으면 조명·색감·구도가 한 세트로 묶인다. 스톡 사진을 짜깁기할 때 제일
 * 안 맞는 부분이 이것이라, 생성으로 가는 이유의 절반이 여기에 있다.
 *
 * 글자를 넣지 말라고 강하게 지시한다 — 텍스트는 CSS 가 그리고, 사진에 글자가
 * 섞이면 카드 제목과 겹쳐서 못 쓴다.
 */
const STYLE = [
  "Professional food photography, editorial magazine quality.",
  "Soft natural daylight from the side, gentle shadows, shallow depth of field.",
  "Clean minimal composition with generous empty space.",
  "Warm neutral palette: cream, light wood, soft white.",
  "Absolutely no text, no letters, no numbers, no logos, no watermarks.",
  "No people, no hands.",
].join(" ");

/**
 * 레이아웃별 사진 슬롯에 가장 가까운 비율.
 * SDK 가 받는 값은 1:1 · 2:3 · 3:2 · 3:4 · 4:3 · 9:16 · 16:9 · 21:9 뿐이라
 * 4:5(카드 전체)나 1:3(split 의 좌측 띠)은 지정할 수 없다. 렌더러가
 * background-size: cover 로 가운데를 잘라내므로 가까운 쪽을 고르고 맡긴다.
 */
const ASPECT = {
  cover: "3:4", // 슬롯 1080×1350 (4:5)
  stack: "3:2", // 슬롯 1080×686
  split: "9:16", // 슬롯 440×1350 — 가장 세로로 긴 값
  plain: "4:3",
  notice: "4:3",
};

function parseArgs(argv) {
  const args = { force: false, only: null, variants: 1, data: null };
  for (const a of argv) {
    if (a === "--force") args.force = true;
    else if (a.startsWith("--only=")) {
      args.only = new Set(
        a
          .slice(7)
          .split(",")
          .map((n) => Number(n.trim())),
      );
    } else if (a.startsWith("--variants=")) {
      args.variants = Math.max(1, Number(a.slice(11)) || 1);
    } else if (!a.startsWith("--")) args.data = a;
  }
  return args;
}

/** 모델이 돌려준 파트에서 첫 이미지를 꺼낸다. */
function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) return part.inlineData.data;
  }
  // 이미지가 없으면 보통 안전 필터에 걸렸거나 모델이 글로 답한 경우다.
  const text = parts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);
  const reason = response?.candidates?.[0]?.finishReason;
  throw new Error(
    `이미지가 오지 않았습니다${reason ? ` (finishReason: ${reason})` : ""}` +
      (text ? `\n  모델 응답: ${text}` : ""),
  );
}

/** 실패 원인을 사람이 읽을 수 있는 문장으로. lib/gemini.ts 의 분류와 같은 결. */
function explain(err) {
  const msg = String(err?.message ?? err);
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(msg)) {
    if (/PerDay/i.test(msg) && /FreeTier/i.test(msg)) {
      // 실측(2026-08): 갓 발급한 무료 키가 첫 호출부터 이 오류를 낸다.
      // 이미지 모델의 무료 등급 일일 허용량이 0 이라는 뜻이다 — 기다려도 안 풀린다.
      return (
        "무료 등급에서는 이미지 생성 모델을 호출할 수 없습니다 (일일 허용량 0).\n" +
        "     이 키의 프로젝트에만 결제를 붙이거나, 스톡 사진으로 전환하세요."
      );
    }
    return /PerDay|daily/i.test(msg)
      ? "일일 할당량이 소진됐습니다. 내일 다시 시도하세요."
      : "분당 요청 한도를 넘었습니다. 잠시 후 다시 시도하세요.";
  }
  if (/API_KEY|401|403|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) {
    return "키가 거부됐습니다. CARDNEWS_API_KEY 값과 해당 프로젝트의 API 활성화를 확인하세요.";
  }
  if (/NOT_FOUND|404/i.test(msg)) {
    return "그 모델을 이 키로 쓸 수 없습니다. CARDNEWS_IMAGE_MODEL 을 확인하세요.";
  }
  return msg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.CARDNEWS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CARDNEWS_API_KEY 가 없습니다.\n" +
        "  .env.local 에 값을 넣고 --env-file 로 실행하세요:\n" +
        "  node --env-file=.env.local docs/cardnews/generate-photos.mjs",
    );
  }
  const model = process.env.CARDNEWS_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";

  const dataPath = path.resolve(args.data ?? path.join(HERE, "cards.json"));
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  const ai = new GoogleGenAI({ apiKey });
  await mkdir(ASSETS, { recursive: true });

  console.log(`모델: ${model}`);

  let made = 0;
  let skipped = 0;

  for (const [i, card] of data.cards.entries()) {
    const no = i + 1;
    const tag = String(no).padStart(2, "0");

    if (!card.photoPrompt) {
      skipped += 1;
      continue; // 사진 자리가 없는 레이아웃 (plain · notice)
    }
    if (args.only && !args.only.has(no)) continue;
    if (card.photo && !args.force) {
      console.log(`  ${tag} 건너뜀 (이미 photo 있음 — --force 로 재생성)`);
      skipped += 1;
      continue;
    }

    const prompt = `${card.photoPrompt}\n\n${STYLE}`;
    const aspectRatio = ASPECT[card.layout] ?? "1:1";

    for (let v = 1; v <= args.variants; v += 1) {
      const suffix = args.variants > 1 ? `-v${v}` : "";
      const file = `${data.slug}-${tag}${suffix}.png`;
      process.stdout.write(`  ${tag}${suffix} ${aspectRatio} 생성 중... `);

      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
        });
        const b64 = extractImage(response);
        await writeFile(path.join(ASSETS, file), Buffer.from(b64, "base64"));
        console.log(`assets/${file}`);

        // 첫 장만 자동으로 물린다. 나머지는 사람이 보고 고른다.
        if (v === 1) {
          card.photo = `assets/${file}`;
          card.photoCredit = "이미지: AI 생성";
        }
        made += 1;
      } catch (err) {
        console.log("실패");
        console.error(`     ${explain(err)}`);
      }
    }
  }

  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`\n생성 ${made}장 · 건너뜀 ${skipped}장`);
  if (made > 0) {
    console.log("cards.json 의 photo 를 갱신했습니다. 이어서 렌더:");
    console.log("  node docs\\cardnews\\render.mjs");
  }
}

main().catch((err) => {
  console.error(explain(err));
  process.exit(1);
});
