/**
 * 체질 경향 판정 (TASK-14).
 *
 * 순수 함수 모듈 — 라이브러리도 I/O 도 없다. `analysis.ts` 가 만든 근거(오행 점수·왕상휴수사·
 * 신강신약)를 받아 **결정론적으로** 체질 축을 정한다.
 *
 * ## 왜 코드가 정하는가
 *
 * "이 사주는 어떤 체질인가"를 LLM 이 매번 즉흥으로 정하면 같은 사주에 다른 답이 나온다.
 * 원국을 코드가 계산하는 것과 같은 이유로, **판정은 여기서 하고 LLM 은 서술만 한다.**
 * 이 모듈의 출력이 프롬프트에 "계산 완료 · 수정 금지" 로 들어간다.
 *
 * ## 고전 규칙과 우리 관례를 구분한다
 *
 * - **고전에서 오는 것**: 오행-신체 배속(『황제내경』 계열의 오장 배속), 조후(調候)에서
 *   월령의 한난을 먼저 보고 원국의 화·수 세력으로 보정한다는 순서, 십신 5분류.
 * - **우리 관례**: 과다/부족을 가르는 임계값, 한열 5단계의 눈금, 십신 우세 그룹을
 *   "살이 붙는 패턴" 으로 옮긴 대응표, 동점 처리 순서.
 *   전부 아래 상수로 모아 뒀고 `docs/saju-validation.md` 에 어느 쪽인지 적었다.
 *
 * ## 의학적 주장을 하지 않는다
 *
 * 오행 배속은 명리학·한의학이 공유하는 상징 체계이지, 장기의 상태를 측정한 것이 아니다.
 * 그래서 사용자에게 나가는 문구는 전부 **생활 습관 언어**로만 쓴다. 장부 이름
 * (`classical` 필드)은 배속의 출처를 밝히는 용도이며 프롬프트로 내보내지 않는다.
 * 금지 어휘는 `constitution.test.ts` 가 이 파일의 모든 문구를 훑어 막는다.
 */
import {
  SIPSIN_GROUPS,
  jiSipsin,
  sipsinGroup,
  sipsinOf,
  type GanjiIndex,
  type Ohaeng,
  type Season,
  type SipsinGroup,
} from "./ganji";
import type { OhaengAnalysis, StrengthAnalysis } from "./analysis";

const OHAENG_LIST: readonly Ohaeng[] = ["목", "화", "토", "금", "수"];

// ── 1. 오행 과다 / 부족 ────────────────────────────────────────────────────
export type BalanceLevel = "과다" | "적정" | "부족";

/**
 * **우리 관례**: 오행 점수가 평균의 몇 배를 넘으면 과다, 몇 배 아래면 부족으로 본다.
 *
 * 절대 개수로 자르지 않는 이유: 시각 미상이면 글자가 6개뿐이라 같은 "2개" 의 무게가
 * 다르다. 평균 대비 비율로 두면 기둥 수와 무관하게 같은 뜻이 된다.
 */
export const EXCESS_RATIO = 1.5;
export const DEFICIENT_RATIO = 0.5;

// ── 2. 한열 (조후) ─────────────────────────────────────────────────────────
export type ThermalTendency = "한" | "서늘" | "중화" | "따뜻" | "열";

/**
 * **고전**: 조후는 월령(태어난 계절)의 한난을 먼저 보고, 원국의 화·수 세력으로 보정한다.
 * **우리 관례**: 그 둘을 각각 −1·0·+1 로 두고 더해 5단계로 표현한다.
 *   (봄·가을은 치우침 없음으로 0)
 */
const SEASON_TILT: Record<Season, number> = { 봄: 0, 여름: 1, 가을: 0, 겨울: -1 };

/** 두 기울기의 합(−2~+2)을 눈금 인덱스(0~4)로 옮긴다. */
const THERMAL_SCALE: readonly ThermalTendency[] = ["한", "서늘", "중화", "따뜻", "열"];

// ── 3. 대사 기조 ───────────────────────────────────────────────────────────
export type MetabolismTendency = "발산형" | "축적형";

