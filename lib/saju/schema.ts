import { z } from "zod";
import type {
  DaeunAnalysis,
  OhaengAnalysis,
  SeunYear,
  StrengthAnalysis,
} from "./analysis";
import type { ConstitutionAnalysis } from "./constitution";
import type { DecadeAnalysis } from "./decade";
import type { YearlyAnalysis } from "./yearly";

/**
 * 사주 입력 스키마 — 클라이언트/서버 공용.
 * 서버는 이 스키마를 반드시 다시 통과시킨다 (클라이언트 검증은 UX용, 신뢰 대상 아님).
 */

/**
 * 풀이 유형. **순서가 UI 순서다.**
 *
 * 유형을 추가하면 타입이 강제하는 곳(섹션 계약·프롬프트 지침·공유 카드 칩)이 전부 컴파일
 * 오류로 잡힌다. **`Record<ReadingType, …>` 를 유지한다** — 인덱스 시그니처로 바꾸면
 * 새 유형이 조용히 빈 값으로 나간다.
 */
export const READING_TYPES = [
  "general",
  "diet",
  "gain-cause",
  "diet-method",
  "diet-food",
  "exercise",
  "decade",
] as const;
export type ReadingType = (typeof READING_TYPES)[number];

/**
 * **id 를 바꾸지 않는다.** 세그먼트가 곧 URL 이라 바꾸면 이미 공유된 링크와 공유 카드가 죽는다.
 *
 * 다이어트 계열은 **묻는 것이 서로 다르다.**
 *   `diet`        몸이 어떤 쪽인가 (체질·패턴·올해 흐름)
 *   `gain-cause`  왜 붙는가 (걸리는 지점·상황·치우침)
 *   `diet-method` 그래서 무엇을 어떻게 하는가 (순서·종류·실행 조건)
 *   `diet-food`   무엇을 먹는가 (재료 범주·조리·온도)
 *   `exercise`    어떤 운동을 하는가 (종목·강도·시간대)
 * 목록 순서가 UI 순서이므로 체질 → 원인 → 방법 → 식단 → 운동으로 둔다.
 */
export const READING_TYPE_LABEL: Record<ReadingType, string> = {
  general: "종합 사주 풀이",
  diet: "종합 체질 풀이",
  "gain-cause": "내가 살이 찌는 이유",
  "diet-method": "나에게 맞는 다이어트 방법",
  "diet-food": "나에게 맞는 다이어트 식단",
  exercise: "나에게 맞는 운동",
  decade: "몸이 바뀌는 10년",
};

/**
 * 유형 카드의 **묻는 것 한 줄** — `/` 리스트 카드에서 제목 위 강조색 줄이다.
 *
 * **라벨을 다시 쓴 것이 아니다.** 라벨은 무엇을 주는지(`나에게 맞는 운동`), 이 줄은
 * 무엇을 묻는지(`어떤 운동을 하는가`)를 말한다 — 겹치면 카드 위쪽 두 줄이 같은 말이 된다.
 *
 * 문장이 아니라 **질문 조각**이므로 마침표를 붙이지 않는다.
 * `schema.test.ts` 가 길이·금지 어휘·숫자를 훑는다.
 */
export const READING_TYPE_QUESTION: Record<ReadingType, string> = {
  general: "타고난 기질은 어떤 쪽인가",
  diet: "몸이 어느 쪽으로 기울었나",
  "gain-cause": "살은 왜 붙는가",
  "diet-method": "무엇을 어떻게 하는가",
  "diet-food": "무엇을 먹는가",
  exercise: "어떤 운동을 하는가",
  decade: "십 년 단위로 어디에 기울었나",
};

/**
 * 노출 구분. **유형을 지우는 게 아니라 "보이는 곳" 만 나눈다** — `READING_TYPES` 에서 빼면
 * `Record` 가 그 몫을 전부 지우라고 하고 되살릴 때 프롬프트·섹션 계약을 다시 써야 한다.
 *
 * **`Record` 로 둔다** (배열이면 새 유형이 조용히 빠진 채 나간다).
 *
 * `internal` 은 **숨김이지 보호가 아니다** — `/admin` 에 인증이 없다.
 */
export const READING_TYPE_VISIBILITY: Record<ReadingType, "public" | "internal"> = {
  general: "internal",
  diet: "public",
  "gain-cause": "public",
  "diet-method": "public",
  "diet-food": "public",
  exercise: "public",
  /**
   * **`decade` 는 내렸다** — 공개 유형이 다이어트 축으로 몸을 묻는데 이것만 시간축을 묻는다.
   * 지우지 않는 이유는 위와 같다. 판정(`lib/saju/decade.ts`)은 계속 계산된다.
   */
  decade: "internal",
};

