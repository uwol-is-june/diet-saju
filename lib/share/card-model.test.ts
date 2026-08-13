import { describe, expect, it } from "vitest";
import { calculateSajuChart } from "../saju/pillars";
import { sajuInputSchema, type SajuInput } from "../saju/schema";
import { buildShareCardModel } from "./card-model";

/**
 * 공유 카드 모델 검증 (TASK-10).
 *
 * 가장 중요한 검사는 **생년월일이 카드에 실리지 않는다** 는 것이다. 이 이미지는 사용자가
 * 공개된 곳에 올리려고 만드는 것이라, 우리가 날짜를 찍어 주면 그대로 퍼진다.
 */

const FIXED_NOW = { now: new Date("2026-08-13T00:00:00Z") };

function makeInput(partial: Partial<SajuInput> & { birthDate: string }): SajuInput {
  return sajuInputSchema.parse(partial);
}

const WITH_TIME = makeInput({
  birthDate: "1990-05-17",
  birthTime: "14:30",
  gender: "female",
});
const NO_TIME = makeInput({ birthDate: "1990-05-17", gender: "female" });

const chart = calculateSajuChart(WITH_TIME, FIXED_NOW);
const chartNoTime = calculateSajuChart(NO_TIME, FIXED_NOW);

describe("카드에 생년월일을 넣지 않는다", () => {
  it.each(["general", "diet"] as const)("%s 모델에 날짜 문자열이 없다", (type) => {
    const serialized = JSON.stringify(buildShareCardModel(chart, type));
    expect(serialized).not.toContain(chart.solarDate);
    expect(serialized).not.toContain(chart.lunarDate);
    expect(serialized).not.toContain("1990");
    expect(serialized).not.toContain("14:30");
  });

  it("풀이 본문도 넣지 않는다", () => {
    // 카드에 들어가는 것은 원국과 판정뿐이다. 모델이 받는 인자에 풀이 자체가 없다.
    const model = buildShareCardModel(chart, "diet");
    expect(Object.keys(model).sort()).toEqual([
      "badges",
      "chips",
      "footer",
      "headline",
      "notes",
      "pillars",
      "typeLabel",
    ]);
  });

  it("근거 줄에 나이를 넣지 않는다", () => {
    // 대운 구간을 나이로 적으면 출생 연도가 좁혀진다.
    for (const type of ["general", "diet"] as const) {
      for (const note of buildShareCardModel(chart, type).notes) {
        expect(note, note).not.toMatch(/\d+\s*세/);
        expect(note, note).not.toMatch(/\d{4}/);
      }
    }
  });
});

describe("근거 줄", () => {
  it("신강·신약 3기준을 ○× 로 밝힌다", () => {
    const [first] = buildShareCardModel(chart, "diet").notes;
    expect(first).toContain(chart.strength.verdict);
    expect(first).toContain(chart.strength.deukryeong ? "득령 ○" : "득령 ×");
    expect(first).toContain(chart.strength.deukji ? "득지 ○" : "득지 ×");
    expect(first).toContain(chart.strength.deukse ? "득세 ○" : "득세 ×");
  });

  it("대운이 있으면 현재 대운을 간지·십신으로 쓴다", () => {
    const notes = buildShareCardModel(chart, "diet").notes;
    const daeunNote = notes.find((note) => note.startsWith("현재 대운"));
    expect(daeunNote).toBeDefined();
    const currentGanji = chart.seun[0]!.daeunGanji;
    expect(daeunNote).toContain(currentGanji!);
  });

  it("성별 미지정이면 대운 줄을 빼고 나머지만 쓴다", () => {
    // 대운은 순행·역행을 정할 수 없어 null 이다. 빈 줄을 남기지 않는다.
    const noGender = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "14:30" }),
      FIXED_NOW,
    );
    expect(noGender.daeun).toBeNull();
    const notes = buildShareCardModel(noGender, "diet").notes;
    expect(notes.some((note) => note.startsWith("현재 대운"))).toBe(false);
    expect(notes.length).toBe(2);
    expect(notes.every((note) => note.length > 0)).toBe(true);
  });

  it("diet 는 대사 기조를, general 은 계절 기세를 덧붙인다", () => {
    expect(buildShareCardModel(chart, "diet").notes).toContain(
      `대사 기조 ${chart.constitution.metabolism}`,
    );
    expect(buildShareCardModel(chart, "general").notes.at(-1)).toContain(chart.ohaeng.season);
  });
});

describe("4기둥", () => {
  it("연·월·일·시 순서로 네 칸이다", () => {
    const model = buildShareCardModel(chart, "diet");
    expect(model.pillars.map((p) => p.label)).toEqual(["연주", "월주", "일주", "시주"]);
    expect(model.pillars.map((p) => p.ganji)).toEqual([
      chart.year.ganji,
      chart.month.ganji,
      chart.day.ganji,
      chart.hour!.ganji,
    ]);
  });

  it("시각 미상이면 시주를 임의로 채우지 않는다", () => {
    const model = buildShareCardModel(chartNoTime, "diet");
    const hour = model.pillars[3]!;
    expect(hour.ganji).toBe("미상");
    expect(hour.sipsin).toBe("");
  });
});

describe("오행 배지", () => {
  it("다섯 개가 목화토금수 순서로 나온다", () => {
    const model = buildShareCardModel(chart, "diet");
    expect(model.badges.map((b) => b.element)).toEqual(["목", "화", "토", "금", "수"]);
  });

  it("개수와 계절 기세가 원국과 일치한다", () => {
    const model = buildShareCardModel(chart, "diet");
    for (const badge of model.badges) {
      const key = badge.element as keyof typeof chart.ohaeng.count;
      expect(badge.count).toBe(chart.ohaeng.count[key]);
      expect(badge.state).toBe(chart.ohaeng.seasonalState[key]);
    }
  });
});

describe("유형별 판정 칩", () => {
  it("diet 는 한열과 살이 붙는 패턴을 쓴다", () => {
    const model = buildShareCardModel(chart, "diet");
    expect(model.typeLabel).toBe("체질·다이어트 풀이");
    expect(model.chips).toEqual([
      `한열 ${chart.constitution.thermal}`,
      chart.constitution.gainPattern,
    ]);
  });

  it("general 은 최강 오행과 신강신약을 쓴다", () => {
    const model = buildShareCardModel(chart, "general");
    expect(model.typeLabel).toBe("종합 사주 풀이");
    expect(model.chips).toEqual([
      `${chart.ohaeng.strongest} 기운이 강함`,
      chart.strength.verdict,
    ]);
  });

  it("칩은 항상 두 개다 (카드 폭이 정해져 있다)", () => {
    for (const type of ["general", "diet"] as const) {
      expect(buildShareCardModel(chart, type).chips.length).toBe(2);
    }
  });
});

describe("머리말과 꼬리말", () => {
  it("띠와 계절만 밝힌다", () => {
    const model = buildShareCardModel(chart, "diet");
    expect(model.headline).toContain(chart.saencho);
    expect(model.headline).toContain(chart.ohaeng.season);
  });

  it("꼬리말에 서비스 주소가 있다", () => {
    expect(buildShareCardModel(chart, "diet").footer).toBe("diet-saju.vercel.app");
  });
});
