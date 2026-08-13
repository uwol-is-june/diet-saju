import { describe, expect, it } from "vitest";
import {
  SEOUL_LONGITUDE,
  equationOfTimeMinutes,
  resolveBirthInstant,
  utcToClock,
  wallClockToUtc,
  zoneOffsetMinutes,
  type Clock,
} from "./time-correction";

/**
 * 이 파일이 지키는 것: 한국 표준시 이력(자오선 변경 2회 + 서머타임 12개 연도)이
 * tz 데이터에서 정확히 읽히는지, 그리고 보정량이 시기별로 달라지는지.
 *
 * 표를 손으로 만들지 않았으므로, 문헌값을 여기 적어 두는 것이 유일한 방어선이다.
 */

const noon = (year: number, month: number, day: number): Clock => ({
  year,
  month,
  day,
  hour: 12,
  minute: 0,
});

describe("표준자오선 이력", () => {
  // 문헌: 1954-03-21 00:30 부터 동경 127.5°, 1961-08-10 부터 동경 135°
  it.each([
    ["1954-03-15", 540, "전환 전 동경 135°"],
    ["1954-04-15", 510, "전환 후 동경 127.5°"],
    ["1961-07-15", 510, "복귀 전 동경 127.5°"],
    ["1961-09-15", 540, "복귀 후 동경 135°"],
    ["1990-05-17", 540, "현행 동경 135°"],
    ["2026-08-13", 540, "현재"],
  ])("%s → UTC+%i분 (%s)", (date, expectedOffset) => {
    expect(zoneOffsetMinutes(Date.parse(`${date}T03:00:00Z`))).toBe(expectedOffset);
  });

  it("일제 이전은 서울 지방 평균시(약 UTC+8:28)", () => {
    expect(zoneOffsetMinutes(Date.parse("1905-06-15T03:00:00Z"))).toBe(508);
  });

  it("대한제국기는 동경 127.5°", () => {
    expect(zoneOffsetMinutes(Date.parse("1910-06-15T03:00:00Z"))).toBe(510);
  });
});

describe("서머타임", () => {
  // 문헌: 1948~51, 1955~60, 1987~88 여름에 시행
  const dstYears = [1948, 1949, 1950, 1951, 1955, 1956, 1957, 1958, 1959, 1960, 1987, 1988];
  const nonDstYears = [1947, 1952, 1953, 1954, 1961, 1986, 1989, 2000, 2026];

  it.each(dstYears)("%i년 7월은 서머타임 적용", (year) => {
    const instant = resolveBirthInstant(noon(year, 7, 15), { mode: "longitude" });
    expect(instant.dstMinutes).toBe(60);
  });

  it.each(nonDstYears)("%i년 7월은 서머타임 없음", (year) => {
    const instant = resolveBirthInstant(noon(year, 7, 15), { mode: "longitude" });
    expect(instant.dstMinutes).toBe(0);
  });

  it("서머타임 시행 연도라도 겨울은 적용되지 않는다", () => {
    for (const year of dstYears) {
      const instant = resolveBirthInstant(noon(year, 1, 15), { mode: "longitude" });
      expect(instant.dstMinutes).toBe(0);
    }
  });

  it("전 구간(1900~2100)에서 편차가 0분 또는 60분뿐이다", () => {
    // 우리 자오선 표(MERIDIAN_HISTORY)와 tz 가 어긋나면 여기서 깨진다
    const outliers: string[] = [];
    for (let year = 1900; year <= 2100; year += 1) {
      for (const month of [1, 7]) {
        const instant = resolveBirthInstant(noon(year, month, 15), { mode: "longitude" });
        if (instant.dstMinutes !== 0 && instant.dstMinutes !== 60) {
          outliers.push(`${year}-${month}: ${instant.dstMinutes}분`);
        }
      }
    }
    expect(outliers).toEqual([]);
  });
});

