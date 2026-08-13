/**
 * 원국에서 파생되는 해석 근거 계산.
 *
 * 순수 함수 모듈 — 라이브러리도 I/O 도 없다. `pillars.ts` 가 절기 조회 같은
 * 외부 의존을 해결해 인자로 넘겨준다.
 *
 * ## 고전 규칙과 우리 관례를 구분한다
 *
 * 명리학은 학파마다 기준이 다르다. 코드가 만드는 "사실"이 실제로는 임의의 선택인 경우
 * 그것을 사실처럼 내보내면 안 된다. 그래서 이 모듈은 두 종류를 나눠 담는다.
 *
 * - **고전 규칙에서 확정되는 것**: 왕상휴수사, 지지 본기, 대운 순행/역행, 대운 간지,
 *   세운 간지. 이견이 없다.
 * - **우리가 정한 관례**: 오행 점수의 배수, 신강/신약 4단계 표현. 아래에 명시하고
 *   `docs/saju-validation.md` 에도 남겼다. 바꾸려면 여기 상수만 고치면 된다.
 */
import {
  fromSexagenary,
  ganOhaeng,
  ganjiToKorean,
  isSupportingSipsin,
  jiOhaeng,
  jiSipsin,
  pillarOhaeng,
  seasonOf,
  seasonalStates,
  shiftSexagenary,
  sipsinOf,
  type GanjiIndex,
  type Ohaeng,
  type Season,
  type SeasonalState,
  type Sipsin,
} from "./ganji";

const OHAENG_LIST: readonly Ohaeng[] = ["목", "화", "토", "금", "수"];

/**
 * **우리 관례**: 왕상휴수사 상태를 오행 점수의 배수로 쓴다.
 *
 * 단순 개수는 계절을 무시한다 — 겨울에 태어난 화(火) 하나와 여름의 화 하나가 같을 수 없다.
 * 위치별 가중치(월지 ×2 같은 것)를 임의로 만드는 대신, 고전 왕상휴수사 등급을 배수로
 * 삼아 근거를 한 곳에 모았다. 배수 값 자체는 우리가 정한 것이다.
 */
export const SEASONAL_MULTIPLIER: Record<SeasonalState, number> = {
  왕: 1.5,
  상: 1.2,
  휴: 1.0,
  수: 0.8,
  사: 0.6,
};

export interface OhaengAnalysis {
  /** 간지 8자(또는 6자)에서 센 단순 개수 — 이견 없는 사실 */
  count: Record<Ohaeng, number>;
  /** 계절이 각 오행에 주는 기세 (왕상휴수사) — 고전 규칙 */
  seasonalState: Record<Ohaeng, SeasonalState>;
  /** 개수 × 계절 배수 — 우리 관례 */
  score: Record<Ohaeng, number>;
  season: Season;
  /** 개수가 0인 오행 */
  missing: Ohaeng[];
  /** 점수가 가장 높은 오행 */
  strongest: Ohaeng;
}

export function analyzeOhaeng(
  pillars: readonly GanjiIndex[],
  monthJi: number,
): OhaengAnalysis {
  const count = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } as Record<Ohaeng, number>;
  for (const { gan, ji } of pillars) {
    count[ganOhaeng(gan)] += 1;
    count[jiOhaeng(ji)] += 1;
  }

  const seasonalState = seasonalStates(monthJi);
  const score = {} as Record<Ohaeng, number>;
  for (const element of OHAENG_LIST) {
    // 소수 둘째 자리에서 끊는다. 표시용이지 정밀 수치가 아니다.
    score[element] =
      Math.round(count[element] * SEASONAL_MULTIPLIER[seasonalState[element]] * 100) / 100;
  }

  const strongest = OHAENG_LIST.reduce((best, element) =>
    score[element] > score[best] ? element : best,
  );

  return {
    count,
    seasonalState,
    score,
    season: seasonOf(monthJi),
    missing: OHAENG_LIST.filter((element) => count[element] === 0),
    strongest,
  };
}

