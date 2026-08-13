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
  GAIN_PATTERN_NOTE,
  METABOLISM_NOTE,
  THERMAL_GUIDE,
  analyzeConstitution,
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
    const groups = OHAENG_LIST.flatMap((element) => [...ELEMENT_FOOD[element].groups]);
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
    ...Object.values(DIET_APPROACH_NOTE).flatMap((note) => [note.order, note.caution]),
    // 재료 범주 (TASK-27) — 사용자에게 그대로 인용되는 식품 이름이다
    ...OHAENG_LIST.flatMap((element) => [
      ELEMENT_FOOD[element].basis,
      ...ELEMENT_FOOD[element].groups,
    ]),
    ...Object.values(FOOD_HOW),
  ];

  it("문구 표가 비어 있지 않다", () => {
    // 위 수집이 깨져 빈 배열이 되면 아래 검사가 통과해 버린다.
    expect(userFacing.length).toBe(5 + 30 + 15 + 2 + 5 + 8 + 20 + 2);
  });

  it.each(BANNED)("어느 문구에도 %s 가 없다", (word) => {
    const offenders = userFacing.filter((text) => text.includes(word));
    expect(offenders).toEqual([]);
  });

  it.each(BANNED_PRESCRIPTION)("어느 문구에도 %s 가 없다 (처방 금지)", (word) => {
    const offenders = userFacing.filter((text) => text.includes(word));
    expect(offenders).toEqual([]);
  });

  it("숫자를 목표로 제시하지 않는다", () => {
    // "3kg", "1,200칼로리", "2주" 같은 수치가 섞이면 처방으로 읽힌다.
    // 접근 순서 문구는 순서와 습관만 말한다.
    for (const note of Object.values(DIET_APPROACH_NOTE)) {
      expect(note.order).not.toMatch(/\d/);
      expect(note.caution).not.toMatch(/\d/);
    }
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