/**
 * 사용자에게 목록으로 보여줄 유형. **`READING_TYPE_VISIBILITY` 에서 파생시킨다** —
 * 손으로 유지하는 두 번째 목록을 만들지 않기 위해서다.
 */
export const PUBLIC_READING_TYPES = READING_TYPES.filter(
  (type) => READING_TYPE_VISIBILITY[type] === "public",
);

export const INTERNAL_READING_TYPES = READING_TYPES.filter(
  (type) => READING_TYPE_VISIBILITY[type] === "internal",
);

/**
 * 유형 선택 카드의 한 줄 설명. **`Record` 를 유지한다.**
 *
 * 문구는 각 유형의 표현 규칙을 그대로 따른다 — 처방·수치를 쓰지 않는다.
 * `schema.test.ts` 가 금지 어휘로 훑는다.
 */
export const READING_TYPE_DESCRIPTION: Record<ReadingType, string> = {
  general: "타고난 기질과 사람을 대하는 방식, 지금 지나는 흐름까지 한 번에 봅니다.",
  diet: "오행 균형과 한열에서 몸이 어느 쪽으로 기울었는지 읽고, 올해의 몸 흐름까지 함께 봅니다.",
  "gain-cause": "살이 붙을 때 어디서부터, 어떤 상황에서 붙는지 그 뿌리를 찾습니다.",
  "diet-method":
    "무엇을 먼저 고정할지, 어떤 종류로 움직이고 어떤 순서로 먹을지를 짚습니다.",
  /**
   * **숫자를 쓸 수 없다** — `schema.test.ts` 가 모든 유형의 문구를 `/\d/` 로 막는다.
   * 그래서 "90%" 가 아니라 "열에 아홉" 이다. 이 문장은 다이어트 일반에 대한 주장이지
   * 이 사람 몸에 대한 인과가 아니므로 표현 규칙의 (ii) 경계에 걸리지 않는다.
   */
  "diet-food":
    "다이어트의 열에 아홉은 식단입니다. 어떤 재료를 곁들이고 어떻게 차려 먹을지를 짚습니다.",
  exercise:
    "이 사주에 맞는 운동 한 가지를 골라 드리고, 어떤 강도로 얼마나 힘을 들여 움직일지를 짚습니다.",
  decade:
    "지금 흐르는 대운이 몸을 어느 쪽으로 받치는지, 직전 구간과 무엇이 달라졌는지 봅니다. 성별이 필요합니다.",
};

/**
 * `/reading/[type]` 의 검색·공유용 문구. 카드 설명과 **따로 둔다** — 카드는 제목 바로 밑이라
 * 짧아야 하고, 여기는 링크만 보고 판단하는 사람이 읽으므로 무엇을 넣어야 하는지
 * (생년월일시)까지 말해야 한다.
 *
 * **og:image 는 유형별로 만들지 않는다** (고정 카드 하나 · `app/opengraph-image.png`).
 */
export const READING_TYPE_META: Record<ReadingType, { title: string; description: string }> = {
  general: {
    title: "종합 사주 풀이 | 다이어트 사주",
    description:
      "생년월일시로 사주 원국을 계산하고, 일간·십신·오행 균형에서 타고난 기질과 사람을 대하는 방식, 지금 지나는 대운의 흐름을 풀어드립니다.",
  },
  diet: {
    title: "종합 체질 풀이 | 다이어트 사주",
    description:
      "생년월일시로 사주 원국을 계산하고, 오행 균형과 한열(조후)에서 몸의 결과 살이 붙는 패턴을 읽어 올해의 몸 흐름까지 풀어드립니다.",
  },
  "gain-cause": {
    title: "내가 살이 찌는 이유 | 다이어트 사주",
    description:
      "생년월일시로 사주 원국을 계산하고, 대사 기조와 십신 우세에서 살이 붙을 때 어디서부터 붙는지·어떤 상황에서 붙기 쉬운지를 짚어드립니다.",
  },
  "diet-method": {
    title: "나에게 맞는 다이어트 방법 | 다이어트 사주",
    description:
      "생년월일시로 사주 원국을 계산하고, 대사 기조와 살이 붙는 패턴에서 무엇을 먼저 고정할지·어떤 종류로 움직이고 어떤 순서로 먹을지를 짚어드립니다.",
  },
  "diet-food": {
    title: "나에게 맞는 다이어트 식단 | 다이어트 사주",
    description:
      "생년월일시로 사주 원국을 계산하고, 오행 과부족과 한열에서 어떤 재료를 곁들이면 좋은지·무엇이 이미 충분한지·어떻게 차려 먹을지를 짚어드립니다.",
  },
  exercise: {
    title: "나에게 맞는 운동 | 다이어트 사주",
    description:
      "생년월일시로 사주 원국을 계산하고, 대사 기조와 걸리는 지점에서 이 사주에 맞는 운동 한 가지를 골라 어떤 강도로 움직이고 언제 하면 좋을지·무엇이 무리가 되는지를 짚어드립니다.",
  },
  decade: {
    title: "몸이 바뀌는 10년 | 다이어트 사주",
    description:
      "생년월일시와 성별로 대운을 계산하고, 지금 흐르는 대운이 원국의 오행 과부족을 받치는지 얹히는지, 직전 대운과 견주어 무엇이 달라졌는지를 몸 쪽에서 읽어드립니다.",
  },
};