// ── 신강 / 신약 ────────────────────────────────────────────────────────────
/**
 * 고전 3기준으로 판정한다. 임의 가중치를 만들지 않는다.
 *
 * - 득령(得令): 월지가 일간을 돕는가 (비겁·인성) — 계절의 지원
 * - 득지(得地): 일지가 일간을 돕는가 — 발 딛은 자리
 * - 득세(得勢): 나머지 자리(년주·시주)에서 돕는 세력이 절반 이상인가
 *
 * **우리 관례**: 셋 중 몇 개를 충족하는지로 4단계로 표현한다.
 * (3=신강, 2=약간 신강, 1=약간 신약, 0=신약)
 */
export type StrengthVerdict = "신강" | "약간 신강" | "약간 신약" | "신약";

export interface StrengthAnalysis {
  /** 월지가 일간을 돕는가 */
  deukryeong: boolean;
  /** 일지가 일간을 돕는가 */
  deukji: boolean;
  /** 년주·시주에서 돕는 세력이 우세한가 */
  deukse: boolean;
  verdict: StrengthVerdict;
  /** 원국에서 일간을 돕는 글자 수 / 전체 글자 수 */
  supportingChars: number;
  totalChars: number;
}

export interface StrengthInput {
  ilgan: number;
  year: GanjiIndex;
  month: GanjiIndex;
  day: GanjiIndex;
  hour: GanjiIndex | null;
}

export function analyzeStrength(input: StrengthInput): StrengthAnalysis {
  const { ilgan } = input;

  const supportsGan = (gan: number) => isSupportingSipsin(sipsinOf(ilgan, gan));
  const supportsJi = (ji: number) => isSupportingSipsin(jiSipsin(ilgan, ji));

  const deukryeong = supportsJi(input.month.ji);
  const deukji = supportsJi(input.day.ji);

  // 득세: 월지·일지를 뺀 나머지 자리
  const otherChars: boolean[] = [
    supportsGan(input.year.gan),
    supportsJi(input.year.ji),
    supportsGan(input.month.gan),
    ...(input.hour ? [supportsGan(input.hour.gan), supportsJi(input.hour.ji)] : []),
  ];
  const supportingOthers = otherChars.filter(Boolean).length;
  const deukse = supportingOthers * 2 >= otherChars.length;

  const met = [deukryeong, deukji, deukse].filter(Boolean).length;
  const verdict: StrengthVerdict =
    met === 3 ? "신강" : met === 2 ? "약간 신강" : met === 1 ? "약간 신약" : "신약";

  // 일간 자신은 세지 않는다 (비교 기준이므로)
  const allChars: boolean[] = [
    supportsGan(input.year.gan),
    supportsJi(input.year.ji),
    supportsGan(input.month.gan),
    supportsJi(input.month.ji),
    supportsJi(input.day.ji),
    ...(input.hour ? [supportsGan(input.hour.gan), supportsJi(input.hour.ji)] : []),
  ];

  return {
    deukryeong,
    deukji,
    deukse,
    verdict,
    supportingChars: allChars.filter(Boolean).length,
    totalChars: allChars.length,
  };
}

// ── 대운(大運) ─────────────────────────────────────────────────────────────
/**
 * 순행/역행 결정 — 고전 규칙.
 *   양남·음녀 → 순행 / 음남·양녀 → 역행
 * (년간의 음양과 성별의 조합)
 */
export function daeunDirection(
  yearGanIsYang: boolean,
  gender: "male" | "female",
): "forward" | "backward" {
  const isMale = gender === "male";
  return yearGanIsYang === isMale ? "forward" : "backward";
}

export interface DaeunPeriod {
  /** 이 대운이 시작되는 나이 (세는나이 기준 관례) */
  startAge: number;
  endAge: number;
  ganji: string;
  ohaeng: string;
  /** 대운 천간의 십신 */
  sipsin: Sipsin;
  /** 대운 지지의 십신 */
  jiSipsin: Sipsin;
}

