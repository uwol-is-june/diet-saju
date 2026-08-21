import {
  ELEMENT_FOOD,
  VERDICT_BASIS_APPROACH,
  VERDICT_BASIS_GAIN,
  VERDICT_BASIS_METABOLISM,
  verdictFoodBasis,
  verdictMovementBasis,
  type DietApproach,
  type GainPattern,
  type MetabolismTendency,
} from "../saju/constitution";
import type { Ohaeng } from "../saju/ganji";
import type { ReadingType, SajuChart } from "../saju/schema";

/**
 * 판정 한 줄 — **무엇을 띄울지 정하는 단일 소스** (TASK-47 · 111 · 116).
 *
 * 화면(`components/VerdictCallout.tsx`)과 공유 카드(`lib/share/card-model.ts`)가 **같은 값을
 * 읽는다.** 예전에는 이 표가 컴포넌트 안에 있었고 카드는 원국을 따로 그렸다 — 두 곳이 각자
 * 고르면 화면과 저장된 이미지가 다른 말을 한다.
 *
 * **LLM 이 쓰지 않는다.** 라벨은 `constitution.ts` 에서 오고 같은 사주면 언제나 같다.
 *
 * **`Record` 다.** 삼항이나 인덱스 시그니처로 두면 새 유형이 조용히 남의 콜아웃을 달고 나간다.
 * **모든 유형이 낸다** — 조건은 하나, **라벨이 기존 판정에서 1:1 로 파생될 것**(새 동점 금지).
 * (`deficient[0]` 처럼 목록의 첫 항목을 쓰는 것은 새 동점이 아니다 — 오행 열거 순서라 이미
 * 고정돼 있다.)
 *
 * **근거 줄은 판정 축의 이름을 대지 않고 라벨의 뜻을 말한다** (TASK-105). 문구는
 * `constitution.ts` 의 `VERDICT_BASIS_*` 에 있다 — 여기 직접 쓰면 `constitution.test.ts` 의
 * 금지 어휘·처방·숫자·효능 검사를 통째로 우회한다.
 */
export interface Callout {
  /** 아래 라벨이 무엇에 대한 답인지 말하는 줄 */
  eyebrow: string;
  label: string;
  basis: string;
  /** `public/verdict/<slug>.jpg`. 목록에 나오지 않는 내부 유형은 `null` 이다. */
  photo: string | null;
}

/**
 * 눈썹 줄 — **아래 라벨이 무엇에 대한 답인지 말한다** (TASK-111).
 *
 * 예전에는 상수 하나(`이 사주에서 읽은 한 줄`)라 일곱 유형이 같은 말을 냈다.
 *
 * - **판정 축의 이름을 대지 않는다** (`몸의 온도`·`대사 기조` 류). 근거 줄과 같은 규칙이다.
 * - **유형 이름을 그대로 되풀이하는 것이 요구다.** `/reading/exercise` 화면에는 제목
 *   `나에게 맞는 운동` 이 이미 있어 같은 말이 두 번 나오지만 **그대로 간다** — 제목은 화면의
 *   이름이고 이 줄은 아래 라벨을 여는 말이다.
 * - **390px `text-xs` 에서 한 줄이다.** 가장 긴 `나에게 맞는 다이어트 식단은` 이 137px 이고
 *   카드 글 폭은 310px 다 (2026-08-21 · 390px · DPR 2 실측).
 * - 내부 유형(`general`·`decade`)도 `/admin` 으로 들어가므로 값이 필요하다.
 */
export const EYEBROW: Record<ReadingType, string> = {
  general: "타고난 기질은",
  diet: "몸이 기울어 있는 쪽은",
  "gain-cause": "내가 살이 찌는 이유는",
  "diet-method": "나에게 맞는 다이어트 방법은",
  "diet-food": "나에게 맞는 다이어트 식단은",
  exercise: "나에게 맞는 운동은",
  decade: "지금 지나는 10년은",
};

