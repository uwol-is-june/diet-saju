import { type ReadingType } from "../saju/schema";

/**
 * 풀이의 섹션 계약 (TASK-06).
 *
 * ## 왜 JSON 구조화 출력을 쓰지 않는가
 *
 * `responseMimeType: "application/json"` + `responseSchema` 는 형식을 확실히 강제하지만
 * **완성 전까지 파싱이 불가능하다.** 도착 중인 `{"summary": "고객님은 태어` 는 문법적으로
 * 깨진 문자열이라 화면에 붙일 수 없고, 마지막 `}` 를 기다려야 한다. 지금 첫 글자가
 * 1.3초에 보이는 것을 4초로 바꾸는 대가다.
 *
 * 그래서 형식을 **섹션 계약**으로 강제한다. 모델은 마크다운을 그대로 흘려보내고,
 * `## 제목` 이 도착할 때마다 그 앞 섹션이 완결됐다고 보고 렌더한다. 첫 섹션이 1.5초쯤
 * 뜨면서 섹션별 컴포넌트도 얻는다.
 *
 * 대가는 정직하게 적어 둔다: 스키마를 **강제**하는 게 아니라 프롬프트로 **부탁**하는
 * 것이므로 모델이 형식을 어길 수 있다. 그래서 파서는 어긋난 출력을 버리지 않고
 * (`id: null` 로 담고, 아무것도 못 잡으면 `recognized: false`) 원문 폴백으로 넘긴다.
 * **모델 출력을 잃는 경로는 없다.**
 *
 * ## 이 파일은 클라이언트에서도 import 된다
 *
 * 그래서 `server-only` 가 없고 **프롬프트 지시문도 여기 두지 않는다.** 계약(제목·순서·강조)만
 * 담고, 각 섹션을 어떻게 쓸지에 대한 지시문은 `lib/prompt.ts` 가 id 로 붙인다.
 * 제목 문자열이 이 파일 하나에만 있으므로 프롬프트와 렌더러가 어긋날 수 없다.
 */

export const READING_SECTION_IDS = [
  // 모든 유형이 공유하는 유일한 id (요약은 유형마다 요구가 달라 지침만 따로 간다)
  "summary",
  // general
  "temperament",
  "ohaeng-balance",
  "relations",
  "current-flow",
  "next-steps",
  // diet — 몸이 어떤 쪽인가
  "constitution",
  "gain-pattern",
  "year-flow",
  // gain-cause — 왜 붙는가 (TASK-44)
  "gain-site",
  "gain-trigger",
  "gain-imbalance",
  "gain-misread",
  // diet-method — 그래서 무엇을 어떻게 하는가 (TASK-40)
  "diet-approach",
  "eating",
  "movement",
  "execution-window",
  "first-step",
  // diet-food — 무엇을 먹는가 (TASK-63)
  "food-why",
  "food-what",
  "food-enough",
  "food-how",
  "food-start",
  // exercise — 어떤 운동을 어떤 강도로 (TASK-48)
  "exercise-pick",
  "exercise-how",
  "exercise-when",
  "exercise-avoid",
  "exercise-start",
  // decade — 지금 흐르는 10년은 어떤 구간인가 (TASK-45)
  "decade-now",
  "decade-change",
  "decade-body",
  "decade-hold",
] as const;

export type ReadingSectionId = (typeof READING_SECTION_IDS)[number];

export interface ReadingSectionSpec {
  id: ReadingSectionId;
  /** 마크다운 `## ` 제목으로 그대로 쓰인다. 프롬프트와 파서의 단일 소스. */
  title: string;
  /** 요약은 카드로 강조한다 */
  emphasis?: "summary";
  /**
   * 조건에 따라 빠질 수 있는 섹션. 안 왔다고 진행률을 멈추지 않는다.
   * (`current-flow` 는 성별 미지정이면 대운이 없어 프롬프트가 건너뛰라고 지시한다)
   */
  optional?: boolean;
}