// ── 4. 살이 붙는 패턴 ──────────────────────────────────────────────────────
export type GainPattern = "근육형" | "식욕형" | "불규칙형" | "스트레스형" | "정체형";

/**
 * **우리 관례**: 십신 우세 그룹 → 체중이 늘어나는 상황의 결.
 * 고전 상의(象意)에서 끌어왔지만(식상=먹고 내보냄, 관성=억제, 인성=받아들여 쌓음),
 * "살이 붙는 패턴" 이라는 축 자체는 이 서비스가 만든 것이다.
 */
const PATTERN_OF_GROUP: Record<SipsinGroup, GainPattern> = {
  비겁: "근육형",
  식상: "식욕형",
  재성: "불규칙형",
  관성: "스트레스형",
  인성: "정체형",
};

// ── 5. 다이어트 접근 순서 (TASK-24) ────────────────────────────────────────
export type DietApproach = "활동량 우선" | "리듬 고정 우선" | "식사량 조절 우선" | "회복 우선";

/** 살이 붙는 패턴이 어느 쪽에 걸리는지 — 접근 순서 판정의 두 번째 축 */
export type GainSite = "움직임" | "먹는 것";

/**
 * **우리 관례**: 살이 붙는 패턴 → 걸리는 지점.
 *
 * 근거는 `GAIN_PATTERN_NOTE` 의 각 문구다. 비겁·인성 쪽은 "활동량이 줄면 붙는" 결이고,
 * 식상·재성·관성 쪽은 먹는 양·시각·상황에서 붙는 결이다.
 */
const SITE_OF_PATTERN: Record<GainPattern, GainSite> = {
  근육형: "움직임",
  정체형: "움직임",
  식욕형: "먹는 것",
  불규칙형: "먹는 것",
  스트레스형: "먹는 것",
};

/**
 * **우리 관례**: 대사 기조 × 걸리는 지점 → 무엇을 먼저 고정하는가.
 *
 * `METABOLISM_NOTE` 가 이미 순서를 가리키고 있다 — 발산형은 "쓰는 양을 늘리는 순서",
 * 축적형은 "수면과 끼니를 먼저 고정하고 강도는 나중에". 그 순서를 독립된 축으로 올리고,
 * 걸리는 지점으로 어느 쪽을 먼저 만질지 갈랐다.
 *
 * **2×2 라서 동점이 생기지 않는다.** 두 입력이 각각 이미 결정론적이므로(대사 기조는
 * 신강신약에서, 패턴은 십신 우세 그룹에서 — 그쪽 동점은 고전 십신 순서로 이미 고정됨)
 * 같은 사주면 항상 같은 방식이 나온다. 축을 더 넣을 때는 동점 처리를 반드시 함께 고정할 것.
 *
 * **한열을 판정에 넣지 않았다.** 한열은 "무엇을 먼저 고정하는가" 와 다른 층이다 —
 * 같은 순서를 어느 온도·시간대에 실행하느냐를 정한다. 그래서 방식은 위 두 축으로 정하고,
 * 한열은 `THERMAL_GUIDE` 의 항목으로 실행 조건에 붙는다. 한열을 여기 섞으면 값이 20가지가
 * 되면서 각 칸의 근거를 설명할 수 없게 된다.
 */
const APPROACH_TABLE: Record<MetabolismTendency, Record<GainSite, DietApproach>> = {
  발산형: { 움직임: "활동량 우선", "먹는 것": "식사량 조절 우선" },
  축적형: { 움직임: "회복 우선", "먹는 것": "리듬 고정 우선" },
};

// ── 문구 테이블 ────────────────────────────────────────────────────────────
/**
 * 여기 문자열은 프롬프트가 아니라 **판정에 딸린 근거 데이터**다.
 * LLM 이 이 문장을 그대로 베끼는 것이 아니라, 이 근거를 풀어 쓰도록 프롬프트가 지시한다.
 * (프롬프트 문장 자체는 `lib/prompt.ts` 한 곳에 있다)
 */

