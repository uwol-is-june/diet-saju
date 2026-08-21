import { describe, expect, it } from "vitest";
import { verdictOf } from "../reading/verdict";
import { calculateSajuChart } from "../saju/pillars";
import { READING_TYPES, sajuInputSchema, type SajuInput } from "../saju/schema";
import { buildShareCardModel } from "./card-model";

/**
 * 공유 카드 모델 검증 (TASK-10 · 116).
 *
 * 가장 중요한 검사는 **생년월일이 카드에 실리지 않는다** 는 것이다. 이 이미지는 사용자가
 * 공개된 곳에 올리려고 만드는 것이라, 우리가 날짜를 찍어 주면 그대로 퍼진다.
 *
 * **기준은 날짜 문자열이 아니라 역산 가능성이다** (TASK-116). 예전 검사는 `1990`·`14:30` 만
 * 봤는데, 그동안 카드는 사주팔자 네 기둥을 통째로 싣고 있었다 — 연·월·일·시주가 정해지면
 * 60년 주기 안에서 생년월일시가 거의 유일하게 특정된다. 그래서 **간지 검사가 여기 있다.**
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

describe("카드에서 생년월일을 되짚을 수 없다", () => {
  it.each(READING_TYPES)("%s 모델에 날짜 문자열이 없다", (type) => {
    const serialized = JSON.stringify(buildShareCardModel(chart, type));
    expect(serialized).not.toContain(chart.solarDate);
    expect(serialized).not.toContain(chart.lunarDate);
    expect(serialized).not.toContain("1990");
    expect(serialized).not.toContain("14:30");
  });

  /**
   * **간지를 한 자도 싣지 않는다.** 네 기둥이 있으면 날짜가 특정되고, 대운 간지는 거기에
   * 나이 구간까지 좁힌다. 시각 미상 원국까지 함께 보는 이유는 그쪽이 기둥 셋이라
   * "덜 위험해 보이는" 경로이기 때문이다 — 셋만으로도 후보가 크게 줄어든다.
   */
  it.each(READING_TYPES)("%s 모델에 간지가 없다", (type) => {
    for (const source of [chart, chartNoTime]) {
      const serialized = JSON.stringify(buildShareCardModel(source, type));
      const ganji = [
        source.year.ganji,
        source.month.ganji,
        source.day.ganji,
        source.hour?.ganji,
        source.decade?.current.ganji,
        source.seun[0]?.ganji,
      ].filter((value): value is string => Boolean(value));

      for (const value of ganji) {
        expect(serialized, `${value} 가 카드에 실렸다`).not.toContain(value);
      }
    }
  });

  it("풀이 본문도 넣지 않는다", () => {
    // 카드에 들어가는 것은 판정 한 줄과 오행 막대뿐이다. 모델이 받는 인자에 풀이가 없다.
    const model = buildShareCardModel(chart, "diet");
    expect(Object.keys(model).sort()).toEqual([
      "badges",
      "basis",
      "eyebrow",
      "footer",
      "headline",
      "label",
      "photo",
    ]);
  });

  it("나이를 넣지 않는다", () => {
    // 대운 구간을 나이로 적으면 출생 연도가 좁혀진다.
    for (const type of READING_TYPES) {
      const model = buildShareCardModel(chart, type);
      for (const text of [model.eyebrow, model.label, model.basis, model.headline]) {
        expect(text, text).not.toMatch(/\d+\s*세/);
        expect(text, text).not.toMatch(/\d{4}/);
      }
    }
  });
});

describe("카드는 화면 콜아웃과 같은 값을 쓴다", () => {
  /**
   * 표가 두 벌이 되면 **저장된 이미지가 방금 본 화면과 다른 말을 한다.** 카드가 값을
   * 스스로 고르지 않고 `lib/reading/verdict.ts` 를 부르는지 여기서 본다.
   */
  it.each(READING_TYPES)("%s 의 눈썹·라벨·근거·사진이 콜아웃과 같다", (type) => {
    const model = buildShareCardModel(chart, type);
    const callout = verdictOf(chart, type);
    expect(callout).not.toBeNull();
    expect(model.eyebrow).toBe(callout!.eyebrow);
    expect(model.label).toBe(callout!.label);
    expect(model.basis).toBe(callout!.basis);
    expect(model.photo).toBe(callout!.photo);
  });

  it("유형마다 라벨이 서로 다르다", () => {
    // 전부 같으면 분기가 죽은 것이다.
    const labels = READING_TYPES.map((type) => buildShareCardModel(chart, type).label);
    expect(new Set(labels).size).toBe(READING_TYPES.length);
  });

  it("공개 유형에는 사진이 있고 내부 유형에는 없다", () => {
    // 사진이 없는 쪽은 연한 면으로 그린다 (`draw-card.ts`). 갈리는 지점은 이 값 하나뿐이다.
    for (const type of ["diet", "gain-cause", "diet-method", "diet-food", "exercise"] as const) {
      expect(buildShareCardModel(chart, type).photo, type).toBeTruthy();
    }
    expect(buildShareCardModel(chart, "general").photo).toBeNull();
  });
});

describe("오행 배지", () => {
  it("다섯 개가 목화토금수 순서로 나온다", () => {
    const model = buildShareCardModel(chart, "diet");
    expect(model.badges.map((b) => b.element)).toEqual(["목", "화", "토", "금", "수"]);
  });

  it("개수와 계절 기세가 원국과 일치한다", () => {
    const model = buildShareCardModel(chart, "diet");
    const maxScore = Math.max(...Object.values(chart.ohaeng.score));
    for (const badge of model.badges) {
      const key = badge.element as keyof typeof chart.ohaeng.count;
      expect(badge.count).toBe(chart.ohaeng.count[key]);
      expect(badge.state).toBe(chart.ohaeng.seasonalState[key]);
      // 세력 막대 길이 (TASK-25). 화면 막대와 같은 근거를 쓴다.
      expect(badge.weight).toBeCloseTo(chart.ohaeng.score[key] / maxScore, 6);
      expect(badge.weight).toBeGreaterThanOrEqual(0);
      expect(badge.weight).toBeLessThanOrEqual(1);
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
