import { describe, expect, it } from "vitest";
import { analyzeOhaeng, analyzeStrength, type OhaengAnalysis } from "./analysis";
import {
  BODY_AXIS,
  DEFICIENT_RATIO,
  DIET_APPROACH_NOTE,
  ELEMENT_FOOD,
  EXCESS_RATIO,
  FOCUS_GUIDE,
  FOOD_HOW,
  GAIN_LABEL,
  GAIN_PATTERN_NOTE,
  MEAL_PLAN,
  METABOLISM_NOTE,
  MOVEMENT_PLAN,
  THERMAL_GUIDE,
  VERDICT_BASIS_APPROACH,
  VERDICT_BASIS_FOOD,
  VERDICT_BASIS_FOOD_EVEN,
  VERDICT_BASIS_GAIN,
  VERDICT_BASIS_METABOLISM,
  VERDICT_BASIS_MOVEMENT,
  VERDICT_TIME_SLOT,
  analyzeConstitution,
  verdictFoodBasis,
  verdictMovementBasis,
  type ConstitutionInput,
  type DietApproach,
  type ThermalTendency,
} from "./constitution";
import {
  SIPSIN_GROUPS,
  fromSexagenary,
  type GanjiIndex,
  type Ohaeng,
  type SipsinGroup,
} from "./ganji";

/**
 * 체질 판정 검증 (TASK-14).
 *
 * 완료 기준은 "같은 사주에 항상 같은 체질 판정" 이다. 그래서 이 파일은
 *  1. 결정론 (같은 입력 → 같은 출력, 동점에서도)
 *  2. 판정이 상수·고전 규칙과 일관되는가
 *  3. 사용자에게 나가는 문구가 의학적 주장으로 읽히지 않는가
 * 를 본다.
 *
 * 관례(임계값·눈금)는 값이 바뀔 수 있으므로 "상수와 일관되는가" 를 보고,
 * 고전에서 오는 것(조후 순서·십신 5분류)은 규칙 자체를 박아 둔다.
 */

const OHAENG_LIST: readonly Ohaeng[] = ["목", "화", "토", "금", "수"];

// 1990-05-17 14:30 사주: 경오 신사 임오 정미 (analysis.test.ts 와 같은 표본)
const CHART_1990 = {
  year: { gan: 6, ji: 6 } satisfies GanjiIndex, // 경오
  month: { gan: 7, ji: 5 } satisfies GanjiIndex, // 신사
  day: { gan: 8, ji: 6 } satisfies GanjiIndex, // 임오
  hour: { gan: 3, ji: 7 } satisfies GanjiIndex, // 정미
};

/** 네 기둥에서 실제 분석 함수를 거쳐 입력을 만든다 (합성 데이터로 우회하지 않는다). */
function inputFrom(chart: {
  year: GanjiIndex;
  month: GanjiIndex;
  day: GanjiIndex;
  hour: GanjiIndex | null;
}): ConstitutionInput {
  const pillars = [chart.year, chart.month, chart.day, ...(chart.hour ? [chart.hour] : [])];
  const ilgan = chart.day.gan;
  return {
    ilgan,
    ...chart,
    ohaeng: analyzeOhaeng(pillars, chart.month.ji),
    strength: analyzeStrength({ ilgan, ...chart }),
  };
}

/** 60갑자를 서로 다른 보폭으로 훑어 만든 표본. 재현 가능하도록 난수를 쓰지 않는다. */
function sweepCharts(): { year: GanjiIndex; month: GanjiIndex; day: GanjiIndex; hour: GanjiIndex | null }[] {
  const charts = [];
  for (let i = 0; i < 60; i += 1) {
    const base = {
      year: fromSexagenary(i),
      month: fromSexagenary((i * 7 + 3) % 60),
      day: fromSexagenary((i * 13 + 11) % 60),
    };
    charts.push({ ...base, hour: fromSexagenary((i * 29 + 41) % 60) });
    charts.push({ ...base, hour: null }); // 시각 미상
  }
  return charts;
}

const SWEEP = sweepCharts();

describe("결정론 — 완료 기준", () => {
  it("같은 입력을 두 번 넣으면 완전히 같은 판정이 나온다", () => {
    for (const chart of SWEEP) {
      const input = inputFrom(chart);
      expect(analyzeConstitution(input)).toEqual(analyzeConstitution(input));
    }
  });

  it("표본 120건이 예외 없이 판정된다", () => {
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(THERMAL_GUIDE[result.thermal]).toBeDefined();
      expect(GAIN_PATTERN_NOTE[result.gainPattern]).toBeDefined();
      expect(METABOLISM_NOTE[result.metabolism]).toBeDefined();
    }
    expect(SWEEP.length).toBe(120);
  });

  it("십신 동점이면 고전 십신 순서에서 앞선 그룹을 고른다", () => {
    // 동점 처리를 규칙으로 고정해 두지 않으면 판정이 흔들린다.
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      const max = Math.max(...SIPSIN_GROUPS.map((group) => result.sipsinGroups[group]));
      const firstWithMax = SIPSIN_GROUPS.find((group) => result.sipsinGroups[group] === max);
      expect(result.dominantGroup).toBe(firstWithMax);
    }
  });
});