/** 오행 → 몸의 결. `classical` 은 배속의 출처이며 사용자에게 내보내지 않는다. */
export const BODY_AXIS: Record<Ohaeng, { axis: string; classical: string }> = {
  목: { axis: "근육과 유연성, 뻗어 나가는 활동", classical: "간·담, 근(筋)" },
  화: { axis: "순환과 열기, 활력의 기복", classical: "심·소장, 혈맥" },
  토: { axis: "소화와 먹는 리듬", classical: "비·위, 기육(肌肉)" },
  금: { axis: "호흡과 피부, 생활 리듬의 규칙성", classical: "폐·대장, 피모(皮毛)" },
  수: { axis: "수분 대사와 회복, 휴식의 질", classical: "신·방광, 골(骨)" },
};

interface Guide {
  tendency: string;
  diet: string;
  exercise: string;
}

export const FOCUS_GUIDE: Record<Ohaeng, Record<"과다" | "부족", Guide>> = {
  목: {
    과다: {
      tendency: "움직이고 싶은 마음이 앞서 무리하기 쉽다",
      diet: "자극적인 맛보다 담백한 쪽으로, 끼니를 거르지 않기",
      exercise: "강도를 올리기보다 같은 강도를 오래, 스트레칭을 곁들이기",
    },
    부족: {
      tendency: "몸을 크게 펴는 움직임이 적어 뻣뻣해지기 쉽다",
      diet: "초록 잎채소와 제철 과일을 한 가지씩 곁들이기",
      exercise: "관절을 펴는 스트레칭이나 요가부터 시작하기",
    },
  },
  화: {
    과다: {
      tendency: "열기가 위로 몰려 밤에 식욕이 오르기 쉽다",
      diet: "늦은 시간의 맵고 뜨거운 음식과 술을 줄이고 물을 자주 마시기",
      exercise: "저녁 고강도보다 낮 시간대의 가벼운 유산소",
    },
    부족: {
      tendency: "몸이 쉽게 식고 활력이 늦게 오른다",
      diet: "익혀서 따뜻하게 먹고 아침을 거르지 않기",
      exercise: "준비운동을 길게 잡아 몸을 데운 뒤 시작하기",
    },
  },
  토: {
    과다: {
      tendency: "먹는 즐거움이 커서 한 번에 양이 늘기 쉽다",
      diet: "그릇을 작게 쓰고 천천히 씹기",
      exercise: "식사 뒤 20분 걷기처럼 소화를 돕는 움직임",
    },
    부족: {
      tendency: "식사 시간이 흐트러지고 속이 부담을 느끼기 쉽다",
      diet: "정해진 시간에 소량씩, 국이나 죽처럼 부담이 적은 것부터",
      exercise: "공복 고강도는 피하고 식사 한 시간 뒤에 가볍게",
    },
  },
  금: {
    과다: {
      tendency: "규칙을 세게 잡다가 긴장이 쌓이기 쉽다",
      diet: "여러 규칙 대신 지킬 수 있는 한 가지만 정하기",
      exercise: "걷기나 수영처럼 호흡 리듬이 일정한 운동",
    },
    부족: {
      tendency: "생활 리듬이 들쭉날쭉해지기 쉽다",
      diet: "메뉴보다 식사 시각을 먼저 고정하기",
      exercise: "짧아도 매일 같은 시간에 반복하기",
    },
  },
  수: {
    과다: {
      tendency: "몸이 무겁고 붓는 느낌이 오기 쉽다",
      diet: "짠 음식과 늦은 밤의 수분을 줄이기",
      exercise: "땀이 살짝 날 정도로 매일 조금씩",
    },
    부족: {
      tendency: "회복이 더디고 쉽게 건조해진다",
      diet: "물을 한 번에 몰아 마시지 말고 나눠서 자주 마시기",
      exercise: "강도를 낮추고 수면 시간을 먼저 확보하기",
    },
  },
};