export const SECTION_SPECS: Record<ReadingType, readonly ReadingSectionSpec[]> = {
  general: [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "temperament", title: "타고난 기질" },
    { id: "ohaeng-balance", title: "오행 균형" },
    { id: "relations", title: "관계와 일" },
    { id: "current-flow", title: "지금의 흐름", optional: true },
    { id: "next-steps", title: "지금 신경 쓰면 좋은 것" },
  ],
  /**
   * 다이어트 계열 셋은 **묻는 것으로 갈라져 있다** — 쪽(diet) · 원인(gain-cause) ·
   * 방법(diet-method). **섹션 id 를 공유하지 않는다.** `SECTION_INSTRUCTION` 이 id 로
   * 매기므로 id 를 공유하면 맥락이 다른 유형들이 한 지시문을 떠안게 된다.
   */
  diet: [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "constitution", title: "오행으로 본 체질" },
    { id: "gain-pattern", title: "살이 붙는 패턴" },
    { id: "year-flow", title: "올해의 몸 흐름" },
  ],
  /**
   * 원인 유형 (TASK-44). `diet` 의 `gain-pattern` 과 **같은 판정을 다른 각도로 쓴다** —
   * 거기서는 체질 풀이 안의 한 절이라 패턴 이름과 장면 하나까지지만, 여기서는 원인이
   * 주제 전부라 걸리는 지점 · 상황 · 오행 치우침 · 오해로 나눠 파고든다.
   *
   * `diet` 에서 절을 떼어 오지 않은 것은 **`diet` 가 "종합" 이라는 약속을 지키기 위함**이다
   * (2026-08-14 결정). 대신 두 지시문이 서로 다른 것을 요구하게 해서 같은 문장이 두 번
   * 나오지 않게 막는다.
   *
   * **실행 방법 절이 없다.** 무엇을 어떻게 할지는 `diet-method` 몫이고, 결과 뒤 링크가
   * 이미 그쪽으로 보낸다. 여기에 순서를 넣으면 두 유형이 같은 말을 한다.
   */
  "gain-cause": [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "gain-site", title: "어디서부터 붙는가" },
    { id: "gain-trigger", title: "어떤 상황에서 붙는가" },
    { id: "gain-imbalance", title: "오행이 만드는 치우침" },
    { id: "gain-misread", title: "오해하기 쉬운 지점" },
  ],
  "diet-method": [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "diet-approach", title: "무엇을 먼저 고정할까" },
    { id: "movement", title: "어떤 운동 종류가 맞을까" },
    { id: "eating", title: "어떤 순서로 먹을까" },
    { id: "execution-window", title: "언제 어떻게 실행할까" },
    { id: "first-step", title: "이번 달 먼저 할 하나" },
  ],
  /**
   * 운동 유형 (TASK-48). `diet-method` 가 **무엇을 어떤 순서로** 를 다루는 데 비해
   * 이 유형은 **어떤 운동을** 하나로 좁힌다.
   *
   * **`diet-method` 의 `movement` 절을 떼어 오지 않았다** — 방법 유형에서 움직임을 빼면
   * "무엇을 어떻게" 가 반쪽이 된다 (`diet` 에 `gain-pattern` 을 남긴 것과 같은 판단).
   * 대신 **두 지침이 서로 다른 것을 요구한다**: `diet-method` 는 종류까지,
   * 여기는 종목·강도·시간대·주의까지. `prompt.test.ts` 가 두 지침을 대조한다.
   */
  /**
   * 식단 유형 (TASK-63). **`diet-method` 의 `eating` 절을 떼어 오지 않았다** — 방법 유형에서
   * 먹는 순서를 빼면 "무엇을 어떻게" 가 반쪽이 된다. 대신 다루는 층을 나눈다:
   * `diet-method` 는 **순서와 시각**, 여기는 **재료 범주·조리·온도**다.
   *
   * 제목은 재현하기 쉬운 낱말로 골랐다 (TASK-58 의 `움직-` 어간 교훈).
   * `무엇이 이미 충분한가` 는 과다 오행 절인데 **"덜어낸다"·"끊는다" 로 쓰지 않는다** —
   * 알레르기·지병을 모르므로 표현 범위가 "더 늘리지 않기" 까지다.
   */
  "diet-food": [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "food-why", title: "왜 이 식단인가" },
    { id: "food-what", title: "무엇을 곁들일까" },
    { id: "food-enough", title: "무엇이 이미 충분한가" },
    { id: "food-how", title: "어떻게 차려 먹을까" },
    { id: "food-start", title: "이번 주에 바꿀 한 가지" },
  ],
  exercise: [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "exercise-pick", title: "왜 이 운동인가" },
    { id: "exercise-how", title: "어떤 강도로 할까" },
    { id: "exercise-when", title: "언제 하면 좋을까" },
    { id: "exercise-avoid", title: "무리가 되는 지점" },
    { id: "exercise-start", title: "이번 주에 시작할 한 가지" },
  ],
  /**
   * 시기 유형 (TASK-45). 공개 유형 중 **유일하게 시간축이 주제**다.
   *
   * `diet` 의 `year-flow`(올해)와 층이 다르지만 **둘 다 시간을 말하므로 겹칠 위험이
   * `gain-cause` 때보다 크다.** 그래서 id 를 나누는 것으로 그치지 않고 지시문이 서로
   * 다른 것을 요구하게 했고 `prompt.test.ts` 가 두 절을 대조한다.
   *
   * **다음 10년을 판정하지 않는다** — 아직 오지 않은 시간을 말하면 예측이 된다.
   * 절은 지금 구간과 **직전 구간과의 차이**까지다.
   */
  decade: [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "decade-now", title: "지금 흐르는 10년" },
    { id: "decade-change", title: "직전 10년과 달라진 것", optional: true },
    { id: "decade-body", title: "몸에서 먼저 드러나는 자리" },
    { id: "decade-hold", title: "이 10년을 어떻게 쓸까" },
  ],
};

