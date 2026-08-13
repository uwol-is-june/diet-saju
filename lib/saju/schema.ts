import { z } from "zod";
import type {
  DaeunAnalysis,
  OhaengAnalysis,
  SeunYear,
  StrengthAnalysis,
} from "./analysis";

/**
 * 사주 입력 스키마 — 클라이언트/서버 공용.
 * 서버는 이 스키마를 반드시 다시 통과시킨다 (클라이언트 검증은 UX용, 신뢰 대상 아님).
 */

export const READING_TYPES = ["general", "diet"] as const;
export type ReadingType = (typeof READING_TYPES)[number];

export const READING_TYPE_LABEL: Record<ReadingType, string> = {
  general: "종합 사주 풀이",
  diet: "체질·다이어트 풀이",
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
  readingType: z.enum(READING_TYPES).default("general"),

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
