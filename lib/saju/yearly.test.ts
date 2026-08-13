import { describe, expect, it } from "vitest";
import { analyzeOhaeng, analyzeSeun, analyzeStrength, sexagenaryOfYear } from "./analysis";
import { analyzeConstitution } from "./constitution";
import { SIPSIN_GROUPS, fromSexagenary, ganjiToKorean, type GanjiIndex } from "./ganji";
import {
  EFFECT_NOTE,
  THEME_LABEL,
  THEME_NOTE,
  analyzeYearly,
  type YearlyInput,
} from "./yearly";

/**
 * 올해 운세 판정 검증 (TASK-15).
 *
 * 완료 기준은 체질 판정과 같다 — **같은 사주·같은 연도면 항상 같은 판정.**
 * 여기서 보는 것:
 *  1. 결정론과 상수 일관성
 *  2. 작용 판정이 오행 과부족에서 규칙대로 나오는가
 *  3. 문구가 단정적 예언으로 읽히지 않는가
 */

// 1990-05-17 14:30: 경오 신사 임오 정미 (다른 테스트와 같은 표본)
const CHART_1990 = {
  year: { gan: 6, ji: 6 } satisfies GanjiIndex,
  month: { gan: 7, ji: 5 } satisfies GanjiIndex,
  day: { gan: 8, ji: 6 } satisfies GanjiIndex,
  hour: { gan: 3, ji: 7 } satisfies GanjiIndex,
};

function inputFor(referenceYear: number, chart = CHART_1990): YearlyInput {
  const pillars = [chart.year, chart.month, chart.day, chart.hour];
  const ilgan = chart.day.gan;
  const ohaeng = analyzeOhaeng(pillars, chart.month.ji);
  const strength = analyzeStrength({ ilgan, ...chart });
  const constitution = analyzeConstitution({ ilgan, ...chart, ohaeng, strength });
  const seun = analyzeSeun({ ilgan, birthYear: 1990, fromYear: referenceYear, count: 1 });
  const ganji = sexagenaryOfYear(referenceYear);
  return { seun: seun[0]!, gan: ganji.gan, ji: ganji.ji, constitution };
}

/** 재현 가능한 연도 범위 — 60갑자가 한 바퀴 돈다 */
const YEARS = Array.from({ length: 60 }, (_, index) => 2000 + index);

describe("결정론 — 완료 기준", () => {
  it("같은 사주·같은 연도는 항상 같은 판정이다", () => {
    for (const year of YEARS) {
      const input = inputFor(year);
      expect(analyzeYearly(input)).toEqual(analyzeYearly(input));
    }
  });

  it("60년 전 구간에서 예외 없이 판정된다", () => {
    for (const year of YEARS) {
      const result = analyzeYearly(inputFor(year));
      expect(EFFECT_NOTE[result.effect]).toBe(result.effectNote);
      expect(THEME_NOTE[result.theme]).toBe(result.themeNote);
      expect(THEME_LABEL[result.theme]).toBe(result.themeLabel);
      expect(SIPSIN_GROUPS).toContain(result.theme);
    }
  });

  it("세운 간지가 고전 규칙((연도 − 4) mod 60)과 일치한다", () => {
    for (const year of YEARS) {
      const result = analyzeYearly(inputFor(year));
      expect(result.year).toBe(year);
      expect(result.ganji).toBe(ganjiToKorean(sexagenaryOfYear(year)));
    }
  });
});