/**
 * 섹션 제목 앞에 붙는 아이콘 (TASK-46). **화면에서만 붙는다.**
 *
 * ## `title` 에 섞지 않는 이유
 *
 * 제목 문자열은 프롬프트와 파서의 **단일 소스**다. 계약을 `## 🌿 오행으로 본 체질` 로
 * 바꾸면 모델이 그 이모지까지 글자 하나 틀리지 않게 재현해야 파싱된다. 어긋나는 순간
 * 그 절이 `id: null` 로 떨어지고 **아이콘도 강조도 함께 사라진다.** 형식 강제 수단이
 * 부탁뿐인데 부탁할 것을 늘리는 셈이라, 아이콘은 렌더러가 id 로 붙인다.
 *
 * ## `Record` 인 이유
 *
 * `ReadingSectionSpec` 의 선택 필드로 두면 새 섹션이 조용히 아이콘 없이 나간다.
 * `Record<ReadingSectionId, string>` 이어야 섹션을 늘릴 때 여기가 컴파일 오류로 잡힌다
 * (`Record<ReadingType, …>` 를 유지하는 이유와 같다).
 *
 * ## 고르는 기준
 *
 * **흑백 폴백이 있는 흔한 이모지만.** 이형자 선택자가 필요한 문자(`⚖️` 등)는 선택자를
 * 붙인 채로 저장한다 — 빼면 플랫폼에 따라 글자 모양(⚖)으로 나온다.
 *
 * **공유 카드(`lib/share/draw-card.ts`)에는 넣지 않는다.** 캔버스 이모지는 OS 폰트에 따라
 * 두부(□)가 되고, 카드에 절 제목이 들어가지도 않는다.
 */
export const SECTION_ICON: Record<ReadingSectionId, string> = {
  summary: "🔎",

  // general
  temperament: "🌱",
  "ohaeng-balance": "⚖️",
  relations: "🤝",
  "current-flow": "🌊",
  "next-steps": "✅",

  // diet
  constitution: "🌿",
  "gain-pattern": "🔁",
  "year-flow": "📅",

  // gain-cause
  "gain-site": "📍",
  "gain-trigger": "⏰",
  "gain-imbalance": "🎚️",
  "gain-misread": "💡",

  // diet-method
  "diet-approach": "🧭",
  movement: "🏃",
  eating: "🍽️",
  "execution-window": "🌤️",
  "first-step": "📝",

  // diet-food — 장기·특정 식품 그림을 쓰지 않는다. 도구와 표지로 고른다.
  "food-why": "🧾",
  "food-what": "🧺",
  "food-enough": "🚦",
  "food-how": "🥄",
  "food-start": "✏️",

  // exercise
  "exercise-pick": "🎯",
  "exercise-how": "💪",
  "exercise-when": "🕗",
  "exercise-avoid": "🚧",
  "exercise-start": "🚀",

  // decade
  "decade-now": "🕙",
  "decade-change": "🔀",
  "decade-body": "👤",
  "decade-hold": "🧷",
};

