import { describe, expect, it } from "vitest";
import { analyzeOhaeng, analyzeStrength, type OhaengAnalysis } from "./analysis";
import {
  BODY_AXIS,
  DEFICIENT_RATIO,
  EXCESS_RATIO,
  FOCUS_GUIDE,
  GAIN_PATTERN_NOTE,
  METABOLISM_NOTE,
  THERMAL_GUIDE,
  analyzeConstitution,
  type ConstitutionInput,
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
  ];

  it("문구 표가 비어 있지 않다", () => {
    // 위 수집이 깨져 빈 배열이 되면 아래 검사가 통과해 버린다.
    expect(userFacing.length).toBe(5 + 30 + 15 + 2 + 5);
  });

  it.each(BANNED)("어느 문구에도 %s 가 없다", (word) => {
    const offenders = userFacing.filter((text) => text.includes(word));
    expect(offenders).toEqual([]);
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