export interface DaeunAnalysis {
  direction: "forward" | "backward";
  /** 첫 대운이 시작되는 나이 */
  startAge: number;
  /** 대운수 산출 근거 — 절기까지의 일수 */
  daysToJeol: number;
  periods: DaeunPeriod[];
}

export interface DaeunInput {
  ilgan: number;
  /** 월주 60갑자 인덱스 — 대운은 여기서 순행/역행한다 */
  monthSexagenary: number;
  direction: "forward" | "backward";
  /** 순행이면 다음 절기까지, 역행이면 이전 절기부터의 일수 */
  daysToJeol: number;
  /** 만들 대운 개수 */
  count?: number;
}

/**
 * 대운수 = 절기까지의 일수 ÷ 3 (3일 = 1년).
 *
 * **우리 관례**: 반올림하고 최소 1세로 둔다. 나머지를 개월로 환산하는 유파도 있으나
 * 표시를 단순하게 유지했다. 근거가 되는 `daysToJeol` 을 함께 내보내므로 검산할 수 있다.
 */
export function daeunStartAge(daysToJeol: number): number {
  return Math.max(1, Math.round(daysToJeol / 3));
}

export function analyzeDaeun(input: DaeunInput): DaeunAnalysis {
  const count = input.count ?? 8;
  const startAge = daeunStartAge(input.daysToJeol);
  const step = input.direction === "forward" ? 1 : -1;

  const periods: DaeunPeriod[] = [];
  for (let i = 0; i < count; i += 1) {
    const ganji = fromSexagenary(shiftSexagenary(input.monthSexagenary, step * (i + 1)));
    periods.push({
      startAge: startAge + i * 10,
      endAge: startAge + i * 10 + 9,
      ganji: ganjiToKorean(ganji),
      ohaeng: pillarOhaeng(ganji),
      sipsin: sipsinOf(input.ilgan, ganji.gan),
      jiSipsin: jiSipsin(input.ilgan, ganji.ji),
    });
  }

  return {
    direction: input.direction,
    startAge,
    daysToJeol: Math.round(input.daysToJeol * 100) / 100,
    periods,
  };
}

// ── 세운(歲運) ─────────────────────────────────────────────────────────────
export interface SeunYear {
  year: number;
  ganji: string;
  ohaeng: string;
  sipsin: Sipsin;
  jiSipsin: Sipsin;
  /** 이 해에 해당하는 대운 (없으면 null) */
  daeunGanji: string | null;
  /** 이 해의 나이 (세는나이) */
  age: number;
}

/**
 * 세운 간지 — 고전 규칙: (연도 − 4) mod 60.
 *
 * 주의: 입춘 이전은 전년도 간지다. 여기서는 **연 단위 표시**가 목적이라
 * 해당 연도의 간지를 그대로 쓴다. 절입 경계까지 따지는 것은 일별 운세용이며
 * 지금 범위가 아니다.
 */
export function sexagenaryOfYear(year: number): GanjiIndex {
  return fromSexagenary((((year - 4) % 60) + 60) % 60);
}

export interface SeunInput {
  ilgan: number;
  birthYear: number;
  /** 기준 연도 (보통 올해) */
  fromYear: number;
  count?: number;
  daeun?: DaeunAnalysis;
}

export function analyzeSeun(input: SeunInput): SeunYear[] {
  const count = input.count ?? 3;
  const result: SeunYear[] = [];

  for (let i = 0; i < count; i += 1) {
    const year = input.fromYear + i;
    const ganji = sexagenaryOfYear(year);
    // 세는나이 관례 (한국 만세력이 대개 이 기준을 쓴다)
    const age = year - input.birthYear + 1;
    const daeun =
      input.daeun?.periods.find((p) => age >= p.startAge && age <= p.endAge) ?? null;

    result.push({
      year,
      ganji: ganjiToKorean(ganji),
      ohaeng: pillarOhaeng(ganji),
      sipsin: sipsinOf(input.ilgan, ganji.gan),
      jiSipsin: jiSipsin(input.ilgan, ganji.ji),
      daeunGanji: daeun?.ganji ?? null,
      age,
    });
  }

  return result;
}