/**
 * 대운을 근거로 쓰는 유형은 **성별이 있어야 한다.** 순행/역행이 성별로 정해지므로 미지정이면
 * `chart.daeun` 이 null 이다. **임의로 순행을 정하지 않는다** — 같은 사주에 다른 판정이 나간다.
 *
 * **홈에서 카드를 막지 않는다.** 성별은 프로바이더의 메모리에 있어 클라이언트만 아는 값이고,
 * 카드를 흐리게 하려면 `/` 에 클라이언트 컴포넌트가 들어가 정적 성질이 깨진다.
 * 그래서 카드는 누구에게나 보이고 **폼이 이유를 말한다.**
 *
 * `Record` 로 두어 유형을 늘릴 때 컴파일 오류로 잡히게 한다.
 */
export const READING_TYPE_NEEDS_GENDER: Record<ReadingType, boolean> = {
  general: false,
  diet: false,
  "gain-cause": false,
  "diet-method": false,
  "diet-food": false,
  exercise: false,
  decade: true,
};

export const sajuInputSchema = z.object({
  /** 표시용 이름. 없으면 익명으로 처리한다. */
  name: z.string().trim().max(20, "이름은 20자 이내로 입력해 주세요").optional(),
  /** 생년월일 (YYYY-MM-DD) */
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일 형식은 YYYY-MM-DD 입니다")
    .refine((value) => {
      const [y, m, d] = value.split("-").map(Number) as [number, number, number];
      if (y < 1900 || y > 2100) return false;
      const date = new Date(Date.UTC(y, m - 1, d));
      return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
      );
    }, "존재하지 않는 날짜이거나 지원 범위(1900~2100)를 벗어났습니다"),
  /** 출생시각 (HH:mm). 모르면 생략 → 시주(時柱)를 제외하고 해석한다. */
  birthTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식은 HH:mm 입니다")
    .optional(),
  /** 양력/음력 */
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  /** 음력 입력일 때 윤달 여부. 양력이면 무시된다. */
  isLeapMonth: z.boolean().default(false),
  gender: z.enum(["male", "female", "unspecified"]).default("unspecified"),
  /**
   * 유형 없이 온 요청의 기본값. **공개 유형이고 성별을 요구하지 않는 것이어야 한다** —
   * 기본값은 사용자가 실제로 요청할 수 있는 것이어야 한다 (`schema.test.ts` 가 막는다).
   */
  readingType: z.enum(READING_TYPES).default("diet"),

  /**
   * 시각 보정 방식.
   * - `longitude`(기본): 경도 보정만. 한국 만세력 다수 관행
   * - `true`: 경도 + 균시차 (엄밀한 진태양시)
   * - `standard`: 보정 없음 (시계시 그대로)
   */
  solarTimeMode: z.enum(["standard", "longitude", "true"]).default("longitude"),
  /**
   * 자시 학파 — 23:00~23:59 의 일주를 어느 날로 볼지.
   * - `yajasi`(기본): 일주는 자정에 바뀐다 (야자시·조자시 구분). 한국 다수 관행
   * - `jasi`: 23:00 부터 다음날 일주 (중국식)
   */
  dayBoundary: z.enum(["yajasi", "jasi"]).default("yajasi"),
  /** 출생지 경도(도). 기본값은 서울(126.9784). 부산은 129.08 처럼 지정 가능. */
  longitude: z.number().min(124).max(132).optional(),
})
  /**
   * 폼도 막지만 **서버가 다시 막는다.** 여기서 통과시키면 `chart.decade` 가 null 인 채로
   * 프롬프트가 나가 LLM 이 스스로 10년을 지어낸다. 스트림 전이라 400 으로 돌려줄 수 있다.
   */
  .refine(
    (value) => !READING_TYPE_NEEDS_GENDER[value.readingType] || value.gender !== "unspecified",
    {
      path: ["gender"],
      message: "이 풀이는 대운(10년 흐름)을 쓰므로 성별을 함께 알려 주세요",
    },
  );

