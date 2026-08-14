import { z } from "zod";
import type {
  DaeunAnalysis,
  OhaengAnalysis,
  SeunYear,
  StrengthAnalysis,
} from "./analysis";
import type { ConstitutionAnalysis } from "./constitution";
import type { YearlyAnalysis } from "./yearly";

/**
 * 사주 입력 스키마 — 클라이언트/서버 공용.
 * 서버는 이 스키마를 반드시 다시 통과시킨다 (클라이언트 검증은 UX용, 신뢰 대상 아님).
 */

/**
 * 풀이 유형. **순서가 UI 버튼 순서다.**
 *
 * 유형을 추가하면 타입이 강제하는 곳(섹션 계약·프롬프트 지침·공유 카드 칩)이 전부
 * 컴파일 오류로 잡힌다. `Record<ReadingType, …>` 를 유지하는 이유다 — 인덱스 시그니처로
 * 바꾸면 새 유형이 조용히 빈 값으로 나간다.
 */
export const READING_TYPES = ["general", "diet"] as const;
export type ReadingType = (typeof READING_TYPES)[number];

/**
 * **`diet` 의 id 는 바꾸지 않는다** (TASK-39). 라벨만 `종합 체질 풀이` 로 바뀌었다.
 * 세그먼트가 곧 URL 이라 id 를 바꾸면 이미 공유된 `/reading/diet` 링크와 공유 카드가 죽는다.
 */
export const READING_TYPE_LABEL: Record<ReadingType, string> = {
  general: "종합 사주 풀이",
  diet: "종합 체질 풀이",
};

/**
 * 노출 구분 (TASK-41). **유형을 지우는 게 아니라 "보이는 곳" 만 나눈다.**
 *
 * `general` 은 나중에 없앨 유형이지만 그때까지 다른 사주 서비스와 대조해 문제를 잡는 데
 * 쓴다. `READING_TYPES` 에서 빼면 `Record<ReadingType, …>` 가 general 몫을 전부 지우라고
 * 하고, 그러면 되살릴 때 프롬프트·섹션 계약을 다시 써야 한다. 지금 필요한 건 노출 제어뿐이다.
 *
 * **`Record` 로 둔다.** 배열로 두면 새 유형이 조용히 빠진 채 나가지만, `Record` 면
 * 유형을 늘릴 때 여기가 컴파일 오류로 잡힌다.
 *
 * `internal` 은 **숨김이지 보호가 아니다** — `/admin` 에 인증이 없으므로 URL 을 아는
 * 사람은 누구나 들어온다. 지금 목적(본인 비교용)에는 충분하고 비밀도 아니다.
 */
export const READING_TYPE_VISIBILITY: Record<ReadingType, "public" | "internal"> = {
  general: "internal",
  diet: "public",
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
 * 유형 선택 카드의 한 줄 설명 (TASK-30).
 *
 * **`Record<ReadingType, string>` 를 유지한다.** 삼항이나 인덱스 시그니처로 두면
 * 새 유형이 조용히 빈 설명을 달고 나간다.
 *
 * 문구는 각 유형의 표현 규칙을 그대로 따른다 — `diet` 는 처방·수치를 쓰지 않는다.
 * `schema.test.ts` 가 금지 어휘로 훑는다.
 */
export const READING_TYPE_DESCRIPTION: Record<ReadingType, string> = {
  general: "타고난 기질과 사람을 대하는 방식, 지금 지나는 흐름까지 한 번에 봅니다.",
  diet: "오행 균형과 한열에서 몸의 결을 읽고, 올해의 몸 흐름까지 함께 봅니다.",
};

/**
 * `/reading/[type]` 의 검색·공유용 문구 (TASK-31).
 *
 * 카드 설명(`READING_TYPE_DESCRIPTION`)과 **따로 둔다.** 카드는 화면에서 제목 바로 밑에
 * 붙으므로 짧아야 하고, 여기는 링크만 보고 판단하는 사람이 읽으므로 무엇을 넣어야 하는지
 * (생년월일시)와 무엇이 나오는지를 같이 말해야 한다.
 *
 * **og:image 는 유형별로 만들지 않는다.** 고정 카드(`app/opengraph-image.png`) 하나를
 * 유지한다 — 세 벌이 되면 `docs/og-card.html` 원본도 세 벌이고 팔레트 검사도 그만큼 는다.
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
   * 유형 없이 온 요청의 기본값. **공개 유형이어야 한다** (TASK-41).
   *
   * 예전 기본값은 `general` 이었는데 그 유형이 `internal` 이 되면서, 유형을 생략한 요청이
   * 화면에서는 고를 수 없는 유형으로 가게 됐다. 폼은 항상 세그먼트에서 유형을 주므로
   * 실동작 문제는 없었지만, **기본값은 사용자가 실제로 요청할 수 있는 것**이어야 한다.
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
});

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
  /**
   * 체질 경향 — 오행 균형·조후·신강신약·십신 분포에서 **코드가** 정한다 (TASK-14).
   * 리딩 유형과 무관하게 항상 계산한다. 지금은 `diet` 프롬프트만 근거로 쓴다.
   */
  constitution: ConstitutionAnalysis;
  /**
   * 올해 세운 판정 — 세운 오행이 원국의 과부족에 어떻게 작용하는지 (TASK-15).
   *
   * **작용(보완·가중·중립)은 원래 몸 쪽 값이다** — `constitution.deficient`/`excess` 에서
   * 계산되기 때문이다. 그래서 `yearly` 유형이 사라진 뒤에도 남아 `diet` 의
   * "올해의 몸 흐름" 이 근거로 쓴다 (TASK-39). 리딩 유형과 무관하게 항상 계산한다.
   */
  yearly: YearlyAnalysis;
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
 *
 * 원국은 코드가 즉시 계산하므로 첫 이벤트로 바로 내보낼 수 있다. 사용자는 LLM 을
 * 기다리는 동안 자기 사주팔자를 먼저 본다.
 *
 * `error` 는 **스트림이 시작된 뒤** 발생한 실패에만 쓴다. 시작 전 실패(입력 오류·쿼터
 * 소진 등)는 일반 JSON 응답 + 상태 코드로 처리한다 — 200 본문을 쓰기 시작하면
 * 상태 코드를 되돌릴 수 없기 때문이다.
 */
export type SajuStreamEvent =
  | { type: "chart"; chart: SajuChart; model: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };
