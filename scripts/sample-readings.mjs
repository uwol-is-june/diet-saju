#!/usr/bin/env node
/**
 * 풀이 표본 수집 + 지표 (TASK-53).
 *
 * TASK-54~58 이 "풀이가 밋밋하다" 를 고치는데, **고치기 전 기준선이 없으면 좋아졌는지
 * 판단할 수 없다.** 느낌으로 비교하면 사후 합리화가 되므로 표본과 지표를 먼저 고정한다.
 *
 * ## 사람이 평가한다 — 지표는 보조다
 *
 * 아래 지표는 **"공감되는가" 를 재지 못한다.** 그건 셀 수 없다. 지표는 방향을 확인하는
 * 도구일 뿐이므로, **지표만 좋아지고 읽기가 나빠지면 지표를 버린다.** 판단은 산출물
 * 마크다운을 직접 읽고 한다. 이 문장을 지우지 말 것 — 지표를 목표로 삼는 순간
 * 지표를 맞추는 프롬프트가 나온다.
 *
 * ## 실제 경로를 그대로 지난다
 *
 * `lib/gemini.ts` 를 직접 부르지 않고 **로컬 dev 서버의 `POST /api/saju`** 를 두드린다.
 * 스트리밍·섹션 파싱·문장 분리를 전부 지나야 화면에 실제로 나오는 모양을 볼 수 있다.
 *
 * ## 쓰는 법
 *
 * ```bash
 * npm run dev                                                 # 다른 터미널에서
 * node scripts/sample-readings.mjs --label before
 * node scripts/sample-readings.mjs --label after --repeat 2   # ⑧ 회차 간 일치도까지
 * ```
 *
 * 옵션: `--base`(기본 http://localhost:3000) · `--label`(필수) · `--out` ·
 *       `--repeat`(기본 1) · `--types`(쉼표 구분, 기본 공개 유형 전부) · `--delay`(ms)
 *
 * ## 산출물은 커밋하지 않는다
 *
 * LLM 출력이라 덩어리가 크고 회차마다 다르다. 기본 출력 위치가 OS 임시 디렉터리인 것도
 * 그래서다. **저장소에 남기는 것은 `docs/saju-validation.md` 의 지표 표와 판단뿐이다.**
 *
 * ## 쿼터
 *
 * 표본 6 × 공개 유형 3 = 18 요청/회. `--repeat 2` 면 36. 무료 등급 한도는 500 RPD 이지만
 * (`CLAUDE.md` "무료 등급 일일 한도") 다섯 태스크가 각자 전후로 돌리므로 합계를 염두에 둘 것.
 * 요청은 `--delay`(기본 12.5초) 간격으로 **직렬**로 보낸다 — 로컬 레이트 리밋(기본 분당 5)과
 * 모델 RPM(15) 양쪽에 걸리지 않게 하기 위해서다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── 표본 ───────────────────────────────────────────────────────────────────
/**
 * **합성 생일만 쓴다.** 실제 사람의 생년월일을 표본에 넣지 않는다.
 *
 * 여섯 건이 판정 공간을 훑는다 — `constitution.ts` 의 축을 전수로 돌려 고른 것이라
 * 무작위가 아니다.
 *
 * | 축 | 커버 |
 * | --- | --- |
 * | `gainPattern`   | 근육형 · 식욕형 · 불규칙형 · 스트레스형 · 정체형 (5/5) |
 * | `metabolism`    | 발산형 3 · 축적형 3 (2/2) |
 * | `thermal`       | 한 · 서늘 · 중화 · 따뜻 · 열 (5/5) |
 * | `dietApproach`  | 활동량 · 식사량 조절 · 리듬 고정 · 회복 (4/4) |
 * | `movementKind`  | 유산소 · 근력 · 이완 · 저강도 (4/4) |
 * | `yearly.effect` | 보완 · 가중 · 중립 (3/3) |
 * | 특수 경로       | `even`(과다·부족 없음) · 시각 미상 + 성별 미지정(대운 없음) |
 *
 * `even` 은 흔치 않아(전수 표본에서 약 2%) 무작위로는 안 걸리므로 **따로 넣었다.**
 * 마지막 건은 시주가 빠지고 `daeun === null` 이라 프롬프트의 다른 가지를 탄다.
 *
 * 이름은 한 건에만 넣는다 — 호칭이 본문에 박히므로 있는 쪽과 없는 쪽을 둘 다 봐야 한다
 * (TASK-57 ⑥ 이 이 두 경로를 비교한다).
 *
 * `expect` 는 **판정이 밀렸는지 알리는 장치**다. `constitution.ts` 를 고치면 표본이
 * 조용히 다른 칸으로 옮겨 갈 수 있고, 그러면 전후 비교의 전제가 깨진다.
 */