// ── 파싱 ───────────────────────────────────────────────────────────────────

export interface ParsedSection {
  /** 계약에 없는 제목이면 null — 버리지 않고 그대로 보여준다 */
  id: ReadingSectionId | null;
  title: string;
  body: string;
  /** 다음 `## ` 가 왔거나 스트림이 끝났다 */
  complete: boolean;
  emphasis: "summary" | "normal";
}

export interface ParsedReading {
  /** 첫 `## ` 앞에 온 내용. 보통 비어 있지만 오면 버리지 않는다. */
  preamble: string;
  sections: ParsedSection[];
  /** 계약에 있는 섹션을 하나도 못 잡았다 → 호출자가 원문 폴백으로 간다 */
  recognized: boolean;
}

/** `## 제목` — `###` 은 섹션 경계가 아니라 섹션 안의 소제목이다. */
const HEADING = /^##(?!#)\s*(.*?)\s*$/;

/**
 * 아직 `#` 만 도착해 몇 단계 제목인지 알 수 없는 줄.
 *
 * `### 소제목` 이 오는 중이면 `##` 까지 받은 순간에는 섹션 제목과 구별할 수 없다.
 * 그대로 두면 빈 섹션이 하나 생겼다가 세 번째 `#` 이 오면서 사라진다 — 화면에서
 * 카드가 번쩍인다. 제목 글자가 한 자라도 오면 `#` 개수는 이미 확정이므로,
 * **해시만 있는 마지막 줄만** 보류하면 된다.
 */
const HASHES_ONLY = /^#{1,6}\s*$/;

/**
 * 도착한 마크다운을 섹션으로 가른다.
 *
 * **누적 문자열 전체를 매번 다시 파싱한다.** 증분 상태를 들고 있으면 조각 경계에서
 * 생기는 버그를 전부 떠안게 되는데, 풀이는 2,000자 내외라 다시 파싱해도 공짜다.
 *
 * @param streaming 아직 생성 중인가. 마지막 섹션의 `complete` 와 제목 접두어 매칭에 쓴다.
 */
export function parseReadingSections(
  markdown: string,
  readingType: ReadingType,
  streaming = false,
): ParsedReading {
  const specs = SECTION_SPECS[readingType];
  const specByTitle = new Map(specs.map((spec) => [spec.title, spec]));

  const preambleLines: string[] = [];
  const blocks: { title: string; lines: string[] }[] = [];

  const lines = markdown.split("\n");
  if (streaming && HASHES_ONLY.test(lines[lines.length - 1] ?? "")) {
    lines.pop();
  }

  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ title: heading[1] ?? "", lines: [] });
    } else if (blocks.length === 0) {
      preambleLines.push(line);
    } else {
      blocks[blocks.length - 1]!.lines.push(line);
    }
  }

  const sections = blocks.map((block, index) => {
    const isLast = index === blocks.length - 1;
    // 생성 중인 마지막 제목은 "한눈에" 처럼 잘려서 도착한다. 접두어로 맞춰 두면
    // 카드가 "모르는 섹션" 으로 한 번 번쩍이는 것을 막는다.
    const spec =
      specByTitle.get(block.title) ??
      (isLast && streaming ? findByPrefix(specs, block.title) : undefined);

    return {
      id: spec?.id ?? null,
      title: spec?.title ?? block.title,
      body: block.lines.join("\n").trim(),
      complete: !isLast || !streaming,
      emphasis: spec?.emphasis ?? "normal",
    } satisfies ParsedSection;
  });

  return {
    preamble: preambleLines.join("\n").trim(),
    sections,
    recognized: sections.some((section) => section.id !== null),
  };
}

/** 잘린 제목을 계약과 맞춰 본다. 빈 문자열은 아무것과도 맞추지 않는다. */
function findByPrefix(
  specs: readonly ReadingSectionSpec[],
  partialTitle: string,
): ReadingSectionSpec | undefined {
  if (partialTitle.length === 0) return undefined;
  return specs.find((spec) => spec.title.startsWith(partialTitle));
}