export const THERMAL_GUIDE: Record<ThermalTendency, Guide> = {
  한: {
    tendency: "몸이 차가운 쪽으로 기운 편",
    diet: "익혀서 따뜻하게 먹고 찬 음료를 줄이기",
    exercise: "실내에서 몸을 데운 뒤 움직이고 새벽 야외 운동은 피하기",
  },
  서늘: {
    tendency: "약간 서늘한 쪽으로 기운 편",
    diet: "하루 첫 끼를 따뜻한 것으로 시작하기",
    exercise: "준비운동을 충분히 하고 들어가기",
  },
  중화: {
    tendency: "한열이 크게 치우치지 않은 편",
    diet: "음식 온도를 가리기보다 양과 시간에 집중하기",
    exercise: "계절에 맞춰 강도를 조절하기",
  },
  따뜻: {
    tendency: "약간 더운 쪽으로 기운 편",
    diet: "기름지고 자극적인 음식을 줄이기",
    exercise: "한낮 고강도는 피하기",
  },
  열: {
    tendency: "열기가 위로 뜨기 쉬운 편",
    diet: "찬물보다 미지근한 물을 자주, 맵고 뜨거운 음식과 술을 줄이기",
    exercise: "이른 아침이나 해가 진 뒤의 서늘한 시간대에 하기",
  },
};

export const METABOLISM_NOTE: Record<MetabolismTendency, string> = {
  발산형:
    "일간을 돕는 힘이 넉넉해 기운이 밖으로 도는 편이다. 먹는 양을 줄이는 것보다 쓰는 양을 늘리는 순서가 잘 맞는다.",
  축적형:
    "일간을 돕는 힘이 얇아 쌓아 두려는 쪽이다. 무리하게 줄이기보다 수면과 끼니를 먼저 고정하고 강도는 나중에 올리는 순서가 맞는다.",
};

export const GAIN_PATTERN_NOTE: Record<GainPattern, string> = {
  근육형:
    "겨루듯 몰아붙이기 쉬운 결이다. 체중 숫자보다 몸의 구성이 더 의미 있고, 한 번에 쏟아붓는 방식은 오래가지 않는다.",
  식욕형:
    "먹고 만들고 나누는 즐거움이 큰 결이다. 참는 방식보다 먹는 순서와 그릇 크기를 조절하는 쪽이 오래간다.",
  불규칙형:
    "바깥 일정에 끌려 식사 시간이 들쭉날쭉해지기 쉬운 결이다. 메뉴보다 시간을 먼저 고정하는 것이 낫다.",
  스트레스형:
    "긴장을 오래 붙들고 있는 결이다. 압박이 쌓인 날 늦은 시간에 몰아 먹는 흐름을 먼저 끊는 것이 좋다.",
  정체형:
    "받아들이고 쌓는 쪽이 강한 결이다. 활동량이 줄면 바로 붙으므로 앉아 있는 시간을 끊어 주는 것이 먼저다.",
};

/**
 * 접근 순서에 딸린 근거 문구 (TASK-24).
 *
 * `order` 는 **무엇을 먼저 하고 무엇을 나중에 하는가**, `caution` 은 그 순서를 지킬 때
 * 흔히 어긋나는 지점이다. 둘 다 생활 습관 수준을 넘지 않는다 — 단식·특정 식단 이름·
 * 칼로리·목표 체중 같은 것은 넣지 않는다 (`constitution.test.ts` 가 막는다).
 */