describe("오행 과다 / 부족 (우리 관례 — 임계값)", () => {
  it("1990 사주는 화 과다, 목·수 부족", () => {
    // 경오 신사 임오 정미 · 여름(사월) → 화 왕(4개), 목 0개, 수 1개
    const result = analyzeConstitution(inputFrom(CHART_1990));
    expect(result.excess).toEqual(["화"]);
    expect(result.deficient).toEqual(["목", "수"]);
    expect(result.balance.토).toBe("적정");
    expect(result.balance.금).toBe("적정");
    expect(result.even).toBe(false);
  });

  it("판정이 임계 상수와 항상 일치한다", () => {
    for (const chart of SWEEP) {
      const input = inputFrom(chart);
      const result = analyzeConstitution(input);
      const mean =
        OHAENG_LIST.reduce((sum, element) => sum + input.ohaeng.score[element], 0) /
        OHAENG_LIST.length;

      for (const element of OHAENG_LIST) {
        const score = input.ohaeng.score[element];
        const expected =
          score >= mean * EXCESS_RATIO
            ? "과다"
            : score <= mean * DEFICIENT_RATIO
              ? "부족"
              : "적정";
        expect(result.balance[element]).toBe(expected);
      }
    }
  });

  it("개수가 0인 오행은 항상 부족으로 잡힌다", () => {
    for (const chart of SWEEP) {
      const input = inputFrom(chart);
      const result = analyzeConstitution(input);
      for (const element of input.ohaeng.missing) {
        expect(result.deficient).toContain(element);
      }
    }
  });

  it("모든 오행이 과다이거나 모두 부족일 수는 없다", () => {
    // 평균 기준이므로 최댓값은 절대 부족이 될 수 없고 최솟값은 과다가 될 수 없다.
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(result.excess.length).toBeLessThan(5);
      expect(result.deficient.length).toBeLessThan(5);
    }
  });

  it("focus 는 과다 먼저, 그다음 부족 순서다", () => {
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(result.focus.map((f) => `${f.element}${f.level}`)).toEqual([
        ...result.excess.map((e) => `${e}과다`),
        ...result.deficient.map((e) => `${e}부족`),
      ]);
      for (const item of result.focus) {
        expect(item.axis).toBe(BODY_AXIS[item.element].axis);
        expect(item.diet).toBe(FOCUS_GUIDE[item.element][item.level].diet);
        expect(item.exercise).toBe(FOCUS_GUIDE[item.element][item.level].exercise);
      }
    }
  });
});