/*
 * 사진 슬러그는 **유형이 아니라 판정 축의 값**에 붙는다 — `Record<축, …>` 라 축에 값이
 * 늘면 컴파일 오류로 잡힌다. `verdict-photo.test.ts` 가 이 파일 · 받아 오는 스크립트 ·
 * `public/verdict/` 셋을 대조한다.
 *
 * **파일 이름은 판정 라벨과 함께 바꾸지 않는다** — 바뀌는 것은 Record 의 키뿐이다 (TASK-117).
 */
const METABOLISM_PHOTO: Record<MetabolismTendency, string> = {
  발산형: "metabolism-balsan",
  축적형: "metabolism-chukjeok",
};

const GAIN_PHOTO: Record<GainPattern, string> = {
  근육형: "gain-geunyuk",
  식욕형: "gain-sigyok",
  불규칙형: "gain-bulgyuchik",
  스트레스형: "gain-stress",
  "움직임 부족형": "gain-jeongche",
};

const APPROACH_PHOTO: Record<DietApproach, string> = {
  "활동량 우선": "approach-activity",
  "식사량 조절 우선": "approach-meal",
  "회복 우선": "approach-recovery",
  "리듬 고정 우선": "approach-rhythm",
};

/**
 * 곁들일 계열. **재료 사진이 아니라 오행 상징이다** — 채소·곡물을 찍으면 `ELEMENT_FOOD`
 * 닫힌 목록을 판정 코드 밖에서 우회하는 셈이 된다.
 */
const ELEMENT_PHOTO: Record<Ohaeng, string> = {
  목: "element-mok",
  화: "element-hwa",
  토: "element-to",
  금: "element-geum",
  수: "element-su",
};

/** 부족한 오행이 없을 때. 라벨이 "곁들일 계열이 따로 없음" 이므로 그림도 균형 쪽이다. */
const ELEMENT_EVEN_PHOTO = "element-even";

/**
 * 대표 종목. 접근 순서에서 1:1 로 나오므로 키가 `DietApproach` 이고 새 동점이 없다.
 * **`APPROACH_PHOTO` 와 다른 사진을 쓴다** — 같은 장을 돌려 쓰면 `diet-method` 에서
 * `exercise` 로 넘어갔을 때 화면이 바뀌지 않은 것처럼 보인다.
 */
const MOVEMENT_PHOTO: Record<DietApproach, string> = {
  "활동량 우선": "movement-brisk",
  "식사량 조절 우선": "movement-strength",
  "회복 우선": "movement-slow",
  "리듬 고정 우선": "movement-rhythm",
};

type CalloutBody = Omit<Callout, "eyebrow">;

const CALLOUT: Record<ReadingType, (chart: SajuChart) => CalloutBody | null> = {
  // 내부 유형이지만 `Record` 라 값이 필요하다. 신강신약은 고전 규칙이라 그대로 쓴다.
  general: (chart) => ({
    label: chart.strength.verdict,
    basis: `${chart.ohaeng.season}에 태어나 ${chart.ohaeng.strongest} 기운이 가장 강한 사주입니다`,
    // 목록에 나오지 않는 유형이라 사진을 만들지 않았다 (TASK-90 범위는 공개 다섯 유형).
    photo: null,
  }),
  /**
   * 종합 체질. **대사 기조를 라벨로 쓴다** — 신강신약에서 1:1 로 나오고 이 유형이 답하는
   * "몸이 어떤 쪽인가" 에 가장 가깝다.
   */
  diet: (chart) => ({
    label: chart.constitution.metabolism,
    basis: VERDICT_BASIS_METABOLISM[chart.constitution.metabolism],
    photo: METABOLISM_PHOTO[chart.constitution.metabolism],
  }),
  "gain-cause": (chart) => ({
    label: chart.constitution.gainLabel,
    basis: VERDICT_BASIS_GAIN[chart.constitution.gainPattern],
    photo: GAIN_PHOTO[chart.constitution.gainPattern],
  }),
  // 방법 유형 (TASK-66): 접근 순서가 이 유형이 답하는 질문이다. 2×2 표라 동점이 없다.
  "diet-method": (chart) => ({
    label: chart.constitution.dietApproach,
    basis: VERDICT_BASIS_APPROACH[chart.constitution.dietApproach],
    photo: APPROACH_PHOTO[chart.constitution.dietApproach],
  }),
  /**
   * 식단 유형. **부족한 계열이 없을 때 지어내지 않는다** — 그 사실 자체가 판정이고,
   * 근거 줄도 "지금 먹는 대로 두면 된다" 로 갈린다 (`verdictFoodBasis`).
   */
  "diet-food": (chart) => {
    const element = chart.constitution.deficient[0];
    const basis = verdictFoodBasis(element);
    if (!element) {
      return { label: "오행이 고르게 퍼진 편", basis, photo: ELEMENT_EVEN_PHOTO };
    }
    const food = ELEMENT_FOOD[element];
    return {
      /** **오행 이름이 아니라 재료 이름이 뜬다** — 오행은 아는 사람만 읽을 수 있다. */
      label: `${food.short}${objectParticle(food.short)} 곁들이기`,
      basis,
      photo: ELEMENT_PHOTO[element],
    };
  },
  /**
   * 운동 유형. **콜아웃이 이 유형의 핵심이다** — 종목이 본문 어딘가가 아니라 맨 위에 뜬다.
   * 근거 줄은 **두 층을 각자의 표에서 받아 끼운다** (강도 = 접근 순서, 때 = 몸의 온도).
   */
  exercise: (chart) => ({
    label: chart.constitution.movementPrimary,
    basis: verdictMovementBasis(chart.constitution.dietApproach, chart.constitution.thermal),
    photo: MOVEMENT_PHOTO[chart.constitution.dietApproach],
  }),
  /**
   * 시기 유형. 작용 3단계가 라벨이다 (`yearly.ts` 규칙을 대운에 적용한 값이라 새 관례가 없다).
   * **다음 구간은 판정하지 않았으므로 라벨에도 없다.**
   */
  decade: (chart) =>
    chart.decade
      ? {
          // 라벨이 `채워 주는`·`겹치는`·`무던한` 이라 그대로 이어 붙는다 (TASK-117).
          // **`~하는` 을 덧대지 말 것** — 예전 한자 라벨(`보완`)에 필요하던 꼬리다.
          label: `${chart.decade.current.effect} 10년`,
          /*
            **간지를 근거 줄에 쓰지 않는다** (TASK-116·117). 공유 카드가 같은 값을 싣는데
            대운 간지는 나이 구간까지 좁히는 값이고(`card-model.test.ts` 가 막는다), 읽는
            사람에게는 모르는 말이다. 간지는 화면의 `대운 · 세운` 근거 카드에 이미 있다.
          */
          basis: chart.decade.shift
            ? `직전 구간과 견주면 ${chart.decade.shift}입니다`
            : `아직 첫 10년 구간을 지나는 중입니다`,
          // `general` 과 같다 — 내부 유형이라 사진을 만들지 않았다.
          photo: null,
        }
      : null,
};

/** 화면과 공유 카드가 함께 부른다. 판정이 성립하지 않으면 `null`(내지 않는다). */
export function verdictOf(chart: SajuChart, readingType: ReadingType): Callout | null {
  const body = CALLOUT[readingType](chart);
  return body ? { eyebrow: EYEBROW[readingType], ...body } : null;
}

/**
 * 목적격 조사 — 받침이 있으면 `을`, 없으면 `를`. 라벨마다 손으로 적으면 표가 하나 더
 * 생긴다. 한글 음절은 `(코드 − 0xAC00) % 28` 이 종성 인덱스라 규칙 하나로 끝난다.
 */
function objectParticle(word: string): string {
  const last = word.codePointAt(word.length - 1) ?? 0;
  if (last < 0xac00 || last > 0xd7a3) return "를";
  return (last - 0xac00) % 28 === 0 ? "를" : "을";
}