export const DIET_APPROACH_NOTE: Record<DietApproach, { order: string; caution: string }> = {
  "활동량 우선": {
    order:
      "쓰는 양을 먼저 늘리고 먹는 양은 그다음에 손댄다. 앉아 있는 시간을 끊는 것이 첫 단계다.",
    caution:
      "한 번에 강도를 올리면 며칠 만에 멈춘다. 같은 강도를 자주 반복하는 쪽이 오래간다.",
  },
  "식사량 조절 우선": {
    order:
      "먹는 양과 순서를 먼저 손대고 움직임은 지금 하던 만큼 유지한다. 그릇 크기와 먹는 순서가 첫 단계다.",
    caution:
      "끼니를 거르는 방식으로 양을 줄이면 다음 끼니에 몰린다. 줄이는 것은 끼니 수가 아니라 한 번의 양이다.",
  },
  "리듬 고정 우선": {
    order:
      "먹는 시각과 자는 시각을 먼저 고정하고, 양과 강도는 리듬이 잡힌 뒤에 손댄다.",
    caution:
      "메뉴를 먼저 바꾸면 시각이 다시 흐트러진다. 무엇을 먹을지보다 언제 먹을지가 먼저다.",
  },
  "회복 우선": {
    order: "잠과 쉬는 시간을 먼저 확보하고, 활동량은 그다음에 조금씩 올린다.",
    caution:
      "지탱하는 힘이 얇은 상태에서 강도를 올리면 회복이 밀려 오히려 멈춘다. 늘리는 것은 한 번의 길이가 아니라 횟수부터다.",
  },
};

// ── 판정 ───────────────────────────────────────────────────────────────────
export interface ConstitutionFocus {
  element: Ohaeng;
  level: "과다" | "부족";
  /** 몸의 결 — 생활어 */
  axis: string;
  tendency: string;
  diet: string;
  exercise: string;
}

export interface ConstitutionAnalysis {
  /** 오행별 3단계 — 점수가 평균의 몇 배인지로 가른다 (우리 관례) */
  balance: Record<Ohaeng, BalanceLevel>;
  excess: Ohaeng[];
  deficient: Ohaeng[];
  /** 과다·부족이 하나도 없는가 (고르게 퍼진 원국) */
  even: boolean;

  /** 한열 — 조후 */
  thermal: ThermalTendency;
  /** 한열 판정의 근거: 계절 기울기 + 원국 화·수 기울기 (−2~+2) */
  thermalScore: number;
  thermalTendency: string;
  thermalDiet: string;
  thermalExercise: string;

  /** 신강/신약에서 오는 대사 기조 */
  metabolism: MetabolismTendency;
  metabolismNote: string;

  /** 일간을 뺀 글자들의 십신 그룹 분포 */
  sipsinGroups: Record<SipsinGroup, number>;
  dominantGroup: SipsinGroup;
  gainPattern: GainPattern;
  gainPatternNote: string;

  /**
   * 다이어트 접근 순서 — 대사 기조 × 걸리는 지점 (우리 관례, TASK-24).
   * "무엇을 먼저 고정하는가" 를 정한다. LLM 이 다시 정하지 않는다.
   */
  gainSite: GainSite;
  dietApproach: DietApproach;
  dietApproachOrder: string;
  dietApproachCaution: string;

  /** 과다·부족 오행마다의 관리 축. 과다 먼저, 그다음 부족 (오행 순서 유지) */
  focus: ConstitutionFocus[];
}

export interface ConstitutionInput {
  ilgan: number;
  year: GanjiIndex;
  month: GanjiIndex;
  day: GanjiIndex;
  hour: GanjiIndex | null;
  ohaeng: OhaengAnalysis;
  strength: StrengthAnalysis;
}