describe("재료 범주 (TASK-27)", () => {
  /**
   * 완료 기준은 "같은 사주에 항상 같은 식품 목록" + "목록 밖 식품이 등장하지 않는다" 다.
   * 뒤쪽은 프롬프트 지시라 여기서는 **목록이 결정론적이고 닫혀 있는지**를 본다.
   */
  it("다섯 오행 모두에 근거와 재료가 있다", () => {
    for (const element of OHAENG_LIST) {
      const food = ELEMENT_FOOD[element];
      expect(food.basis.length).toBeGreaterThan(0);
      expect(food.groups.length).toBeGreaterThanOrEqual(3);
      expect(food.groups.every((group) => group.length > 0)).toBe(true);
    }
  });

  /**
   * 화면에 크게 뜨는 짧은 이름 (TASK-102). 콜아웃 라벨과 공유 칩이 함께 쓴다.
   *
   * **맛을 올리지 않는다** — 한열이 `열` 인 사람 화면에서 `THERMAL_GUIDE.열` 의
   * "맵고 뜨거운 음식과 술을 줄이기" 와 정면으로 부딪힌다. 재료는 오행, 조리·온도는
   * 한열이라는 층 구분이 라벨에서 무너지는 자리다.
   */
  it("오행마다 읽히는 짧은 이름이 있다", () => {
    for (const element of OHAENG_LIST) {
      const short = ELEMENT_FOOD[element].short;
      expect(short.length).toBeGreaterThan(0);
      // 오행 이름 한 글자를 그대로 쓰면 예전(`금 계열`)으로 되돌아간 것이다.
      expect(short).not.toBe(element);
      expect(short).not.toContain("계열");
      for (const flavor of ["신맛", "쓴맛", "단맛", "매운맛", "짠맛"]) {
        expect(short, `${element} 짧은 이름에 ${flavor}`).not.toContain(flavor);
      }
    }
  });

  it("오미·오색 배속(고전)을 근거로 적는다", () => {
    // 배속 자체는 고전이고 재료 선택만 우리 관례다. 근거 문구가 그것을 밝혀야 한다.
    const flavor: Record<Ohaeng, string> = {
      목: "신맛",
      화: "쓴맛",
      토: "단맛",
      금: "매운맛",
      수: "짠맛",
    };
    for (const element of OHAENG_LIST) {
      expect(ELEMENT_FOOD[element].basis).toContain(flavor[element]);
    }
  });

  it("과다·부족마다 재료가 focus 에 실린다", () => {
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      for (const item of result.focus) {
        expect(item.foodBasis).toBe(ELEMENT_FOOD[item.element].basis);
        expect(item.foodGroups).toEqual(ELEMENT_FOOD[item.element].groups);
        expect(item.foodHow).toBe(FOOD_HOW[item.level]);
      }
    }
  });

  it("부족은 곁들이기, 과다는 더 늘리지 않기까지만 말한다", () => {
    // 알레르기·지병·복약을 모르므로 다량 섭취나 제한을 권할 근거가 없다.
    expect(FOOD_HOW.부족).toContain("곁들이는");
    expect(FOOD_HOW.부족).toContain("많이 먹으라는 뜻이 아니다");
    expect(FOOD_HOW.과다).toContain("더 늘리지 않아도");
    expect(FOOD_HOW.과다).toContain("끊으라는 뜻은 아니다");
  });

  it("재료 목록에 상표·보조식품·수치가 없다", () => {
    // `short` 도 사용자에게 그대로 나가는 문자열이다 — 같은 검사를 받아야 한다 (TASK-102).
    const groups = OHAENG_LIST.flatMap((element) => [
      ...ELEMENT_FOOD[element].groups,
      ELEMENT_FOOD[element].short,
    ]);
    for (const group of groups) {
      expect(group).not.toMatch(/\d/);
      for (const word of ["영양제", "보조", "제품", "즙", "환", "추출"]) {
        expect(group, `${group} 에 ${word}`).not.toContain(word);
      }
    }
  });

  it("성미(性味) 용어를 쓰지 않는다", () => {
    // 식품의 온·냉 성질표는 출처가 한의학이다. 면책 고지가 "한의학과 무관" 을 약속하므로
    // 조리·온도는 생활어(THERMAL_GUIDE)로 말하고 이 표에는 성질 용어를 넣지 않는다.
    const all = OHAENG_LIST.flatMap((element) => [
      ELEMENT_FOOD[element].basis,
      ELEMENT_FOOD[element].short,
      ...ELEMENT_FOOD[element].groups,
    ]);
    for (const word of ["온성", "냉성", "평성", "성질이 따뜻", "성질이 차", "기운을 보"]) {
      expect(all.filter((text) => text.includes(word))).toEqual([]);
    }
  });

  it("치우침이 없으면 재료를 억지로 고르지 않는다", () => {
    // focus 가 비면 재료도 없다. 없는 근거로 식품을 지어내지 않는 것이 맞다
    // (프롬프트가 그 경우 한열·대사 기조 위주로 쓰라고 지시한다).
    const evenCharts = SWEEP.filter((chart) => analyzeConstitution(inputFrom(chart)).even);
    for (const chart of evenCharts) {
      expect(analyzeConstitution(inputFrom(chart)).focus).toEqual([]);
    }
  });
});

describe("한열 (조후) — 계절 먼저, 원국 화·수가 보정", () => {
  /** 계절과 화·수 세력만 바꾼 최소 입력. 조후 규칙만 떼어 본다. */
  function thermalOf(season: OhaengAnalysis["season"], hwa: number, su: number): ThermalTendency {
    const input = inputFrom(CHART_1990);
    const ohaeng: OhaengAnalysis = {
      ...input.ohaeng,
      season,
      score: { ...input.ohaeng.score, 화: hwa, 수: su },
    };
    return analyzeConstitution({ ...input, ohaeng }).thermal;
  }

  it.each([
    ["여름", 4, 1, "열"],
    ["여름", 1, 4, "중화"],
    ["여름", 2, 2, "따뜻"],
    ["겨울", 1, 4, "한"],
    ["겨울", 4, 1, "중화"],
    ["겨울", 2, 2, "서늘"],
    ["봄", 4, 1, "따뜻"],
    ["봄", 1, 4, "서늘"],
    ["봄", 2, 2, "중화"],
    ["가을", 2, 2, "중화"],
  ] as const)("%s · 화 %d 수 %d → %s", (season, hwa, su, expected) => {
    expect(thermalOf(season, hwa, su)).toBe(expected);
  });

  it("눈금 점수는 항상 −2~+2 이고 5단계와 짝이 맞는다", () => {
    const scale: ThermalTendency[] = ["한", "서늘", "중화", "따뜻", "열"];
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(result.thermalScore).toBeGreaterThanOrEqual(-2);
      expect(result.thermalScore).toBeLessThanOrEqual(2);
      expect(result.thermal).toBe(scale[result.thermalScore + 2]);
      expect(result.thermalDiet).toBe(THERMAL_GUIDE[result.thermal].diet);
      expect(result.thermalExercise).toBe(THERMAL_GUIDE[result.thermal].exercise);
    }
  });
});

describe("대사 기조 — 신강/신약에서 온다", () => {
  it.each([
    ["신강", "발산형"],
    ["약간 신강", "발산형"],
    ["약간 신약", "축적형"],
    ["신약", "축적형"],
  ] as const)("%s → %s", (verdict, expected) => {
    const input = inputFrom(CHART_1990);
    const result = analyzeConstitution({
      ...input,
      strength: { ...input.strength, verdict },
    });
    expect(result.metabolism).toBe(expected);
    expect(result.metabolismNote).toBe(METABOLISM_NOTE[expected]);
  });
});

describe("살이 붙는 패턴 — 십신 분포에서 온다", () => {
  it("십신을 세는 글자가 신강신약 판정 글자와 같다", () => {
    // 두 판정이 서로 다른 글자를 보면 프롬프트 안에서 근거가 어긋난다.
    for (const chart of SWEEP) {
      const input = inputFrom(chart);
      const result = analyzeConstitution(input);
      const total = SIPSIN_GROUPS.reduce((sum, group) => sum + result.sipsinGroups[group], 0);
      expect(total).toBe(input.strength.totalChars);
    }
  });

  it("시주가 있으면 7자, 없으면 5자를 센다 (일간 제외)", () => {
    const withHour = analyzeConstitution(inputFrom(CHART_1990));
    const withoutHour = analyzeConstitution(inputFrom({ ...CHART_1990, hour: null }));
    const sum = (groups: Record<SipsinGroup, number>) =>
      SIPSIN_GROUPS.reduce((total, group) => total + groups[group], 0);
    expect(sum(withHour.sipsinGroups)).toBe(7);
    expect(sum(withoutHour.sipsinGroups)).toBe(5);
  });

  it("1990 사주는 재성이 우세해 불규칙형", () => {
    // 일간 임(수) 기준 — 경·신(금)=인성, 오·사·정(화)=재성, 미(토)=관성
    const result = analyzeConstitution(inputFrom(CHART_1990));
    expect(result.sipsinGroups).toEqual({ 비겁: 0, 식상: 0, 재성: 4, 관성: 1, 인성: 2 });
    expect(result.dominantGroup).toBe("재성");
    expect(result.gainPattern).toBe("불규칙형");
    expect(result.gainPatternNote).toBe(GAIN_PATTERN_NOTE.불규칙형);
  });

  it("다섯 패턴이 표본에서 모두 나온다", () => {
    // 특정 패턴으로만 몰리면 매핑이 사실상 죽은 것이다.
    const seen = new Set(SWEEP.map((chart) => analyzeConstitution(inputFrom(chart)).gainPattern));
    expect(seen.size).toBe(5);
  });
});

describe("다이어트 접근 순서 (TASK-24)", () => {
  /**
   * 완료 기준은 "같은 사주에 항상 같은 다이어트 방식" 이다.
   * 2×2 표라 동점이 없고, 두 입력이 각각 이미 결정론적이다.
   */
  it("같은 입력이면 항상 같은 방식이 나온다", () => {
    for (const chart of SWEEP) {
      const first = analyzeConstitution(inputFrom(chart));
      const second = analyzeConstitution(inputFrom(chart));
      expect(second.dietApproach).toBe(first.dietApproach);
      expect(second.gainSite).toBe(first.gainSite);
    }
  });

  it("대사 기조 × 걸리는 지점 2×2 표를 그대로 따른다", () => {
    // 표를 코드에서 다시 읽지 않고 여기 박아 둔다 — 표가 조용히 바뀌면 걸린다.
    const expected: Record<string, DietApproach> = {
      "발산형/움직임": "활동량 우선",
      "발산형/먹는 것": "식사량 조절 우선",
      "축적형/움직임": "회복 우선",
      "축적형/먹는 것": "리듬 고정 우선",
    };
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(result.dietApproach).toBe(expected[`${result.metabolism}/${result.gainSite}`]);
    }
  });

  it("살이 붙는 패턴이 걸리는 지점으로 옳게 갈린다", () => {
    const site = { 근육형: "움직임", 정체형: "움직임", 식욕형: "먹는 것", 불규칙형: "먹는 것", 스트레스형: "먹는 것" };
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(result.gainSite).toBe(site[result.gainPattern]);
    }
  });

  it("네 방식이 표본에서 모두 나온다", () => {
    // 한 칸이라도 도달 불가면 표가 사실상 3분류다.
    const seen = new Set(SWEEP.map((chart) => analyzeConstitution(inputFrom(chart)).dietApproach));
    expect(seen.size).toBe(4);
  });

  it("한열이 방식을 바꾸지 않는다", () => {
    // 한열은 "무엇을 먼저" 가 아니라 "어느 온도·시간대에" 를 정한다 (판정에서 뺀 이유).
    // 같은 대사 기조·같은 패턴이면 한열이 달라도 방식이 같아야 한다.
    const byKey = new Map<string, Set<DietApproach>>();
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      const key = `${result.metabolism}/${result.gainPattern}`;
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key)!.add(result.dietApproach);
    }
    for (const [key, approaches] of byKey) {
      expect(approaches.size, `${key} 에서 방식이 갈렸다`).toBe(1);
    }
  });

  it("방식마다 순서와 어긋나는 지점이 함께 실린다", () => {
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      expect(result.dietApproachOrder).toBe(DIET_APPROACH_NOTE[result.dietApproach].order);
      expect(result.dietApproachCaution).toBe(DIET_APPROACH_NOTE[result.dietApproach].caution);
      expect(result.dietApproachOrder.length).toBeGreaterThan(10);
      expect(result.dietApproachCaution.length).toBeGreaterThan(10);
    }
  });
});

