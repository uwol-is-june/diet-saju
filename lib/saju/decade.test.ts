import { describe, expect, it } from "vitest";
import { analyzeDaeun, type DaeunAnalysis } from "./analysis";
import {
  DECADE_EFFECT_NOTE,
  SHIFT_NOTE,
  analyzeDecade,
  findCurrentDaeun,
  findCurrentDaeunIndex,
} from "./decade";
import { EFFECT_NOTE } from "./yearly";
import { calculateSajuChart } from "./pillars";
import { sajuInputSchema, type SajuInput } from "./schema";

/**
 * 대운 판정 검증 (TASK-45).
 *
 * 보는 것은 셋이다.
 *  1. **결정론** — 같은 사주·같은 성별·같은 나이면 언제나 같은 판정. 완료 기준이 이것이다.
 *  2. **성별 미지정이면 성립하지 않는다** — 순행을 임의로 정하지 않는다.
 *  3. **문구가 사건을 예고하지 않는다** — `yearly.test.ts` 와 같은 방식.
 */

const FIXED_NOW = { now: new Date("2026-08-13T00:00:00Z") };

function chartFor(patch: Partial<SajuInput> & { birthDate: string }) {
  return calculateSajuChart(sajuInputSchema.parse(patch), FIXED_NOW);
}

describe("현재 대운 찾기 — 한 곳에서만 정한다", () => {
  const daeun = analyzeDaeun({
    ilgan: 0,
    monthSexagenary: 10,
    direction: "forward",
    daysToJeol: 9,
  });

  it("나이가 구간 안이면 그 구간을 찾는다", () => {
    const period = daeun.periods[2]!;
    expect(findCurrentDaeun(daeun, period.startAge)?.ganji).toBe(period.ganji);
    expect(findCurrentDaeun(daeun, period.endAge)?.ganji).toBe(period.ganji);
  });

  it("첫 대운 전이면 없다", () => {
    // 대운수 이전 나이는 어느 구간에도 들지 않는다. 임의로 첫 구간에 넣지 않는다.
    expect(findCurrentDaeunIndex(daeun, daeun.startAge - 1)).toBe(-1);
  });

  it("대운이 없거나 나이를 모르면 없다", () => {
    expect(findCurrentDaeunIndex(null, 30)).toBe(-1);
    expect(findCurrentDaeunIndex(daeun, undefined)).toBe(-1);
  });
});

describe("판정은 결정론적이다", () => {
  it("같은 입력이면 언제나 같은 판정", () => {
    const input = { birthDate: "1990-05-17", birthTime: "14:30", gender: "female" } as const;
    const a = chartFor({ ...input });
    const b = chartFor({ ...input });
    expect(a.decade).toEqual(b.decade);
    expect(a.decade).not.toBeNull();
  });

  it("성별이 다르면 대운 방향이 달라 판정도 갈릴 수 있다", () => {
    // 순행/역행이 성별로 정해지므로 같은 생일이어도 다른 구간을 지난다.
    const female = chartFor({ birthDate: "1990-05-17", birthTime: "14:30", gender: "female" });
    const male = chartFor({ birthDate: "1990-05-17", birthTime: "14:30", gender: "male" });
    expect(female.decade?.current.ganji).not.toBe(male.decade?.current.ganji);
  });

  it("성별 미지정이면 null 이다 — 순행을 임의로 정하지 않는다", () => {
    const chart = chartFor({ birthDate: "1990-05-17", birthTime: "14:30" });
    expect(chart.daeun).toBeNull();
    expect(chart.decade).toBeNull();
  });
});

