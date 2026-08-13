import { describe, expect, it } from "vitest";
import { calculateSajuChart } from "../saju/pillars";
import { sajuInputSchema } from "../saju/schema";
import { composeBirthTime, HOUR_OPTIONS, MINUTE_OPTIONS } from "./birth-time";

/**
 * 시각 드롭다운 계약 (TASK-23).
 *
 * 지키려는 것 두 가지
 *  1. **분 단위 정보가 보존된다** — 눌러서 고르는 UI 로 바꾸면서 정밀도를 잃지 않는다
 *  2. 조립한 값이 서버 계약(`sajuInputSchema.birthTime`)을 그대로 통과한다
 */

describe("시 선택지", () => {
  it("0~23 시가 모두 있다", () => {
    expect(HOUR_OPTIONS).toHaveLength(24);
    expect(HOUR_OPTIONS.map((option) => option.value)).toEqual(
      Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")),
    );
  });

  it("라벨이 오전/오후를 밝힌다", () => {
    // "14시" 만 보여주면 오후 2시로 착각한다. 값(24시간)과 표기(생활어)를 가른 이유.
    const label = (hour: number) => HOUR_OPTIONS[hour]!.label;
    expect(label(0)).toBe("밤 12시");
    expect(label(1)).toBe("오전 1시");
    expect(label(11)).toBe("오전 11시");
    expect(label(12)).toBe("낮 12시");
    expect(label(13)).toBe("오후 1시");
    expect(label(23)).toBe("오후 11시");
  });

  it("`오전 0시`·`오후 0시` 같은 표기가 없다", () => {
    for (const { label } of HOUR_OPTIONS) {
      expect(label).not.toMatch(/(오전|오후) 0시/);
    }
  });

  it("라벨이 서로 겹치지 않는다", () => {
    // 겹치면 사용자가 두 시각을 구별할 수 없다 (12시간제만 쓰면 여기서 걸린다).
    expect(new Set(HOUR_OPTIONS.map((option) => option.label)).size).toBe(24);
  });
});

describe("분 선택지", () => {
  it("1분 단위로 60개다", () => {
    // 5·10분 단위로 줄이면 보정 후 시진 경계(정시+32분 부근) 양쪽을 표현할 수 없다.
    expect(MINUTE_OPTIONS).toHaveLength(60);
    expect(MINUTE_OPTIONS.map((option) => option.value)).toEqual(
      Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")),
    );
  });

  it("5의 배수가 아닌 분을 고를 수 있다", () => {
    // 완료 기준 "분 단위 정보가 보존된다" 를 직접 확인한다.
    for (const minute of ["01", "28", "31", "32", "47", "59"]) {
      expect(MINUTE_OPTIONS.some((option) => option.value === minute)).toBe(true);
    }
  });

  /**
   * 1분 단위인 **근거**를 만세력 계산으로 직접 확인한다. UI 결정이 도메인 사실에
   * 매달려 있으므로 여기서 두 층을 한 번 잇는다 (근거 표는
   * `docs/saju-validation.md` 2-3-1 절).
   */
  it("경도 보정 때문에 시지 경계가 5의 배수가 아닌 분에 놓인다", () => {
    const jiAt = (birthTime: string) =>
      calculateSajuChart(sajuInputSchema.parse({ birthDate: "1990-05-17", birthTime })).hour?.ji;

    // 보정 −32분 → 시계시 01:32 에서 자시가 끝난다. 30 과 35 사이에 경계가 끼어 있다.
    expect(jiAt("01:30")).toBe("자");
    expect(jiAt("01:31")).toBe("자");
    expect(jiAt("01:32")).toBe("축");
    expect(jiAt("01:35")).toBe("축");

    // 그래서 5분 단위 선택지로는 01:31~01:34 출생자를 옳게 표현할 수 없다.
    const fiveMinuteGrid = MINUTE_OPTIONS.filter((option) => Number(option.value) % 5 === 0);
    expect(fiveMinuteGrid.some((option) => option.value === "32")).toBe(false);
  });
});

describe("조립", () => {
  const parse = (birthTime: string) =>
    sajuInputSchema.safeParse({ birthDate: "1990-05-15", birthTime });

  it("모든 시·분 조합이 서버 계약을 통과한다", () => {
    for (const hour of HOUR_OPTIONS) {
      for (const minute of MINUTE_OPTIONS) {
        const value = composeBirthTime(hour.value, minute.value);
        expect(parse(value).success, `${value} 가 거부됐다`).toBe(true);
      }
    }
  });

  it("한쪽만 고르면 빈 문자열이다", () => {
    // 시만 골랐을 때 분을 00 으로 채우면 사용자가 지정하지 않은 값이 시주에 들어간다.
    expect(composeBirthTime("13", "")).toBe("");
    expect(composeBirthTime("", "47")).toBe("");
    expect(composeBirthTime("", "")).toBe("");
  });

  it("빈 문자열은 시각 미상으로 보내야 한다 (계약이 거부한다)", () => {
    // 폼은 빈 문자열을 `undefined` 로 바꿔 보낸다 — 그대로 보내면 400 이다.
    expect(parse("").success).toBe(false);
    expect(sajuInputSchema.safeParse({ birthDate: "1990-05-15" }).success).toBe(true);
  });
});