const SAMPLES = [
  {
    id: "S1-불규칙-발산-한",
    input: { birthDate: "1972-01-14", birthTime: "03:20", gender: "female" },
    expect: { gainPattern: "불규칙형", metabolism: "발산형", thermal: "한" },
  },
  {
    id: "S2-정체-발산-서늘",
    input: { birthDate: "1972-02-14", birthTime: "03:20", gender: "male" },
    expect: { gainPattern: "정체형", metabolism: "발산형", thermal: "서늘" },
  },
  {
    id: "S3-식욕-축적-열",
    input: { birthDate: "1972-05-14", birthTime: "03:20", gender: "female" },
    expect: { gainPattern: "식욕형", metabolism: "축적형", thermal: "열" },
  },
  {
    id: "S4-근육-축적-중화",
    input: { birthDate: "1972-08-14", birthTime: "13:10", gender: "male" },
    expect: { gainPattern: "근육형", metabolism: "축적형", thermal: "중화" },
  },
  {
    // 과다·부족이 하나도 없는 원국 — 관리 축이 비어 프롬프트가 다른 가지를 탄다
    id: "S5-스트레스-발산-따뜻-even",
    input: { birthDate: "1974-09-14", birthTime: "08:45", gender: "female", name: "서연" },
    expect: { gainPattern: "스트레스형", metabolism: "발산형", thermal: "따뜻", even: true },
  },
  {
    // 시각 미상 + 성별 미지정 → 시주 없음 · 대운 없음
    id: "S6-시각미상-대운없음",
    input: { birthDate: "1990-05-17", gender: "unspecified" },
    expect: { gainPattern: "불규칙형", metabolism: "축적형", thermal: "열", timeUnknown: true },
  },
];

// ── 계약을 소스에서 읽는다 ─────────────────────────────────────────────────
/**
 * 섹션 제목과 공개 유형 목록을 **`lib/` 소스에서 뽑아 쓴다.**
 *
 * 제목 문자열은 `lib/reading/sections.ts` 하나에만 있어야 한다 (프롬프트와 렌더러의
 * 단일 소스). 여기에 베껴 두면 계약이 바뀔 때 이 스크립트만 조용히 옛 제목을 재는
 * 세 번째 사본이 된다. `.mjs` 라 TS 를 import 할 수 없으므로 소스를 정규식으로 읽는다 —
 * `lib/design/tokens.test.ts` 가 `globals.css` 를 파싱하는 것과 같은 방식이다.
 * 뽑히는 게 없으면 **조용히 통과하지 않고 즉시 죽는다.**
 */
function readContract() {
  const schema = readFileSync(path.join(ROOT, "lib/saju/schema.ts"), "utf8");
  const sections = readFileSync(path.join(ROOT, "lib/reading/sections.ts"), "utf8");

  const visibility = cut(schema, "export const READING_TYPE_VISIBILITY", "\n};");
  const publicTypes = [...visibility.matchAll(/(?:"([\w-]+)"|(\w[\w-]*)):\s*"public"/g)].map(
    (m) => m[1] ?? m[2],
  );

  const specs = cut(sections, "export const SECTION_SPECS", "\n};");
  const titles = {};
  for (const m of specs.matchAll(/\n {2}(?:"([\w-]+)"|(\w[\w-]*)):\s*\[([\s\S]*?)\n {2}\],/g)) {
    titles[m[1] ?? m[2]] = [...m[3].matchAll(/title:\s*"([^"]+)"/g)].map((t) => t[1]);
  }

  if (publicTypes.length === 0) throw new Error("공개 유형을 schema.ts 에서 못 읽었다");
  for (const type of publicTypes) {
    if (!titles[type]?.length) throw new Error(`${type} 섹션 제목을 sections.ts 에서 못 읽었다`);
  }
  return { publicTypes, titles };
}