describe("작용 판정 — 세운과 같은 규칙", () => {
  const constitution = { deficient: ["금"], excess: ["화"] } as never;

  function daeunWith(gan: number, ji: number): DaeunAnalysis {
    return {
      direction: "forward",
      startAge: 5,
      daysToJeol: 9,
      periods: [
        { startAge: 5, endAge: 14, ganji: "이전", ohaeng: "", gan, ji, sipsin: "비견", jiSipsin: "비견" },
        { startAge: 15, endAge: 24, ganji: "지금", ohaeng: "", gan, ji, sipsin: "비견", jiSipsin: "비견" },
      ],
    };
  }

  it("부족을 채우면 보완", () => {
    // 경(6)·신(7)은 둘 다 금이다.
    const result = analyzeDecade({ daeun: daeunWith(6, 9), currentAge: 20, constitution });
    expect(result?.current.effect).toBe("보완");
    expect(result?.current.fills).toContain("금");
  });

  it("과다에 더하면 가중", () => {
    // 병(2)·오(6)는 둘 다 화다.
    const result = analyzeDecade({ daeun: daeunWith(2, 6), currentAge: 20, constitution });
    expect(result?.current.effect).toBe("가중");
    expect(result?.current.piles).toContain("화");
  });

  it("어느 쪽도 건드리지 않으면 중립", () => {
    // 갑(0)·인(2)은 둘 다 목이다.
    const result = analyzeDecade({ daeun: daeunWith(0, 2), currentAge: 20, constitution });
    expect(result?.current.effect).toBe("중립");
  });

  it("첫 대운을 지나는 중이면 직전 구간이 없다", () => {
    const result = analyzeDecade({ daeun: daeunWith(0, 2), currentAge: 10, constitution });
    expect(result?.previous).toBeNull();
    expect(result?.shift).toBeNull();
  });

  it("직전과 작용이 같으면 유지다 — 동점 처리가 따로 없다", () => {
    // 두 구간의 간지를 같게 만들었으므로 작용이 같다.
    const result = analyzeDecade({ daeun: daeunWith(0, 2), currentAge: 20, constitution });
    expect(result?.shift).toBe("유지");
  });
});

/**
 * 10년 단위 이야기는 **미래 예측으로 읽히기 가장 쉽다.** 그래서 `yearly.ts` 문구보다
 * 오히려 더 엄격하게 본다 — 시기를 특정하는 낱말까지 함께 막는다.
 */
describe("표현 가이드 — 단정적 예언을 하지 않는다", () => {
  const BANNED = [
    "반드시", "틀림없이", "확실히", "보장", "분명히",
    "대박", "횡재", "사고", "이혼", "질병", "죽음", "실패한다", "성공한다",
    "돈이 들어온다", "합격", "당첨", "투자",
    // 시기 특정 — 이 유형만의 위험이다
    "몇 살", "언제부터", "내년", "앞으로 몇",
  ];

  const userFacing = [...Object.values(DECADE_EFFECT_NOTE), ...Object.values(SHIFT_NOTE)];

  it("문구 표가 비어 있지 않다", () => {
    expect(userFacing.length).toBe(3 + 4);
  });

  it.each(BANNED)("어느 문구에도 %s 가 없다", (word) => {
    expect(userFacing.filter((text) => text.includes(word))).toEqual([]);
  });

  it("세운 문구를 그대로 쓰지 않는다", () => {
    // 층이 다르다 — 세운은 한 해를 어떻게 보낼지, 대운은 10년의 기본값이 어디로 기울었는지.
    // 같은 문장을 쓰면 `diet` 의 "올해의 몸 흐름" 과 이 유형이 같은 말을 한다.
    for (const [effect, note] of Object.entries(DECADE_EFFECT_NOTE)) {
      expect(note).not.toBe(EFFECT_NOTE[effect as keyof typeof EFFECT_NOTE]);
    }
  });

  it("직전과 견준 흐름은 사건이 아니라 상태로 되어 있다", () => {
    expect(Object.keys(SHIFT_NOTE)).toEqual(["완화", "심화", "전환", "유지"]);
  });
});

describe("다른 원국에서도 규칙이 유지된다", () => {
  it("여러 생일에서 세 작용이 모두 나온다", () => {
    const effects = new Set<string>();
    for (let year = 1960; year <= 2005; year += 1) {
      const chart = chartFor({
        birthDate: `${year}-03-11`,
        birthTime: "09:20",
        gender: year % 2 === 0 ? "male" : "female",
      });
      if (chart.decade) effects.add(chart.decade.current.effect);
    }
    expect(effects).toEqual(new Set(["보완", "가중", "중립"]));
  });
});
