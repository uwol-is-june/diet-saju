import { z } from "zod";

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
  gender: z.enum(["male", "female", "unspecified"]).default("unspecified"),
  readingType: z.enum(READING_TYPES).default("general"),
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
  /** 오행 분포 (목/화/토/금/수 개수) */
  ohaengCount: Record<string, number>;
}

export interface SajuReadingResponse {
  chart: SajuChart;
  /** LLM 이 생성한 마크다운 풀이 */
  reading: string;
  model: string;
}