function cut(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`소스에서 ${startMarker} 를 못 찾았다`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${startMarker} 의 끝을 못 찾았다`);
  return source.slice(start, end);
}

// ── 지표 정의 — 착수 시점에 고정한다 ───────────────────────────────────────
/**
 * **지표는 여기서 고정하고 나중에 바꾸지 않는다.** 고치고 나서 고르면 유리한 것만
 * 고르게 된다. 늘려야 할 이유가 생기면 기준선부터 다시 잰다.
 */

/** ② hedge 어미 — 판정을 무르게 만드는 어미. TASK-55 가 이 빈도를 내리려 한다. */
const HEDGE = ["편입니다", "쉽습니다", "경향", "수 있습니다", "듯합니다", "편이에요"];

/**
 * ③ 명리 용어 — 절을 이 말로 열면 첫 문장부터 남의 이야기가 된다 (TASK-56).
 * 근거 인용 자체를 세는 게 아니라 **여는 자리에 쓰였는지**만 본다 (근거 인용은 유지한다).
 */
const MYEONGRI = [
  "일간", "천간", "지지", "십신", "지장간", "오행", "원국", "사주", "월령", "월지", "일지",
  "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인",
  "신강", "신약", "득령", "득지", "득세", "왕상휴수사", "대운", "세운", "조후", "통근",
];

/**
 * ④ 장면 — **프록시다.** "구체적 장면인가" 를 기계가 판단할 수 없어서, 하루·한 주의
 * 시간·자리·상황을 가리키는 말이 든 문장을 센다. 절대값보다 **전후 차이**만 본다.
 */
const SCENE = [
  "아침", "점심", "저녁", "밤", "새벽", "주말", "평일", "퇴근", "출근", "야근", "회식",
  "약속", "냉장고", "책상", "소파", "침대", "엘리베이터", "계단", "장바구니", "배달",
  "하루", "한 주", "휴일", "출장", "회의", "간식", "야식",
];

/**
 * ⑥ 금지 어휘 — `lib/saju/constitution.test.ts` 의 두 목록과 **같은 계열**이다.
 * 그쪽은 판정 데이터를, 여기는 **모델이 실제로 쓴 본문**을 본다. 0건이 아니면 회귀다.
 *
 * **본문을 훑는 쪽은 문구 표를 훑는 쪽보다 오탐이 나기 쉽다.** 첫 회차에서 셋이 걸렸고
 * 전부 오탐이었다 (아래 `DISCLAIMER_MARKERS` · `역효과`). 오탐을 남겨 두면 TASK-55~58 이
 * 없는 회귀를 쫓게 되므로 **기준선을 확정하기 전에** 걷어냈다. 반대로 진짜를 놓치지
 * 않도록, 걷어낸 근거를 각 자리에 적어 둔다.
 *
 * **부정문(`칼로리나 단식을 찾는 것보다 …`, `질병의 문제가 아니라 …`)은 걸러내지
 * 않는다.** 걸러내려면 "아니라 / 보다 / 말고" 를 문맥으로 판단해야 하는데 그건 매번
 * 판단이 갈리고, 넓게 잡으면 진짜 위반이 같이 빠져나간다. **사람이 보라고 남겨 둔다** —
 * 이 지표는 게이트가 아니라 눈에 띄게 하는 장치다.
 */
const BANNED = [
  "치료", "완치", "처방", "진단", "질병", "질환", "증상", "효능", "약효",
  "해독", "독소", "면역", "항암", "염증", "혈압", "혈당", "콜레스테롤", "보장",
  "단식", "칼로리", "kcal", "저탄고지", "키토", "원푸드", "목표 체중", "보조제", "영양제",
  "온성", "냉성", "장부", "오장",
];

/**
 * `효과` 는 **`역효과` 를 뺀 것만** 센다. `무리한 절식은 역효과를 낳는다` 는 효능 주장이
 * 아니라 오히려 우리가 하려는 말이다. `견과`/`비견과 겁재` 오탐과 같은 계열이라
 * 부분 문자열로 두면 안 된다.
 */
const BANNED_PATTERNS = [{ label: "효과", re: /(?<!역)효과/ }];

/**
 * `진단`·`처방` 은 **면책 문장 안에서는 오탐이다.** `TYPE_RULES` 셋이 마지막 문장으로
 * "전문가와 상의" 를 요구하고, 모델은 그걸 `구체적인 진단과 처방은 전문가와 상의하세요`
 * 로 쓴다 — 진단을 하는 문장이 아니라 **하지 않는다고 말하는 문장**이다.
 * 그래서 그 문장이 전문가 권유를 함께 담고 있으면 세지 않는다.
 *
 * (TASK-57 ④ 가 이 면책 문장을 화면으로 옮기기로 하면 이 예외도 함께 지운다.)
 */
const DISCLAIMER_MARKERS = ["전문가", "의료진", "상의", "상담을 받"];

/** 수치 — 문구가 아니라 본문에서 잡는다. 월별 운세(`3월에는`)도 여기서 걸린다. */
const NUMERIC = [
  {
    label: "수치+단위",
    re: /\d+\s*(?:분|시간|초|회|세트|번씩|칼로리|kcal|kg|킬로|그램|잔|컵|주|개월)/g,
  },
  {
    // `주`·`달` 을 단위에서 뺐다 — 본문의 `한 주 동안 일정이 몰리면` 은 처방이 아니라
    // **장면**이다 (지표 ④ 의 `SCENE` 이 `한 주` 를 장면 어휘로 세고 있다).
    // `constitution.ts` 의 문구 표 검사는 반대로 `주` 를 막는다 — 그쪽은 실행 지시문이라
    // `주 3회` 계열이 실제 위험이기 때문이다. **문맥이 달라 목록도 다르다.**
    label: "한글 수치",
    re: /(?:^|[^가-힣])(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무)\s*(?:시간|분|초|개월|킬로|그램|칼로리|잔|컵|세트|회)(?![가-힣])/g,
  },
  { label: "월별 운세", re: /\d{1,2}\s*월(?:에|에는|부터|까지|이|은)/g },
];

/**
 * 한열은 라벨 글자를 그대로 쓰라고 지시하지 않는다 (`한` 한 글자를 세면 오탐투성이다).
 * 그래서 `THERMAL_GUIDE` 의 `tendency` 문구가 쓰는 말로 받는다.
 */
const THERMAL_WORDS = {
  한: ["차가운", "찬 쪽"],
  서늘: ["서늘"],
  중화: ["중화", "치우치지"],
  따뜻: ["따뜻"],
  열: ["열기", "더운"],
};

/** ⑤ 유형마다 본문이 반드시 인용해야 하는 판정 축. `chart` 이벤트 값에서 만든다. */
const REQUIRED_LABELS = {
  general: () => [],
  diet: (c) => [
    ["대사 기조", [c.metabolism]],
    ["살이 붙는 패턴", [c.gainPattern]],
    ["한열", THERMAL_WORDS[c.thermal]],
  ],
  "gain-cause": (c) => [
    ["걸리는 지점", [c.gainSite]],
    ["살이 붙는 패턴", [c.gainPattern]],
    ["대사 기조", [c.metabolism]],
  ],
  "diet-method": (c) => [
    ["접근 순서", [c.dietApproach]],
    ["움직임 종류", [c.movementKind]],
  ],
};

// ── 요청 ───────────────────────────────────────────────────────────────────
async function requestReading(base, sample, readingType) {
  const body = {
    ...sample.input,
    readingType,
    calendar: "solar",
    solarTimeMode: "longitude",
    dayBoundary: "yajasi",
  };

  const started = Date.now();
  const response = await fetch(`${base}/api/saju`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`HTTP ${response.status} — ${detail.slice(0, 200)}`);
    error.status = response.status;
    throw error;
  }

  let chart = null;
  let model = null;
  let reading = "";
  let streamError = null;
  let ttfbMs = null;

  // NDJSON — 한 줄에 이벤트 하나. 줄이 조각 경계에 걸리므로 버퍼에 모아 가른다.
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === "chart") {
        chart = event.chart;
        model = event.model;
      } else if (event.type === "delta") {
        ttfbMs ??= Date.now() - started;
        reading += event.text;
      } else if (event.type === "error") {
        // 200 안의 실패다 — 상태 코드로는 안 보인다 (`CLAUDE.md` "스트리밍 응답 규약").
        streamError = event.error;
      }
    }
  }

  return { chart, model, reading, streamError, ttfbMs, totalMs: Date.now() - started };
}

// ── 지표 계산 ──────────────────────────────────────────────────────────────
/** `## 제목` 으로 가른다. 계약과 같은 규칙(`###` 은 경계가 아니다). */
function splitSections(markdown) {
  const blocks = [];
  for (const line of markdown.split("\n")) {
    const heading = /^##(?!#)\s*(.*?)\s*$/.exec(line);
    if (heading) blocks.push({ title: heading[1], lines: [] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  return blocks.map((block) => ({ title: block.title, body: block.lines.join("\n").trim() }));
}

/**
 * 문장으로 가른다. `lib/reading/line-breaks.ts` 와 **같은 규칙**이다 — 화면에서 문단이
 * 되는 단위를 그대로 세야 "절당 문장 수" 가 화면과 맞는다.
 */
const SENTENCE_END = /([가-힣)\]』」”’"'])([.!?]+)[ \t]+(?=\S)/g;
const STRUCTURAL_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|)/;

function sentences(text) {
  return text
    .split("\n")
    .filter((line) => line.trim() && !STRUCTURAL_LINE.test(line))
    .flatMap((line) => line.replace(SENTENCE_END, "$1$2\n").split("\n"))
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countAll(text, needles) {
  return needles.reduce((sum, needle) => sum + text.split(needle).length - 1, 0);
}

function measure({ sample, readingType, chart, reading, contract, timing }) {
  const sections = splitSections(reading);
  const expectedTitles = contract.titles[readingType] ?? [];
  const gotTitles = sections.map((section) => section.title);

  const bodies = sections.map((section) => section.body);
  const allSentences = bodies.flatMap(sentences);
  const chars = reading.replace(/\s/g, "").length;

  // ③ 절을 명리 용어로 여는 비율 — 각 절의 첫 문장만 본다
  const openedWithTerm = sections.filter((section) => {
    const first = sentences(section.body)[0] ?? "";
    return MYEONGRI.some((term) => first.includes(term));
  }).length;

  // ④ 장면 문장 — 프록시
  const sceneSentences = allSentences.filter((sentence) =>
    SCENE.some((word) => sentence.includes(word)),
  ).length;

  // ⑤ 판정 라벨 인용
  const labels = (REQUIRED_LABELS[readingType] ?? (() => []))(chart.constitution).map(
    ([axis, accepted]) => ({ axis, cited: accepted.some((word) => reading.includes(word)) }),
  );

  // ⑥ 금지 어휘 + 수치
  // 문장 단위로 본다 — 면책 문장 예외를 걸려면 어느 문장에 들어 있는지 알아야 한다.
  const bannedHits = allSentences.flatMap((sentence) => {
    // 예외는 **`진단`·`처방` 두 낱말에만** 준다. 문장을 통째로 면제하면
    // "전문가와 상의하세요" 를 붙이는 것만으로 어떤 주장이든 빠져나간다.
    const exempt = DISCLAIMER_MARKERS.some((marker) => sentence.includes(marker))
      ? ["진단", "처방"]
      : [];
    return [
      ...BANNED.filter((word) => !exempt.includes(word) && sentence.includes(word)),
      ...BANNED_PATTERNS.filter(({ re }) => re.test(sentence)).map(({ label }) => label),
    ];
  });
  const numericHits = NUMERIC.flatMap(({ label, re }) =>
    [...reading.matchAll(re)].map((match) => `${label}:${match[0].trim()}`),
  );

  const hedgeCount = countAll(reading, HEDGE);

  return {
    sample: sample.id,
    readingType,
    // ① 자수 · 절당 문장 수
    chars,
    sectionCount: sections.length,
    sentencesPerSection: bodies.map((body) => sentences(body).length),
    meanSentencesPerSection: round(allSentences.length / Math.max(sections.length, 1)),
    // ② hedge — 1,000자당으로 정규화해야 분량이 늘어난 회차와 비교된다 (TASK-56 이 분량을 늘린다)
    hedgeCount,
    hedgePer1000: round((hedgeCount / Math.max(chars, 1)) * 1000),
    // ③
    openedWithTerm,
    openedWithTermRatio: round(openedWithTerm / Math.max(sections.length, 1)),
    // ④
    sceneSentences,
    sceneRatio: round(sceneSentences / Math.max(allSentences.length, 1)),
    // ⑤
    labels,
    labelsCited: labels.filter((label) => label.cited).length,
    labelsTotal: labels.length,
    // ⑥
    bannedHits,
    numericHits,
    // ⑦ 섹션 제목 준수 — 순서까지 같아야 한다
    titlesOk: JSON.stringify(gotTitles) === JSON.stringify(expectedTitles),
    gotTitles,
    // ⑨ 절 사이 단어 일치도 — **TASK-58 이 이 값으로 자기 필요 여부를 정한다.**
    // 파생 절이 같은 값을 여러 이름으로 되풀이하면 절끼리 낱말이 겹친다.
    // 회차 간 일치도(⑧)와 같은 Jaccard 지만 **비교 대상이 다르다** (한 풀이 안의 절끼리).
    sectionOverlap: meanPairwiseJaccard(bodies),
    ...timing,
  };
}

/**
 * ⑨ 절 사이 평균 일치도. 요약 절은 뺀다 — 요약은 나머지를 줄여 말하는 자리라
 * 겹치는 것이 정상이고, 넣으면 어느 유형이든 값이 올라가 비교가 안 된다.
 */
function meanPairwiseJaccard(bodies) {
  const rest = bodies.slice(1);
  const pairs = [];
  for (let i = 0; i < rest.length; i += 1) {
    for (let j = i + 1; j < rest.length; j += 1) pairs.push(jaccard(rest[i], rest[j]));
  }
  return mean(pairs);
}

/** ⑧ 회차 간 단어 일치도 — Jaccard. `lib/gemini.ts` 의 temperature 주석과 **같은 방법**이다. */
function jaccard(a, b) {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  const shared = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : round(shared / union);
}

const round = (value) => Math.round(value * 1000) / 1000;
const mean = (list) => (list.length ? round(list.reduce((a, b) => a + b, 0) / list.length) : 0);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── 실행 ───────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { base: "http://localhost:3000", repeat: 1, delay: 12_500 };
  for (let i = 0; i < argv.length; i += 1) {
    const [key, inline] = argv[i].replace(/^--/, "").split("=");
    const value = inline ?? argv[(i += 1)];
    if (key === "repeat" || key === "delay") args[key] = Number(value);
    else args[key] = value;
  }
  if (!args.label) throw new Error("--label 이 필요하다 (예: --label before)");
  args.out ??= path.join(tmpdir(), "diet-saju-samples", args.label);
  return args;
}

/** 판정이 밀렸는지 — `constitution.ts` 를 고치면 표본이 다른 칸으로 옮겨 갈 수 있다. */
function checkDrift(sample, chart) {
  const actual = {
    gainPattern: chart.constitution.gainPattern,
    metabolism: chart.constitution.metabolism,
    thermal: chart.constitution.thermal,
    even: chart.constitution.even,
    timeUnknown: chart.timeUnknown,
  };
  return Object.entries(sample.expect)
    .filter(([axis, want]) => actual[axis] !== want)
    .map(([axis, want]) => `${axis} ${want}→${actual[axis]}`);
}

/** 429 는 레이트 리밋이다 — 기다렸다 다시 보낸다. 나머지는 그대로 올린다. */
async function withRetry(run, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (error.status !== 429 || attempt >= attempts) throw error;
      console.log(`    · 429 — 60초 기다렸다 다시 (${attempt}/${attempts - 1})`);
      await sleep(60_000);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = readContract();
  const types = args.types ? args.types.split(",") : contract.publicTypes;
  const planned = SAMPLES.length * types.length * args.repeat;

  mkdirSync(args.out, { recursive: true });
  console.log(`표본 ${SAMPLES.length} × 유형 ${types.length} × 회차 ${args.repeat} = ${planned} 요청`);
  console.log(`출력: ${args.out}\n`);

  const rows = [];
  const byKey = new Map(); // ⑧ 회차 비교용
  const failures = [];

  for (let run = 1; run <= args.repeat; run += 1) {
    for (const sample of SAMPLES) {
      for (const type of types) {
        const tag = `${sample.id}/${type}#${run}`;
        let result;
        try {
          result = await withRetry(() => requestReading(args.base, sample, type));
        } catch (error) {
          failures.push(`${tag} — ${error.message}`);
          console.log(`  ✗ ${tag}: ${error.message}`);
          await sleep(args.delay);
          continue;
        }

        if (result.streamError) {
          // 200 안의 실패. 부분 결과가 있어도 지표에 넣지 않는다 — 잘린 글이다.
          failures.push(`${tag} — 스트림 error 이벤트: ${result.streamError}`);
          console.log(`  ✗ ${tag}: ${result.streamError}`);
          await sleep(args.delay);
          continue;
        }

        const drift = checkDrift(sample, result.chart);
        if (drift.length) failures.push(`${tag} — 판정이 밀렸다: ${drift.join(", ")}`);

        writeFileSync(
          path.join(args.out, `${sample.id}__${type}__run${run}.md`),
          result.reading,
          "utf8",
        );

        const row = measure({
          sample,
          readingType: type,
          chart: result.chart,
          reading: result.reading,
          contract,
          timing: { run, ttfbMs: result.ttfbMs, totalMs: result.totalMs, model: result.model },
        });
        rows.push(row);

        const key = `${sample.id}/${type}`;
        byKey.set(key, [...(byKey.get(key) ?? []), result.reading]);

        console.log(
          `  ✓ ${tag}  ${row.chars}자 · 절 ${row.sectionCount} · hedge ${row.hedgeCount} · ` +
            `장면 ${row.sceneSentences} · 라벨 ${row.labelsCited}/${row.labelsTotal} · ` +
            `제목 ${row.titlesOk ? "○" : "×"} · ${(row.totalMs / 1000).toFixed(1)}s`,
        );
        await sleep(args.delay);
      }
    }
  }

  const consistency = [...byKey.entries()]
    .filter(([, readings]) => readings.length > 1)
    .map(([key, readings]) => ({
      key,
      jaccard: mean(readings.slice(1).map((text) => jaccard(readings[0], text))),
    }));

  const summary = summarize(rows, consistency, failures, args);
  writeFileSync(
    path.join(args.out, "metrics.json"),
    JSON.stringify({ rows, consistency, failures }, null, 2),
    "utf8",
  );
  writeFileSync(path.join(args.out, "summary.md"), summary, "utf8");
  console.log(`\n${summary}`);
  console.log(`\n지표: ${path.join(args.out, "metrics.json")}`);
  console.log("**이 표는 보조다. 판단은 위 디렉터리의 .md 를 직접 읽고 한다.**");

  if (failures.length) process.exitCode = 1;
}

function summarize(rows, consistency, failures, args) {
  const types = [...new Set(rows.map((row) => row.readingType))];
  const lines = [
    `# 풀이 지표 — ${args.label}`,
    "",
    `표본 ${SAMPLES.length} · 유형 ${types.length} · 회차 ${args.repeat} · 성공 ${rows.length}건`,
    `모델 \`${rows[0]?.model ?? "?"}\``,
    "",
    "| 유형 | 자수 | 절당 문장 | hedge/1000자 | 명리로 연 절 | 장면 비율 | 절 사이 일치도 | 라벨 인용 | 제목 준수 | 첫 글자 | 전체 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const type of types) {
    const group = rows.filter((row) => row.readingType === type);
    lines.push(
      `| \`${type}\` | ${mean(group.map((r) => r.chars))} | ` +
        `${mean(group.map((r) => r.meanSentencesPerSection))} | ` +
        `${mean(group.map((r) => r.hedgePer1000))} | ` +
        `${mean(group.map((r) => r.openedWithTermRatio))} | ` +
        `${mean(group.map((r) => r.sceneRatio))} | ` +
        `${mean(group.map((r) => r.sectionOverlap))} | ` +
        `${group.reduce((s, r) => s + r.labelsCited, 0)}/${group.reduce((s, r) => s + r.labelsTotal, 0)} | ` +
        `${group.filter((r) => r.titlesOk).length}/${group.length} | ` +
        `${mean(group.map((r) => r.ttfbMs ?? 0))}ms | ${mean(group.map((r) => r.totalMs))}ms |`,
    );
  }

  const banned = rows.flatMap((row) => row.bannedHits);
  const numeric = rows.flatMap((row) => row.numericHits);
  lines.push(
    "",
    `- **금지 어휘**: ${banned.length}건${banned.length ? ` — ${[...new Set(banned)].join(", ")}` : ""}`,
    `- **수치·월별**: ${numeric.length}건${numeric.length ? ` — ${[...new Set(numeric)].slice(0, 10).join(", ")}` : ""}`,
  );

  if (consistency.length) {
    lines.push(
      "",
      `- **회차 간 단어 일치도(Jaccard)**: 평균 ${mean(consistency.map((c) => c.jaccard))} ` +
        "(`lib/gemini.ts` 의 기준선 0.343 과 같은 방법)",
    );
  } else {
    lines.push("", "- **회차 간 단어 일치도**: 회차가 1이라 재지 않았다 (`--repeat 2` 필요)");
  }

  if (failures.length) lines.push("", "## 실패", ...failures.map((failure) => `- ${failure}`));
  return lines.join("\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
