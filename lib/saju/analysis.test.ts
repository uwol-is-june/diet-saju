import { describe, expect, it } from "vitest";
import {
  SEASONAL_MULTIPLIER,
  analyzeDaeun,
  analyzeOhaeng,
  analyzeSeun,
  analyzeStrength,
  daeunDirection,
  daeunStartAge,
  sexagenaryOfYear,
} from "./analysis";
import { ganjiToKorean, sexagenaryIndex, type GanjiIndex } from "./ganji";

/**
 * 이 파일은 고전 규칙과 우리 관례를 나눠 검증한다.
 * 관례(점수 배수·4단계 표현·대운수 반올림)는 값이 바뀔 수 있으므로
 * "상수와 일관되는가"를 보고, 고전 규칙은 문헌값 자체를 박아 둔다.
 */

// 1990-05-17 14:30 사주: 경오 신사 임오 정미
const CHART_1990 = {
  year: { gan: 6, ji: 6 } satisfies GanjiIndex, // 경오
  month: { gan: 7, ji: 5 } satisfies GanjiIndex, // 신사
  day: { gan: 8, ji: 6 } satisfies GanjiIndex, // 임오
  hour: { gan: 3, ji: 7 } satisfies GanjiIndex, // 정미
};

describe("오행 분석", () => {
  const pillars = [CHART_1990.year, CHART_1990.month, CHART_1990.day, CHART_1990.hour];

  it("개수 합은 기둥 수 × 2", () => {
    const result = analyzeOhaeng(pillars, CHART_1990.month.ji);
    const total = Object.values(result.count).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  it("경오 신사 임오 정미의 오행 개수", () => {
    const result = analyzeOhaeng(pillars, CHART_1990.month.ji);
    // 경(금) 오(화) 신(금) 사(화) 임(수) 오(화) 정(화) 미(토)
    expect(result.count).toEqual({ 목: 0, 화: 4, 토: 1, 금: 2, 수: 1 });
    expect(result.missing).toEqual(["목"]);
  });

  it("월지가 사(여름)이므로 화가 왕이다", () => {
    const result = analyzeOhaeng(pillars, CHART_1990.month.ji);
    expect(result.season).toBe("여름");
    expect(result.seasonalState.화).toBe("왕");
    expect(result.strongest).toBe("화");
  });

  it("점수는 개수 × 계절 배수와 일치한다 (우리 관례)", () => {
    const result = analyzeOhaeng(pillars, CHART_1990.month.ji);
    for (const element of ["목", "화", "토", "금", "수"] as const) {
      const expected =
        Math.round(result.count[element] * SEASONAL_MULTIPLIER[result.seasonalState[element]] * 100) /
        100;
      expect(result.score[element]).toBe(expected);
    }
  });

  it("개수가 0이면 점수도 0이다", () => {
    const result = analyzeOhaeng(pillars, CHART_1990.month.ji);
    expect(result.count.목).toBe(0);
    expect(result.score.목).toBe(0);
  });

  it("시주가 없으면 개수 합이 6", () => {
    const result = analyzeOhaeng(
      [CHART_1990.year, CHART_1990.month, CHART_1990.day],
      CHART_1990.month.ji,
    );
    const total = Object.values(result.count).reduce((a, b) => a + b, 0);
    expect(total).toBe(6);
  });
});

describe("신강 / 신약", () => {
  it("1990 사주는 신약이다", () => {
    // 일간 임(수). 월지 사(화→재성), 일지 오(화→재성) 이므로 득령·득지 모두 실패
    const result = analyzeStrength({ ilgan: 8, ...CHART_1990 });
    expect(result.deukryeong).toBe(false);
    expect(result.deukji).toBe(false);
    expect(result.verdict).toBe("신약");
  });

  it("판정은 3기준 충족 개수로만 결정된다 (우리 관례)", () => {
    const verdictByCount: Record<number, string> = {
      3: "신강",
      2: "약간 신강",
      1: "약간 신약",
      0: "신약",
    };

    // 일간 10종 × 월지 12종을 훑어 판정이 항상 개수와 일치하는지 본다
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let monthJi = 0; monthJi < 12; monthJi += 1) {
        const result = analyzeStrength({
          ilgan,
          year: CHART_1990.year,
          month: { gan: CHART_1990.month.gan, ji: monthJi },
          day: CHART_1990.day,
          hour: CHART_1990.hour,
        });
        const met = [result.deukryeong, result.deukji, result.deukse].filter(Boolean).length;
        expect(result.verdict).toBe(verdictByCount[met]);
      }
    }
  });

  it("돕는 글자 수가 전체를 넘지 않는다", () => {
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      const result = analyzeStrength({ ilgan, ...CHART_1990 });
      expect(result.supportingChars).toBeLessThanOrEqual(result.totalChars);
      expect(result.totalChars).toBe(7); // 일간 제외 7자
    }
  });

  it("시주가 없으면 판정 글자 수가 5", () => {
    const result = analyzeStrength({ ilgan: 8, ...CHART_1990, hour: null });
    expect(result.totalChars).toBe(5);
  });
});

describe("대운 방향 (고전 규칙)", () => {
  it("양남·음녀는 순행, 음남·양녀는 역행", () => {
    expect(daeunDirection(true, "male")).toBe("forward");
    expect(daeunDirection(false, "female")).toBe("forward");
    expect(daeunDirection(false, "male")).toBe("backward");
    expect(daeunDirection(true, "female")).toBe("backward");
  });
});

describe("대운수 (우리 관례: 일수 ÷ 3 반올림, 최소 1)", () => {
  it.each([
    [0, 1],
    [0.5, 1],
    [1, 1],
    [3, 1],
    [4.5, 2],
    [9, 3],
    [11.45, 4],
    [28, 9],
    [30, 10],
  ])("%f일 → %i세", (days, expected) => {
    expect(daeunStartAge(days)).toBe(expected);
  });
});

describe("대운 목록", () => {
  const monthSexagenary = sexagenaryIndex(CHART_1990.month); // 신사

  it("순행이면 월주에서 한 칸씩 나아간다", () => {
    const result = analyzeDaeun({
      ilgan: 8,
      monthSexagenary,
      direction: "forward",
      daysToJeol: 11.45,
      count: 8,
    });
    result.periods.forEach((period, i) => {
      const expected = ganjiToKorean({
        gan: (monthSexagenary + i + 1) % 10,
        ji: (monthSexagenary + i + 1) % 12,
      });
      expect(period.ganji).toBe(expected);
    });
  });

  it("역행이면 월주에서 한 칸씩 물러난다", () => {
    const result = analyzeDaeun({
      ilgan: 8,
      monthSexagenary,
      direction: "backward",
      daysToJeol: 11.45,
      count: 8,
    });
    // 신사(17)에서 역행 → 경진(16), 기묘(15) …
    expect(result.periods[0]!.ganji).toBe("경진");
    expect(result.periods[1]!.ganji).toBe("기묘");
    expect(result.periods[2]!.ganji).toBe("무인");
  });

  it("구간이 10년 단위로 빈틈없이 이어진다", () => {
    const result = analyzeDaeun({
      ilgan: 8,
      monthSexagenary,
      direction: "backward",
      daysToJeol: 11.45,
      count: 8,
    });
    expect(result.startAge).toBe(4);
    result.periods.forEach((period, i, all) => {
      expect(period.endAge - period.startAge).toBe(9);
      if (i > 0) expect(period.startAge).toBe(all[i - 1]!.endAge + 1);
    });
  });

  it("대운수 근거를 함께 내보낸다 (검산 가능하도록)", () => {
    const result = analyzeDaeun({
      ilgan: 8,
      monthSexagenary,
      direction: "forward",
      daysToJeol: 11.4567,
      });
    expect(result.daysToJeol).toBe(11.46);
    expect(result.startAge).toBe(daeunStartAge(11.4567));
  });

  it("각 대운에 천간·지지 십신이 붙는다", () => {
    const result = analyzeDaeun({
      ilgan: 8,
      monthSexagenary,
      direction: "backward",
      daysToJeol: 11.45,
    });
    for (const period of result.periods) {
      expect(period.sipsin).toBeTruthy();
      expect(period.jiSipsin).toBeTruthy();
      expect(period.ohaeng).toHaveLength(2);
    }
  });
});

describe("세운 (고전 규칙: (연도 − 4) mod 60)", () => {
  it("1984년은 갑자년", () => {
    expect(ganjiToKorean(sexagenaryOfYear(1984))).toBe("갑자");
  });

  it("주요 연도 간지", () => {
    expect(ganjiToKorean(sexagenaryOfYear(1990))).toBe("경오");
    expect(ganjiToKorean(sexagenaryOfYear(2026))).toBe("병오");
    expect(ganjiToKorean(sexagenaryOfYear(2044))).toBe("갑자"); // 60년 주기
  });

  it("60년 주기로 순환한다", () => {
    for (let year = 1900; year <= 2040; year += 7) {
      expect(sexagenaryOfYear(year)).toEqual(sexagenaryOfYear(year + 60));
    }
  });

  it("기준 연도부터 지정 개수만큼 낸다", () => {
    const result = analyzeSeun({ ilgan: 8, birthYear: 1990, fromYear: 2026, count: 3 });
    expect(result.map((y) => y.year)).toEqual([2026, 2027, 2028]);
    expect(result.map((y) => y.ganji)).toEqual(["병오", "정미", "무신"]);
  });

  it("나이는 세는나이 (출생년 = 1세)", () => {
    const result = analyzeSeun({ ilgan: 8, birthYear: 1990, fromYear: 2026, count: 1 });
    expect(result[0]!.age).toBe(2026 - 1990 + 1);
  });

  it("해당 나이의 대운을 찾아 붙인다", () => {
    const daeun = analyzeDaeun({
      ilgan: 8,
      monthSexagenary: sexagenaryIndex(CHART_1990.month),
      direction: "backward",
      daysToJeol: 11.45,
    });
    const result = analyzeSeun({
      ilgan: 8,
      birthYear: 1990,
      fromYear: 2026,
      count: 3,
      daeun,
    });
    for (const year of result) {
      const period = daeun.periods.find((p) => year.age >= p.startAge && year.age <= p.endAge);
      expect(year.daeunGanji).toBe(period?.ganji ?? null);
    }
  });

  it("대운을 주지 않으면 daeunGanji 는 null", () => {
    const result = analyzeSeun({ ilgan: 8, birthYear: 1990, fromYear: 2026, count: 2 });
    expect(result.every((y) => y.daeunGanji === null)).toBe(true);
  });
});