describe("표현 가이드 — 의학적 주장으로 읽히지 않는다", () => {
  /**
   * 면책 고지(`app/disclaimer/page.tsx`)가 "진단이나 치료 방법이 아니다" 라고 약속한다.
   * 사용자에게 그대로 인용될 수 있는 문구에 이 어휘가 들어가면 그 약속이 깨진다.
   */
  const BANNED = [
    "치료", "완치", "처방", "진단", "질병", "질환", "증상", "효능", "효과",
    "약효", "해독", "독소", "면역", "항암", "염증", "혈압", "혈당", "콜레스테롤",
    "보장", "빠집니다", "빠진다", "낫는다", "반드시",
  ];

  /**
   * 감량 "방법" 은 의학·영양 조언에 가장 가까이 간다 (TASK-24). 어휘 금지만으로는
   * 부족해서 **처방으로 읽히는 것들**을 따로 막는다.
   */
  const BANNED_PRESCRIPTION = [
    "단식", "칼로리", "kcal", "kg", "그램", "저탄", "고지", "키토", "원푸드",
    "체중 감량 목표", "목표 체중", "주 동안", "일주일에", "보조제", "영양제",
  ];

  /** 사용자에게 나갈 수 있는 문구 전부 (BODY_AXIS.classical 은 내보내지 않으므로 제외) */
  const userFacing: string[] = [
    ...OHAENG_LIST.map((element) => BODY_AXIS[element].axis),
    ...OHAENG_LIST.flatMap((element) =>
      (["과다", "부족"] as const).flatMap((level) => [
        FOCUS_GUIDE[element][level].tendency,
        FOCUS_GUIDE[element][level].diet,
        FOCUS_GUIDE[element][level].exercise,
      ]),
    ),
    ...Object.values(THERMAL_GUIDE).flatMap((guide) => [
      guide.tendency,
      guide.diet,
      guide.exercise,
    ]),
    ...Object.values(METABOLISM_NOTE),
    ...Object.values(GAIN_PATTERN_NOTE),
    // 한 줄 라벨 (TASK-47) — 콜아웃으로 **가장 크게** 나가는 문구다
    ...Object.values(GAIN_LABEL),
    ...Object.values(DIET_APPROACH_NOTE).flatMap((note) => [note.order, note.caution]),
    // 실행 방법 (TASK-40) — (B) 로 넓힌 축이라 여기가 가장 처방에 가깝다
    // 대표 종목과 대안도 함께 훑는다 (TASK-48) — 콜아웃으로 가장 크게 나가는 문구다
    ...Object.values(MOVEMENT_PLAN).flatMap((plan) => [
      plan.kind,
      plan.primary,
      ...plan.alternatives,
      plan.how,
      plan.caution,
    ]),
    ...Object.values(MEAL_PLAN).flatMap((plan) => [plan.sequence, plan.timing]),
    // 재료 범주 (TASK-27) — 사용자에게 그대로 인용되는 식품 이름이다
    ...OHAENG_LIST.flatMap((element) => [
      ELEMENT_FOOD[element].basis,
      ...ELEMENT_FOOD[element].groups,
    ]),
    ...Object.values(FOOD_HOW),
    // 판정 콜아웃 근거 줄 (TASK-105) — 라벨 바로 아래에서 본문보다 먼저 읽히는 문구다
    ...Object.values(VERDICT_BASIS_METABOLISM),
    ...Object.values(VERDICT_BASIS_GAIN),
    ...Object.values(VERDICT_BASIS_APPROACH),
    ...Object.values(VERDICT_BASIS_MOVEMENT),
    ...Object.values(VERDICT_TIME_SLOT),
    VERDICT_BASIS_FOOD,
    VERDICT_BASIS_FOOD_EVEN,
  ];

  it("문구 표가 비어 있지 않다", () => {
    // 위 수집이 깨져 빈 배열이 되면 아래 검사가 통과해 버린다.
    expect(userFacing.length).toBe(5 + 30 + 15 + 2 + 5 + 5 + 8 + 28 + 10 + 20 + 2 + 2 + 5 + 4 + 4 + 5 + 2);
  });

  it.each(BANNED)("어느 문구에도 %s 가 없다", (word) => {
    const offenders = userFacing.filter((text) => text.includes(word));
    expect(offenders).toEqual([]);
  });

  it.each(BANNED_PRESCRIPTION)("어느 문구에도 %s 가 없다 (처방 금지)", (word) => {
    const offenders = userFacing.filter((text) => text.includes(word));
    expect(offenders).toEqual([]);
  });

  /**
   * (B) 일부 개방 (TASK-40) 이후로 이 검사가 두 갈래다.
   *
   * **방법은 열렸지만 수치는 그대로 막힌다.** "3kg", "1,200칼로리", "2주", "3세트" 가
   * 섞이면 순서·습관이 아니라 처방으로 읽힌다.
   *
   * **`userFacing` 전체를 훑는다** (TASK-59). 예전에는 실행 방법 표 셋만 봐서
   * `FOCUS_GUIDE` 의 `식사 뒤 20분 걷기` 가 통과했다 — 그 표도 프롬프트의 "관리 축" 으로
   * 실려 나가는데 목록이 두 벌이라 한쪽만 늘어난 것이다. 같은 목록을 쓰면 표를
   * `userFacing` 에 더하는 순간 숫자 검사도 함께 걸린다.
   */
  /**
   * 한 줄 라벨 (TASK-47)은 **콜아웃으로 가장 크게 나가는 문구**라 따로 본다.
   *
   * 단정해도 되는 것은 이 사주에서 **읽어 낸 판정**이고, 막을 것은 **몸의 인과**다
   * (TASK-55 경계). `~해서 찐 살` · `~때문에` 는 몸에서 실제로 일어나는 일을 주장한다.
   *
   * 아래 셋이 **양쪽에서** 잰다 — 인과로 넘어가지 않는가(ii 금지) · 무르게 만들지
   * 않는가(i 개방) · 형태가 고정돼 있는가. 막는 것만 보면 나중에 라벨이 조용히
   * hedge 쪽으로 돌아가도 모른다.
   */
  it("라벨이 몸의 인과를 주장하지 않는다", () => {
    for (const label of Object.values(GAIN_LABEL)) {
      expect(label, `${label} 이 인과로 읽힌다`).not.toMatch(/때문에|해서 찐|라서 찐/);
    }
  });

  it("라벨이 무르게 만드는 어미를 쓰지 않는다", () => {
    // 판정 라벨은 단정한다 (TASK-55). 콜아웃에 hedge 가 붙으면 결론이 사라진다.
    for (const label of Object.values(GAIN_LABEL)) {
      expect(label).not.toMatch(/편|수 있|듯|경향/);
    }
  });

  /**
   * 형태 계약 (TASK-72). 예전 형태는 `~할 때 붙는 결` 이었고 `결` 을 화면에서 없애면서
   * `~할 때 붙는 성향` 이 됐다. **바뀐 것은 머리 낱말뿐이고 `~할 때` 는 그대로다** —
   * 그 자리가 "언제인지" 만 말하고 "왜인지" 는 말하지 않아 위 인과 검사를 성립시킨다.
   * `~해서`·`~라서` 로 바꾸면 형태만으로 (ii) 경계를 넘는다.
   */
  it("라벨이 상황 + 성향 형태이고 `결` 을 쓰지 않는다", () => {
    for (const label of Object.values(GAIN_LABEL)) {
      expect(label, `${label} 이 상황을 말하지 않는다`).toMatch(/(때|자리에서) 붙는 성향$/);
      expect(label).not.toContain("결");
    }
  });

  it("라벨이 패턴마다 다르고 짧다", () => {
    const labels = Object.values(GAIN_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.length).toBeLessThanOrEqual(16);
  });

  /**
   * 콜아웃 **근거 줄** (TASK-105). 라벨 바로 아래에서 본문 첫 글자보다 먼저 읽히는 자리다.
   *
   * 예전에는 `대사 기조 발산형 · 걸리는 지점 먹는 것에서 나온 순서입니다` 처럼 판정 축의
   * 이름을 댔다 — 모르는 말로 출처를 대면 범위 한정이 아니라 권위 신호가 된다. 그 일은
   * 이제 `ResultView` 하단 고정 문구 하나가 맡는다 — 눈썹 줄은 주제를 말하는 줄이 되고
   * (TASK-111) `내 사주` 묶음 머리는 없어졌다(TASK-112).
   *
   * **여기도 막는 것과 여는 것을 양쪽에서 잰다** — 용어가 다시 새는지, 그리고 빈칸이
   * 채워지는지.
   */
  const verdictBasis: string[] = [
    ...Object.values(VERDICT_BASIS_METABOLISM),
    ...Object.values(VERDICT_BASIS_GAIN),
    ...Object.values(VERDICT_BASIS_APPROACH),
    ...Object.values(VERDICT_BASIS_MOVEMENT),
    ...Object.values(VERDICT_TIME_SLOT),
    VERDICT_BASIS_FOOD,
    VERDICT_BASIS_FOOD_EVEN,
  ];

  it("근거 줄이 명리 용어로 출처를 대지 않는다", () => {
    // 완료 기준의 목록 그대로다. 축 이름을 다시 붙이면 이 검사가 먼저 걸린다.
    for (const term of ["신강", "신약", "십신", "대사 기조", "걸리는 지점", "한열", "오행"]) {
      expect(verdictBasis.filter((line) => line.includes(term)), `${term} 는 명리 용어다`).toEqual(
        [],
      );
    }
  });

  it("근거 줄에 빈칸이 남지 않는다", () => {
    // 표가 문장을 통째로 들고 값만 끼우므로, 끼우는 함수가 빠지면 화면에 `{시간대}` 가 뜬다.
    for (const approach of Object.keys(VERDICT_BASIS_MOVEMENT) as DietApproach[]) {
      for (const thermal of Object.keys(VERDICT_TIME_SLOT) as ThermalTendency[]) {
        const line = verdictMovementBasis(approach, thermal);
        expect(line, `${approach}/${thermal}`).not.toMatch(/[{}]/);
      }
    }
    for (const element of OHAENG_LIST) {
      const line = verdictFoodBasis(element);
      expect(line, element).not.toMatch(/[{}]/);
      expect(line).toContain(ELEMENT_FOOD[element].basis);
    }
    expect(verdictFoodBasis(undefined)).toBe(VERDICT_BASIS_FOOD_EVEN);
  });

  /**
   * **본문과 같은 문장이 되지 않는다.** `DIET_APPROACH_NOTE` 는 프롬프트가 "풀어 쓰라" 고
   * 넘기는 값이라, 그대로 가져오면 카드와 본문 첫 문단이 같은 말을 한다.
   */
  it("근거 줄이 프롬프트로 나가는 문구를 그대로 쓰지 않는다", () => {
    const prompted = [
      ...Object.values(DIET_APPROACH_NOTE).flatMap((note) => [note.order, note.caution]),
      ...Object.values(METABOLISM_NOTE),
      ...Object.values(GAIN_PATTERN_NOTE),
      ...Object.values(MOVEMENT_PLAN).flatMap((plan) => [plan.how, plan.caution]),
      ...Object.values(THERMAL_GUIDE).map((guide) => guide.exercise),
    ];
    for (const line of verdictBasis) expect(prompted).not.toContain(line);
  });

  /**
   * 두 줄 예산 (390px · `text-sm` · 글 폭 191px · 2026-08-20 측정). 실측은 브라우저로
   * 하고 여기서는 **길이 상한**만 지킨다 — 지금 문구의 최댓값이 37자이고 축 값 조합
   * 29가지가 전부 두 줄에 들어갔다. **늘릴 때는 상한을 올리기 전에 다시 잰다.**
   */
  it("근거 줄이 두 줄 예산을 넘지 않는다", () => {
    const rendered = [
      ...Object.values(VERDICT_BASIS_METABOLISM),
      ...Object.values(VERDICT_BASIS_GAIN),
      ...Object.values(VERDICT_BASIS_APPROACH),
      ...(Object.keys(VERDICT_BASIS_MOVEMENT) as DietApproach[]).flatMap((approach) =>
        (Object.keys(VERDICT_TIME_SLOT) as ThermalTendency[]).map((thermal) =>
          verdictMovementBasis(approach, thermal),
        ),
      ),
      ...OHAENG_LIST.map((element) => verdictFoodBasis(element)),
      VERDICT_BASIS_FOOD_EVEN,
    ];
    for (const line of rendered) expect(line.length, line).toBeLessThanOrEqual(37);
  });

  /**
   * **여는 것이 실제로 열려 있는지도 본다** (TASK-40 이 세운 방식). 막는 것만 검사하면
   * 나중에 규칙을 조이면서 종목 이름이 조용히 빠져도 아무도 모른다 — 그러면 `exercise`
   * 유형의 콜아웃이 빈 채로 나간다.
   */
  it("대표 종목이 실제로 들어 있고 칸마다 다르다", () => {
    const primaries = Object.values(MOVEMENT_PLAN).map((plan) => plan.primary);
    expect(new Set(primaries).size).toBe(primaries.length);
    for (const plan of Object.values(MOVEMENT_PLAN)) {
      expect(plan.primary.length).toBeGreaterThan(1);
      expect(plan.alternatives.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("종목 이름에 기구·상표·프로그램 이름이 없다", () => {
    // 판정에 없는 것을 새로 들지 말라고 프롬프트가 막지만, 표 자체가 새면 소용없다.
    const names = Object.values(MOVEMENT_PLAN).flatMap((plan) => [plan.primary, ...plan.alternatives]);
    for (const word of ["필라테스", "크로스핏", "PT", "헬스장", "머신", "런닝머신", "러닝머신"]) {
      expect(names.filter((name) => name.includes(word)), `${word} 가 종목에 있다`).toEqual([]);
    }
  });

  it("사용자에게 나가는 문구에 아라비아 숫자가 없다", () => {
    expect(userFacing.filter((text) => /\d/.test(text))).toEqual([]);
  });

  /**
   * **한글로 쓴 수치도 같은 처방이다** (TASK-59). `식사 한 시간 뒤에` 는 `/\d/` 에 걸리지
   * 않지만 읽는 쪽에서는 `60분 뒤에` 와 다르지 않다.
   *
   * 수사만으로 막으면 오탐이 쏟아진다 — `한 가지씩 곁들이기` · `한 번에 강도를 올리면` ·
   * `한 끼에 몰아` 는 전부 정상 문구다. 그래서 **수사 + 측정 단위**가 붙은 것만 잡는다.
   * `가지`·`번`·`끼` 는 단위 목록에 넣지 않는다 (세는 말이지 재는 말이 아니다).
   */
  it("사용자에게 나가는 문구에 한글로 쓴 수치가 없다", () => {
    const NUMERAL = "한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|몇";
    const MEASURE = "시간|분|초|주|달|개월|해|킬로|킬로그램|그램|칼로리|잔|컵|세트|회";
    const written = new RegExp(`(?:^|[^가-힣])(?:${NUMERAL})\\s*(?:${MEASURE})(?![가-힣])`);
    expect(userFacing.filter((text) => written.test(text))).toEqual([]);
  });

  /**
   * **모델에게 금지한 어법을 근거 데이터가 쓰면 안 된다** (TASK-59).
   * `lib/prompt.ts` 의 `eating` 지침이 `"○○에 좋다", "○○를 돕는"` 을 효능 표현으로
   * 콕 집어 금지하는데, `FOCUS_GUIDE` 가 `소화를 돕는 움직임` 을 쓰고 있었다.
   *
   * **`돕는` 을 그냥 금지어 목록에 넣을 수 없다.** `METABOLISM_NOTE` 의
   * `일간을 돕는 힘` 은 명리 용어이고 `analysis.ts` 의 신강신약 문구도 같은 말을 쓴다 —
   * `견과`/`비견과 겁재` 오탐과 같은 함정이라, **명리 주어가 앞에 붙은 것만 빼고** 본다.
   */
  it("어느 문구도 효능 표현을 쓰지 않는다", () => {
    const EFFICACY: readonly [string, RegExp][] = [
      ["○○를 돕는", /(?<!일간을 )돕는/],
      ["○○에 좋다", /에 좋[다은게]/],
    ];
    for (const [label, pattern] of EFFICACY) {
      expect(userFacing.filter((text) => pattern.test(text)), `${label} 는 효능 표현이다`).toEqual(
        [],
      );
    }
  });

  /**
   * 막는 것만 검사하면 나중에 규칙을 조이면서 **조용히 다시 닫아 버려도 아무도 모른다.**
   * 그래서 무엇이 통과해야 하는지도 박아 둔다.
   */
  it("방법은 실제로 열려 있다 — 종류와 순서가 구체적으로 적혀 있다", () => {
    const kinds = Object.values(MOVEMENT_PLAN).map((plan) => plan.kind);
    // 네 가지 종류가 전부 쓰인다 (접근 순서 4칸에서 1:1 로 나온다)
    expect(new Set(kinds).size).toBe(4);

    for (const plan of Object.values(MOVEMENT_PLAN)) {
      expect(plan.how.length).toBeGreaterThan(20);
      expect(plan.caution.length).toBeGreaterThan(10);
    }
    for (const plan of Object.values(MEAL_PLAN)) {
      expect(plan.sequence.length).toBeGreaterThan(10);
      expect(plan.timing.length).toBeGreaterThan(10);
    }
  });

  /**
   * 실행 방법 표는 **순서와 시각의 규칙만** 정한다. 식품 이름은 `ELEMENT_FOOD` 가,
   * 조리·온도는 `THERMAL_GUIDE` 가 정한다 — 섞으면 목록 밖 식품이 이 표로 새어 나간다.
   */
  it("식사 순서 표에 식품 이름이 없다", () => {
    const foodNames = OHAENG_LIST.flatMap((element) => ELEMENT_FOOD[element].groups);
    const mealText = Object.values(MEAL_PLAN)
      .flatMap((plan) => [plan.sequence, plan.timing])
      .join(" ");
    expect(foodNames.filter((food) => mealText.includes(food))).toEqual([]);
  });

  /** 한열은 다른 층이다 — 실행 방법 표가 온도·성미를 말하기 시작하면 층이 무너진다. */
  it("실행 방법 표가 한열의 몫을 가져가지 않는다", () => {
    const text = [
      ...Object.values(MOVEMENT_PLAN).flatMap((plan) => [plan.how, plan.caution]),
      ...Object.values(MEAL_PLAN).flatMap((plan) => [plan.sequence, plan.timing]),
    ].join(" ");
    for (const word of ["온성", "냉성", "따뜻하게", "차갑게", "미지근"]) {
      expect(text, `${word} 는 한열(THERMAL_GUIDE) 몫이다`).not.toContain(word);
    }
  });

  /** 새 축이 새 동점을 만들지 않는지 — 같은 접근 순서면 항상 같은 종류여야 한다. */
  it("같은 접근 순서는 항상 같은 움직임 종류를 낸다", () => {
    const seen = new Map<string, string>();
    for (const chart of SWEEP) {
      const result = analyzeConstitution(inputFrom(chart));
      const previous = seen.get(result.dietApproach);
      if (previous) expect(result.movementKind).toBe(previous);
      else seen.set(result.dietApproach, result.movementKind);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("판정 결과에 장부 이름이 실려 나가지 않는다", () => {
    // 오행-장부 배속은 배속의 출처를 밝히는 주석일 뿐, 판정 결과로 내보내지 않는다.
    const organNames = OHAENG_LIST.map((element) => BODY_AXIS[element].classical);
    for (const chart of SWEEP) {
      const serialized = JSON.stringify(analyzeConstitution(inputFrom(chart)));
      for (const organ of organNames) {
        expect(serialized).not.toContain(organ);
      }
    }
  });
});