describe("작용 판정 (보완 / 가중 / 중립)", () => {
  // 1990 사주: 화 과다 / 목·수 부족 (constitution.test.ts 에서 고정한 값)
  it("부족 오행이 들어오는 해는 보완이다", () => {
    // 2008년 무자 — 무(토) 자(수). 수가 부족 오행이다.
    const result = analyzeYearly(inputFor(2008));
    expect(result.ganji).toBe("무자");
    expect(result.fills).toContain("수");
    expect(result.effect).toBe("보완");
  });

  it("과다 오행이 들어오는 해는 가중이다", () => {
    // 2026년 병오 — 병(화) 오(화). 화가 과다 오행이다.
    const result = analyzeYearly(inputFor(2026));
    expect(result.ganji).toBe("병오");
    expect(result.ohaeng).toEqual(["화"]);
    expect(result.piles).toEqual(["화"]);
    expect(result.effect).toBe("가중");
  });

  it("어느 쪽도 건드리지 않으면 중립이다", () => {
    // 2029년 기유 — 기(토) 유(금). 둘 다 적정이다.
    const result = analyzeYearly(inputFor(2029));
    expect(result.ganji).toBe("기유");
    expect(result.fills).toEqual([]);
    expect(result.piles).toEqual([]);
    expect(result.effect).toBe("중립");
  });

  it("판정이 항상 fills·piles 개수 비교와 일치한다", () => {
    for (const year of YEARS) {
      const result = analyzeYearly(inputFor(year));
      const expected =
        result.fills.length > result.piles.length
          ? "보완"
          : result.piles.length > result.fills.length
            ? "가중"
            : "중립";
      expect(result.effect, `${year}년`).toBe(expected);
    }
  });

  it("같은 오행이 천간·지지에 겹치면 한 번만 센다", () => {
    // 병오는 둘 다 화다. 한 해의 성격은 하나이므로 중복 계산하지 않는다.
    expect(analyzeYearly(inputFor(2026)).ohaeng.length).toBe(1);
  });

  it("fills·piles 는 원국의 부족·과다 목록 안에서만 나온다", () => {
    for (const year of YEARS) {
      const input = inputFor(year);
      const result = analyzeYearly(input);
      for (const element of result.fills) {
        expect(input.constitution.deficient).toContain(element);
      }
      for (const element of result.piles) {
        expect(input.constitution.excess).toContain(element);
      }
    }
  });
});

describe("올해의 주제", () => {
  it("세운 천간의 십신 그룹에서 나온다", () => {
    for (const year of YEARS) {
      const input = inputFor(year);
      const result = analyzeYearly(input);
      expect(result.sipsin).toBe(input.seun.sipsin);
      expect(SIPSIN_GROUPS).toContain(result.theme);
    }
  });

  it("다섯 주제가 60년 안에서 모두 나온다", () => {
    // 한쪽으로 몰리면 매핑이 사실상 죽은 것이다.
    const seen = new Set(YEARS.map((year) => analyzeYearly(inputFor(year)).theme));
    expect(seen.size).toBe(5);
  });

  it("성별 미지정이면 대운 간지가 null 이다", () => {
    // 대운 없이 세운만으로도 판정이 나와야 한다.
    const result = analyzeYearly(inputFor(2026));
    expect(result.daeunGanji).toBeNull();
    expect(result.effect).toBeDefined();
    expect(result.theme).toBeDefined();
  });
});

describe("표현 가이드 — 단정적 예언을 하지 않는다", () => {
  /**
   * 면책 고지가 "확정된 사실이나 미래 예측으로 받아들이지 마세요" 라고 약속한다.
   * 사용자에게 인용될 수 있는 문구에 사건 예고나 단정 어휘가 들어가면 그 약속이 깨진다.
   */
  const BANNED = [
    "반드시", "틀림없이", "확실히", "보장", "분명히",
    "대박", "횡재", "사고", "이혼", "질병", "죽음", "실패한다", "성공한다",
    "돈이 들어온다", "합격", "당첨", "투자",
  ];

  const userFacing = [...Object.values(EFFECT_NOTE), ...Object.values(THEME_NOTE)];

  it("문구 표가 비어 있지 않다", () => {
    expect(userFacing.length).toBe(3 + 5);
  });

  it.each(BANNED)("어느 문구에도 %s 가 없다", (word) => {
    expect(userFacing.filter((text) => text.includes(word))).toEqual([]);
  });

  it("주제 라벨은 사건이 아니라 결로 되어 있다", () => {
    expect(Object.values(THEME_LABEL)).toEqual([
      "경쟁과 독립",
      "표현과 생산",
      "활동과 결실",
      "책임과 압박",
      "학습과 정비",
    ]);
  });
});

describe("다른 원국에서도 규칙이 유지된다", () => {
  it("60갑자를 훑은 원국들에서 세 작용이 모두 나온다", () => {
    const effects = new Set<string>();
    for (let index = 0; index < 60; index += 1) {
      const chart = {
        year: fromSexagenary(index),
        month: fromSexagenary((index * 7 + 3) % 60),
        day: fromSexagenary((index * 13 + 11) % 60),
        hour: fromSexagenary((index * 29 + 41) % 60),
      };
      effects.add(analyzeYearly(inputFor(2026, chart)).effect);
    }
    expect([...effects].sort()).toEqual(["가중", "보완", "중립"]);
  });
});