export type SajuInput = z.infer<typeof sajuInputSchema>;

/** 한 기둥(柱) */
export interface Pillar {
  /** 예: "경오" */
  ganji: string;
  /** 천간 예: "경" */
  gan: string;
  /** 지지 예: "오" */
  ji: string;
  /** 예: "금화" */
  ohaeng: string;
  /** 천간 십신 예: "편인" (일주는 본인이므로 "일간") */
  sipsin: string;
  /** 지지 십신 — 지장간 본기(정기)를 일간과 비교한 것 */
  jiSipsin: string;
}

/** 어떤 보정이 적용됐는지 — 결과의 근거를 사용자에게 보여주기 위한 정보 */
export interface TimeCorrectionInfo {
  mode: "standard" | "longitude" | "true";
  dayBoundary: "yajasi" | "jasi";
  /** 시계시 대비 총 보정량(분). 음수면 앞당긴 것 */
  correctionMinutes: number;
  /** 서머타임으로 앞당겨져 있던 분 (0 또는 60) */
  dstMinutes: number;
  /** 출생 당시 표준자오선 오프셋(분): 540=동경135°, 510=동경127.5° */
  standardOffsetMinutes: number;
  /** 보정 후 실제로 시주 판정에 쓴 시각. 시각 미상이면 null */
  appliedTime: string | null;
  /** 보정으로 날짜가 넘어가 일주 판정 기준일이 바뀌었는지 */
  appliedDateShifted: boolean;
}

/** 계산된 사주 원국 */
export interface SajuChart {
  /** 실제 계산에 쓰인 양력 날짜 (음력 입력 시 변환 결과) */
  solarDate: string;
  lunarDate: string;
  /** 출생시각을 몰라 시주를 제외했는지 */
  timeUnknown: boolean;
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** 출생시각 미입력이면 null */
  hour: Pillar | null;
  /** 띠 */
  saencho: string;
  /** 일간 (사주의 주체) */
  ilgan: string;
  /** 오행 분포 — 개수(사실) + 계절 기세(고전) + 점수(우리 관례) */
  ohaeng: OhaengAnalysis;
  /** 신강/신약 — 득령·득지·득세 3기준 */
  strength: StrengthAnalysis;
  /** 체질 경향 — **코드가** 정한다. 리딩 유형과 무관하게 항상 계산한다. */
  constitution: ConstitutionAnalysis;
  /**
   * 올해 세운 판정 — 세운 오행이 원국의 과부족에 어떻게 작용하는지.
   * **작용(보완·가중·중립)은 원래 몸 쪽 값이다**(`constitution` 에서 계산된다). 그래서
   * `yearly` 유형이 없어진 뒤에도 남아 `diet` 의 "올해의 몸 흐름" 이 근거로 쓴다.
   */
  yearly: YearlyAnalysis;
  /**
   * 지금 흐르는 10년 판정. **성별 미지정이면 null 이다** — 순행/역행을 임의로 고르면
   * 같은 사주에 다른 판정이 나간다 (`READING_TYPE_NEEDS_GENDER` 가 그래서 있다).
   */
  decade: DecadeAnalysis | null;
  /** 대운. 성별 미지정이면 순행/역행을 정할 수 없어 null */
  daeun: DaeunAnalysis | null;
  /** 세운 (기준 연도부터 3년) */
  seun: SeunYear[];
  timeCorrection: TimeCorrectionInfo;
}

export interface SajuReadingResponse {
  chart: SajuChart;
  /** LLM 이 생성한 마크다운 풀이 */
  reading: string;
  model: string;
}

/**
 * 스트리밍 응답의 이벤트. 한 줄에 하나씩 JSON 으로 보낸다 (NDJSON).
 * 원국은 코드가 즉시 계산하므로 첫 이벤트로 내보낸다.
 *
 * `error` 는 **스트림이 시작된 뒤** 발생한 실패에만 쓴다. 시작 전 실패는 일반 JSON +
 * 상태 코드다 — 200 본문을 쓰기 시작하면 상태 코드를 되돌릴 수 없다.
 */
export type SajuStreamEvent =
  | { type: "chart"; chart: SajuChart; model: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };
