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
  // 두 유형이 공유한다
  "summary",
  // general
  "temperament",
  "ohaeng-balance",
  "relations",
  "current-flow",
  "next-steps",
  // diet
  "constitution",
  "gain-pattern",
  "diet-approach",
  "eating",
  "movement",
  "year-flow",
  "monthly-actions",
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
  diet: [
    { id: "summary", title: "한눈에 보기", emphasis: "summary" },
    { id: "constitution", title: "오행으로 본 체질" },
    { id: "gain-pattern", title: "살이 붙는 패턴" },
    { id: "diet-approach", title: "잘 맞는 다이어트 방법" },
    { id: "eating", title: "잘 맞는 식습관" },
    { id: "movement", title: "잘 맞는 움직임" },
    { id: "year-flow", title: "올해의 몸 흐름" },
    { id: "monthly-actions", title: "이번 달 실천 3가지" },
  ],
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
