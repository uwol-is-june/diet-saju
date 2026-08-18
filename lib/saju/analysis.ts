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
  JI_KO,
  fromSexagenary,
  ganOhaeng,
  ganjiToKorean,
  isRootedIn,
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
 * ## 득지·득세만 통근(通根)으로 본다 (TASK-32)
 *
 * 일지·년지·시지는 **본기가 아니라 지장간 전체**로 판단한다 (`isRootedIn`).
 * 본기만 보면 일간이 지지 속에 숨겨 둔 뿌리를 놓쳐 신약 쪽으로 치우친다 —
 * 실측 사례 `1999-12-09 22:12`(기묘·병자·**을미**·정해)에서 일지 미(未)의 중기가
 * 을목인데 본기 기토만 보면 편재가 되어 득지가 떨어졌다.
 *
 * **득령은 본기 기준을 그대로 둔다.** 월령(月令)은 "그 달을 지배하는 기운" 이라
 * 숨어 있는 글자가 아니다 — 여기까지 지장간으로 열면 세 기준이 전부 통근 검사가 되어
 * 판정이 신강 쪽으로 쏠린다 (격자 표본 194,400건: 세 기준 모두 통근으로 하면 신강 계열이
 * 32%→73%, 득지·득세만 열면 32%→59% 다. 근거는 `docs/saju-validation.md` 3-2).
 *
 * 기준은 `isSupportingSipsin` 그대로(비겁·인성)이므로 **판정이 약해지는 방향으로는
 * 움직이지 않는다.** 천간은 원래 숨은 글자가 없으므로 그대로 십신으로 본다.
 *
 * **표시용 지지 십신(`jiSipsin`)은 본기 기준을 유지한다.** 통근은 여기 판정에만 쓴다.
 * 그래서 "일지 편재인데 득지 ○" 처럼 보일 수 있어 `rooted` 로 근거를 함께 낸다.
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
  /**
   * 원국에서 일간을 돕는 글자 수 / 전체 글자 수.
   *
   * **지지는 전부 통근 기준이다** — 이건 3기준이 아니라 세력을 세는 값이라
   * "뿌리가 있는가" 로 보는 것이 맞다. 그래서 득령이 아니오인 월지가 여기서는
   * 돕는 글자로 잡힐 수 있다 (당령과 통근은 다른 층이다).
   */
  supportingChars: number;
  totalChars: number;
  /**
   * 일간이 통근한 자리 — 예: `["월지 자", "일지 미"]`. 자리 순서(년→월→일→시)를 지킨다.
   *
   * 지지 십신 표시는 본기 기준이라 통근한 자리가 재성·관성으로 보일 수 있다.
   * 판정 근거가 어긋나 보이지 않도록 어느 자리에 뿌리가 섰는지 함께 낸다.
   */
  rooted: string[];
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
  // 통근 — 지장간 전체로 본다. 본기만 보면 숨은 뿌리를 놓친다.
  const rootedIn = (ji: number) => isRootedIn(ilgan, ji);

  // 득령만 본기(당령) 기준이다 — 월령은 "그 달을 지배하는 기운" 이라 숨은 글자가 아니다.
  const deukryeong = isSupportingSipsin(jiSipsin(ilgan, input.month.ji));
  const deukji = rootedIn(input.day.ji);

  // 득세: 월지·일지를 뺀 나머지 자리. 지지는 통근으로 센다.
  const otherChars: boolean[] = [
    supportsGan(input.year.gan),
    rootedIn(input.year.ji),
    supportsGan(input.month.gan),
    ...(input.hour ? [supportsGan(input.hour.gan), rootedIn(input.hour.ji)] : []),
  ];
  const supportingOthers = otherChars.filter(Boolean).length;
  const deukse = supportingOthers * 2 >= otherChars.length;

  const met = [deukryeong, deukji, deukse].filter(Boolean).length;
  const verdict: StrengthVerdict =
    met === 3 ? "신강" : met === 2 ? "약간 신강" : met === 1 ? "약간 신약" : "신약";

  // 일간 자신은 세지 않는다 (비교 기준이므로). 지지는 위 판정과 같은 통근 기준으로 센다.
  const allChars: boolean[] = [
    supportsGan(input.year.gan),
    rootedIn(input.year.ji),
    supportsGan(input.month.gan),
    rootedIn(input.month.ji),
    rootedIn(input.day.ji),
    ...(input.hour ? [supportsGan(input.hour.gan), rootedIn(input.hour.ji)] : []),
  ];

  // 통근한 자리 — 자리 순서(년→월→일→시)를 유지한다.
  const rooted = (
    [
      ["년지", input.year.ji],
      ["월지", input.month.ji],
      ["일지", input.day.ji],
      ...(input.hour ? ([["시지", input.hour.ji]] as const) : []),
    ] as const
  )
    .filter(([, ji]) => isRootedIn(ilgan, ji))
    .map(([position, ji]) => `${position} ${JI_KO[ji]}`);

  return {
    deukryeong,
    deukji,
    deukse,
    verdict,
    supportingChars: allChars.filter(Boolean).length,
    totalChars: allChars.length,
    rooted,
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
  /**
   * 천간·지지의 60갑자 인덱스 (TASK-45).
   *
   * `ohaeng` 은 표시용 두 글자 문자열이라 판정에 쓸 수 없다. **문자열을 쪼개 쓰지 말고**
   * 이 인덱스로 `ganOhaeng`/`jiOhaeng` 을 부른다 — 경계에서 인덱스로 바꾸고 노출 직전에만
   * 한글로 바꾸는 원칙이 여기도 적용된다. `analyzeYearly` 가 `gan`/`ji` 를 따로 받는 것과 같다.
   */
  gan: number;
  ji: number;
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
      gan: ganji.gan,
      ji: ganji.ji,
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