describe("시각 보정량", () => {
  it("보정 없음 모드는 0분", () => {
    const instant = resolveBirthInstant(
      { year: 1990, month: 5, day: 17, hour: 14, minute: 30 },
      { mode: "standard" },
    );
    expect(instant.correctionMinutes).toBe(0);
  });

  it("동경 135° 시기 서울은 −32분", () => {
    const instant = resolveBirthInstant(
      { year: 1990, month: 5, day: 17, hour: 14, minute: 30 },
      { mode: "longitude" },
    );
    expect(instant.correctionMinutes).toBe(-32);
    expect(instant.localClock.hour).toBe(13);
    expect(instant.localClock.minute).toBe(58);
  });

  it("동경 127.5° 시기는 −2분뿐이다", () => {
    // 당시 표준시가 이미 한반도 중앙 기준이었다
    const instant = resolveBirthInstant(
      { year: 1958, month: 3, day: 10, hour: 14, minute: 30 },
      { mode: "longitude" },
    );
    expect(instant.standardOffsetMinutes).toBe(510);
    expect(instant.correctionMinutes).toBe(-2);
  });

  it("서머타임 구간은 −60분이 더 얹힌다", () => {
    const instant = resolveBirthInstant(
      { year: 1988, month: 7, day: 15, hour: 14, minute: 30 },
      { mode: "longitude" },
    );
    expect(instant.dstMinutes).toBe(60);
    expect(instant.correctionMinutes).toBe(-92);
    expect(instant.localClock.hour).toBe(12);
    expect(instant.localClock.minute).toBe(58);
  });

  it("보정량과 표시 시각이 서로 어긋나지 않는다", () => {
    // 오프셋을 분 단위로 한 번만 반올림하므로 항상 정합해야 한다
    for (const [year, month, day] of [
      [1990, 5, 17],
      [1988, 7, 15],
      [1958, 3, 10],
      [2026, 8, 13],
    ] as const) {
      const wallClock = { year, month, day, hour: 14, minute: 30 };
      const instant = resolveBirthInstant(wallClock, { mode: "longitude" });
      const expectedMinutes = 14 * 60 + 30 + instant.correctionMinutes;
      const actualMinutes = instant.localClock.hour * 60 + instant.localClock.minute;
      expect(actualMinutes).toBe(((expectedMinutes % 1440) + 1440) % 1440);
    }
  });

  it("경도를 지정하면 보정량이 달라진다", () => {
    const seoul = resolveBirthInstant(
      { year: 1990, month: 5, day: 17, hour: 14, minute: 30 },
      { mode: "longitude", longitude: SEOUL_LONGITUDE },
    );
    const busan = resolveBirthInstant(
      { year: 1990, month: 5, day: 17, hour: 14, minute: 30 },
      { mode: "longitude", longitude: 129.08 },
    );
    // 부산이 동쪽이므로 보정량이 더 작다 (약 8분 차)
    expect(busan.correctionMinutes).toBeGreaterThan(seoul.correctionMinutes);
    expect(busan.correctionMinutes - seoul.correctionMinutes).toBe(8);
  });

  it("균시차 모드는 경도 모드와 ±17분 이내로만 다르다", () => {
    for (const month of [1, 4, 7, 11]) {
      const longitude = resolveBirthInstant(
        { year: 1990, month, day: 15, hour: 14, minute: 30 },
        { mode: "longitude" },
      );
      const trueSolar = resolveBirthInstant(
        { year: 1990, month, day: 15, hour: 14, minute: 30 },
        { mode: "true" },
      );
      const diff = trueSolar.correctionMinutes - longitude.correctionMinutes;
      expect(Math.abs(diff)).toBeLessThanOrEqual(17);
    }
  });
});

describe("균시차", () => {
  it("연중 ±17분 안에서 진동한다", () => {
    for (let dayOfYear = 0; dayOfYear < 365; dayOfYear += 5) {
      const utcMs = Date.UTC(2024, 0, 1) + dayOfYear * 86_400_000;
      expect(Math.abs(equationOfTimeMinutes(utcMs))).toBeLessThan(17);
    }
  });

  it("2월 중순은 음수, 11월 초는 양수다", () => {
    // 균시차의 대표적인 두 극점 부호
    expect(equationOfTimeMinutes(Date.UTC(2024, 1, 11, 12))).toBeLessThan(0);
    expect(equationOfTimeMinutes(Date.UTC(2024, 10, 3, 12))).toBeGreaterThan(0);
  });
});

describe("벽시계 ↔ 절대시각 변환", () => {
  it("왕복 변환이 일치한다", () => {
    const wallClock = { year: 1990, month: 5, day: 17, hour: 14, minute: 30 };
    const utcMs = wallClockToUtc(wallClock);
    expect(utcToClock(utcMs, zoneOffsetMinutes(utcMs))).toEqual(wallClock);
  });

  it("서머타임 구간에서도 왕복한다", () => {
    const wallClock = { year: 1988, month: 7, day: 15, hour: 14, minute: 30 };
    const utcMs = wallClockToUtc(wallClock);
    expect(utcToClock(utcMs, zoneOffsetMinutes(utcMs))).toEqual(wallClock);
  });

  it("자오선 전환 직후에도 왕복한다", () => {
    const wallClock = { year: 1954, month: 4, day: 1, hour: 9, minute: 0 };
    const utcMs = wallClockToUtc(wallClock);
    expect(utcToClock(utcMs, zoneOffsetMinutes(utcMs))).toEqual(wallClock);
  });

  it("절기 판정용 베이징 시각은 KST 보다 1시간 이르다", () => {
    const instant = resolveBirthInstant(
      { year: 2026, month: 8, day: 13, hour: 12, minute: 0 },
      { mode: "standard" },
    );
    expect(instant.beijingClock.hour).toBe(11);
    expect(instant.beijingClock.day).toBe(13);
  });
});