export function analyzeConstitution(input: ConstitutionInput): ConstitutionAnalysis {
  const { ohaeng, strength } = input;

  // ── 오행 과다/부족 ──
  const total = OHAENG_LIST.reduce((sum, element) => sum + ohaeng.score[element], 0);
  const mean = total / OHAENG_LIST.length;

  const balance = {} as Record<Ohaeng, BalanceLevel>;
  for (const element of OHAENG_LIST) {
    const score = ohaeng.score[element];
    balance[element] =
      score >= mean * EXCESS_RATIO ? "과다" : score <= mean * DEFICIENT_RATIO ? "부족" : "적정";
  }
  const excess = OHAENG_LIST.filter((element) => balance[element] === "과다");
  const deficient = OHAENG_LIST.filter((element) => balance[element] === "부족");

  // ── 한열 (조후) ──
  // 계절이 먼저, 원국의 화·수 세력이 보정. 동점이면 치우침 없음으로 둔다.
  const chartTilt =
    ohaeng.score.화 > ohaeng.score.수 ? 1 : ohaeng.score.화 < ohaeng.score.수 ? -1 : 0;
  const thermalScore = SEASON_TILT[ohaeng.season] + chartTilt;
  const thermal = THERMAL_SCALE[thermalScore + 2]!;

  // ── 대사 기조 ──
  // 신강 계열은 쓸 힘이 있고, 신약 계열은 회복이 먼저다.
  const metabolism: MetabolismTendency =
    strength.verdict === "신강" || strength.verdict === "약간 신강" ? "발산형" : "축적형";

  // ── 살이 붙는 패턴 ──
  const sipsinGroups = countSipsinGroups(input);
  // 동점이면 고전 십신 순서(비겁→식상→재성→관성→인성)에서 앞선 쪽. 결정론을 위해 고정한다.
  const dominantGroup = SIPSIN_GROUPS.reduce((best, group) =>
    sipsinGroups[group] > sipsinGroups[best] ? group : best,
  );
  const gainPattern = PATTERN_OF_GROUP[dominantGroup];

  // ── 다이어트 접근 순서 ──
  // 2×2 표라 동점이 없다. 두 입력이 이미 결정론적이므로 같은 사주면 같은 방식이 나온다.
  const gainSite = SITE_OF_PATTERN[gainPattern];
  const dietApproach = APPROACH_TABLE[metabolism][gainSite];

  // ── 관리 축 ──
  const focus: ConstitutionFocus[] = [
    ...excess.map((element) => toFocus(element, "과다")),
    ...deficient.map((element) => toFocus(element, "부족")),
  ];

  return {
    balance,
    excess,
    deficient,
    even: excess.length === 0 && deficient.length === 0,

    thermal,
    thermalScore,
    thermalTendency: THERMAL_GUIDE[thermal].tendency,
    thermalDiet: THERMAL_GUIDE[thermal].diet,
    thermalExercise: THERMAL_GUIDE[thermal].exercise,

    metabolism,
    metabolismNote: METABOLISM_NOTE[metabolism],

    sipsinGroups,
    dominantGroup,
    gainPattern,
    gainPatternNote: GAIN_PATTERN_NOTE[gainPattern],

    gainSite,
    dietApproach,
    dietApproachOrder: DIET_APPROACH_NOTE[dietApproach].order,
    dietApproachCaution: DIET_APPROACH_NOTE[dietApproach].caution,

    focus,
  };
}

function toFocus(element: Ohaeng, level: "과다" | "부족"): ConstitutionFocus {
  const guide = FOCUS_GUIDE[element][level];
  return {
    element,
    level,
    axis: BODY_AXIS[element].axis,
    tendency: guide.tendency,
    diet: guide.diet,
    exercise: guide.exercise,
  };
}

/**
 * 일간을 뺀 글자들의 십신 그룹을 센다.
 *
 * 세는 자리는 `analyzeStrength` 의 판정 글자와 같다 — 년간·년지·월간·월지·일지(·시간·시지).
 * 일간 자신은 비교 기준이므로 제외한다. 두 판정이 다른 글자를 보면 근거가 어긋난다.
 */
function countSipsinGroups(input: ConstitutionInput): Record<SipsinGroup, number> {
  const counts = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 } as Record<SipsinGroup, number>;

  const add = (group: SipsinGroup) => {
    counts[group] += 1;
  };

  const { ilgan } = input;
  add(sipsinGroup(sipsinOf(ilgan, input.year.gan)));
  add(sipsinGroup(jiSipsin(ilgan, input.year.ji)));
  add(sipsinGroup(sipsinOf(ilgan, input.month.gan)));
  add(sipsinGroup(jiSipsin(ilgan, input.month.ji)));
  add(sipsinGroup(jiSipsin(ilgan, input.day.ji)));
  if (input.hour) {
    add(sipsinGroup(sipsinOf(ilgan, input.hour.gan)));
    add(sipsinGroup(jiSipsin(ilgan, input.hour.ji)));
  }

  return counts;
}
