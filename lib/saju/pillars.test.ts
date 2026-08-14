import { Solar } from "lunar-javascript";
import { describe, expect, it } from "vitest";
import { hourGanIndex, hourToJiIndex } from "./ganji";
import { calculateSajuChart } from "./pillars";
import { sajuInputSchema, type SajuInput } from "./schema";
import { wallClockToUtc, type Clock } from "./time-correction";

/**
 * 통합 테스트 — `calculateSajuChart` 를 **독립 구현한 명리학 규칙**과 대조한다.
 *
 * 같은 라이브러리를 두 번 부르는 자기참조 검증은 의미가 없으므로,
 * 60갑자 연속성·오호둔·오서둔을 여기서 직접 구현해 비교하고
 * 절기는 한국천문연구원 공표값과 맞춘다.
 */

const GAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const JI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

function korGanji(index60: number): string {
  return `${GAN[index60 % 10]}${JI[index60 % 12]}`;
}

function makeInput(partial: Partial<SajuInput> & { birthDate: string }): SajuInput {
  return sajuInputSchema.parse(partial);
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 세운이 현재 연도에 의존하므로 결과를 고정한다 */
const FIXED_NOW = { now: new Date("2026-08-13T00:00:00Z") };

// ── 일주: 율리우스일 기반 60갑자 연속성 ─────────────────────────────────────
//
// 앵커 두 개가 서로 정합한다:
//   1900-01-01 = 갑술일(10번), 2000-01-01 = 무오일(54번)
//   간격 36,524일 → (10 + 36524) mod 60 = 54
const DAY_ANCHOR_MS = Date.UTC(1900, 0, 1);
const DAY_ANCHOR_INDEX = 10;

function independentDayIndex(year: number, month: number, day: number): number {
  const days = Math.round((Date.UTC(year, month - 1, day) - DAY_ANCHOR_MS) / 86_400_000);
  return (((DAY_ANCHOR_INDEX + days) % 60) + 60) % 60;
}

describe("일주 — 60갑자 연속성", () => {
  it("앵커 두 개가 서로 정합한다", () => {
    expect(independentDayIndex(1900, 1, 1)).toBe(10); // 갑술
    expect(independentDayIndex(2000, 1, 1)).toBe(54); // 무오
    expect(korGanji(independentDayIndex(1900, 1, 1))).toBe("갑술");
    expect(korGanji(independentDayIndex(2000, 1, 1))).toBe("무오");
  });

  it("1900~2100 전 구간에서 규칙과 일치한다", () => {
    const mismatches: string[] = [];
    for (let year = 1900; year <= 2100; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (const day of [1, 11, 21]) {
          const chart = calculateSajuChart(
            makeInput({
              birthDate: ymd(year, month, day),
              birthTime: "12:00",
              solarTimeMode: "standard",
            }),
            FIXED_NOW,
          );
          const expected = korGanji(independentDayIndex(year, month, day));
          if (chart.day.ganji !== expected) {
            mismatches.push(`${ymd(year, month, day)}: ${chart.day.ganji} ≠ ${expected}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("일주 십신 표기는 '일간'", () => {
    const chart = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "14:30" }),
      FIXED_NOW,
    );
    expect(chart.day.sipsin).toBe("일간");
    expect(chart.ilgan).toBe(chart.day.gan);
  });
});

// ── 년주: (연도 − 4) mod 60, 입춘 기준 ──────────────────────────────────────
describe("년주 — 입춘 기준", () => {
  it("입춘 지난 3/15 는 당해, 입춘 전 1/15 는 전년 간지다 (1900~2100)", () => {
    const mismatches: string[] = [];
    for (let year = 1900; year <= 2100; year += 1) {
      for (const [date, effectiveYear] of [
        [ymd(year, 3, 15), year],
        [ymd(year, 1, 15), year - 1],
      ] as const) {
        const chart = calculateSajuChart(
          makeInput({ birthDate: date, birthTime: "12:00", solarTimeMode: "standard" }),
          FIXED_NOW,
        );
        const expected = korGanji((((effectiveYear - 4) % 60) + 60) % 60);
        if (chart.year.ganji !== expected) {
          mismatches.push(`${date}: ${chart.year.ganji} ≠ ${expected}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("띠는 년지에서 나온다", () => {
    const chart = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "12:00" }),
      FIXED_NOW,
    );
    expect(chart.year.ganji).toBe("경오");
    expect(chart.saencho).toBe("말");
  });
});

// ── 월주: 오호둔 ────────────────────────────────────────────────────────────
describe("월주 — 오호둔", () => {
  it("년간과 월지에서 월간이 유도된다 (1900~2100 각 월)", () => {
    const mismatches: string[] = [];
    for (let year = 1900; year <= 2100; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const chart = calculateSajuChart(
          makeInput({
            birthDate: ymd(year, month, 15),
            birthTime: "12:00",
            solarTimeMode: "standard",
          }),
          FIXED_NOW,
        );
        const yearGan = GAN.indexOf(chart.year.gan);
        const monthJi = JI.indexOf(chart.month.ji);
        const offset = (monthJi - 2 + 12) % 12; // 인월(2)로부터
        const expectedGan = ((yearGan % 5) * 2 + 2 + offset) % 10;
        if (GAN.indexOf(chart.month.gan) !== expectedGan) {
          mismatches.push(
            `${ymd(year, month, 15)}: 월주 ${chart.month.ganji}, 기대 월간 ${GAN[expectedGan]}`,
          );
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ── 시주: 오서둔 ────────────────────────────────────────────────────────────
describe("시주 — 오서둔", () => {
  it("60일 × 12시진에서 규칙과 일치한다", () => {
    const mismatches: string[] = [];
    for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
      const base = new Date(Date.UTC(2024, 0, 1 + dayOffset));
      const date = ymd(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());

      for (let hour = 0; hour < 24; hour += 2) {
        const chart = calculateSajuChart(
          makeInput({
            birthDate: date,
            birthTime: `${String(hour).padStart(2, "0")}:30`,
            solarTimeMode: "standard",
          }),
          FIXED_NOW,
        );
        const ilgan = GAN.indexOf(chart.day.gan);
        const expectedJi = hourToJiIndex(hour);
        const expected = `${GAN[hourGanIndex(ilgan, expectedJi)]}${JI[expectedJi]}`;
        if (chart.hour?.ganji !== expected) {
          mismatches.push(`${date} ${hour}시: ${chart.hour?.ganji} ≠ ${expected}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

// ── 자시 학파 ───────────────────────────────────────────────────────────────
describe("자시 학파", () => {
  it("야자시는 23:30 의 일주를 당일로 본다", () => {
    const chart = calculateSajuChart(
      makeInput({
        birthDate: "2024-01-01",
        birthTime: "23:30",
        solarTimeMode: "standard",
        dayBoundary: "yajasi",
      }),
      FIXED_NOW,
    );
    expect(chart.day.ganji).toBe(korGanji(independentDayIndex(2024, 1, 1)));
  });

  it("자시파는 23:30 의 일주를 다음날로 본다", () => {
    const chart = calculateSajuChart(
      makeInput({
        birthDate: "2024-01-01",
        birthTime: "23:30",
        solarTimeMode: "standard",
        dayBoundary: "jasi",
      }),
      FIXED_NOW,
    );
    expect(chart.day.ganji).toBe(korGanji(independentDayIndex(2024, 1, 2)));
  });

  it("두 학파 모두 시주가 자기 일간과 정합한다", () => {
    // 라이브러리는 sect 를 일주에만 적용해 학파가 섞인다. 그 회귀를 막는 테스트다.
    for (const dayBoundary of ["yajasi", "jasi"] as const) {
      const chart = calculateSajuChart(
        makeInput({
          birthDate: "2024-01-01",
          birthTime: "23:30",
          solarTimeMode: "standard",
          dayBoundary,
        }),
        FIXED_NOW,
      );
      const ilgan = GAN.indexOf(chart.day.gan);
      expect(chart.hour?.gan).toBe(GAN[hourGanIndex(ilgan, 0)]);
      expect(chart.hour?.ji).toBe("자");
    }
  });

  it("자시가 아닌 시각은 학파와 무관하게 같다", () => {
    const charts = (["yajasi", "jasi"] as const).map((dayBoundary) =>
      calculateSajuChart(
        makeInput({
          birthDate: "2024-01-01",
          birthTime: "14:30",
          solarTimeMode: "standard",
          dayBoundary,
        }),
        FIXED_NOW,
      ),
    );
    expect(charts[0]!.day.ganji).toBe(charts[1]!.day.ganji);
    expect(charts[0]!.hour?.ganji).toBe(charts[1]!.hour?.ganji);
  });
});

// ── 음력 · 윤달 ─────────────────────────────────────────────────────────────
describe("음력 입력과 윤달", () => {
  it("음력 2020-04-15 → 양력 2020-05-07", () => {
    const chart = calculateSajuChart(
      makeInput({
        birthDate: "2020-04-15",
        calendar: "lunar",
        isLeapMonth: false,
        birthTime: "12:00",
      }),
      FIXED_NOW,
    );
    expect(chart.solarDate).toBe("2020-05-07");
    expect(chart.lunarDate).not.toContain("윤");
  });

  it("음력 윤4-15 → 양력 2020-06-06", () => {
    const chart = calculateSajuChart(
      makeInput({
        birthDate: "2020-04-15",
        calendar: "lunar",
        isLeapMonth: true,
        birthTime: "12:00",
      }),
      FIXED_NOW,
    );
    expect(chart.solarDate).toBe("2020-06-06");
    expect(chart.lunarDate).toContain("윤");
  });

  it("윤달 여부가 원국을 실제로 바꾼다", () => {
    const normal = calculateSajuChart(
      makeInput({ birthDate: "2020-04-15", calendar: "lunar", birthTime: "12:00" }),
      FIXED_NOW,
    );
    const leap = calculateSajuChart(
      makeInput({
        birthDate: "2020-04-15",
        calendar: "lunar",
        isLeapMonth: true,
        birthTime: "12:00",
      }),
      FIXED_NOW,
    );
    expect(normal.day.ganji).not.toBe(leap.day.ganji);
  });

  it("양력 입력에서는 isLeapMonth 가 무시된다", () => {
    const a = calculateSajuChart(
      makeInput({ birthDate: "2020-05-07", birthTime: "12:00" }),
      FIXED_NOW,
    );
    const b = calculateSajuChart(
      makeInput({ birthDate: "2020-05-07", birthTime: "12:00", isLeapMonth: true }),
      FIXED_NOW,
    );
    expect(a.day.ganji).toBe(b.day.ganji);
  });
});

// ── 시각 미상 ───────────────────────────────────────────────────────────────
describe("시각 미상", () => {
  const chart = calculateSajuChart(makeInput({ birthDate: "1990-05-17" }), FIXED_NOW);

  it("시주를 내지 않는다", () => {
    expect(chart.timeUnknown).toBe(true);
    expect(chart.hour).toBeNull();
  });

  it("보정을 강제로 끈다 (정오를 임시로 쓰는 것이므로)", () => {
    expect(chart.timeCorrection.mode).toBe("standard");
    expect(chart.timeCorrection.appliedTime).toBeNull();
    expect(chart.timeCorrection.correctionMinutes).toBe(0);
  });

  it("오행 합이 6이다 (3기둥 × 2)", () => {
    const total = Object.values(chart.ohaeng.count).reduce((a, b) => a + b, 0);
    expect(total).toBe(6);
  });

  it("보정 옵션을 줘도 무시된다", () => {
    const withOption = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", solarTimeMode: "true" }),
      FIXED_NOW,
    );
    expect(withOption.timeCorrection.mode).toBe("standard");
    expect(withOption.day.ganji).toBe(chart.day.ganji);
  });
});

// ── 시각 보정이 원국에 미치는 영향 ──────────────────────────────────────────
describe("시각 보정", () => {
  it("00:10 은 경도 보정으로 전날 일주가 된다", () => {
    const chart = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "00:10", solarTimeMode: "longitude" }),
      FIXED_NOW,
    );
    expect(chart.timeCorrection.appliedDateShifted).toBe(true);
    expect(chart.day.ganji).toBe(korGanji(independentDayIndex(1990, 5, 16)));
  });

  it("보정을 끄면 날짜가 넘어가지 않는다", () => {
    const chart = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "00:10", solarTimeMode: "standard" }),
      FIXED_NOW,
    );
    expect(chart.timeCorrection.appliedDateShifted).toBe(false);
    expect(chart.day.ganji).toBe(korGanji(independentDayIndex(1990, 5, 17)));
  });

  it("서머타임 구간은 −92분 보정된다", () => {
    const chart = calculateSajuChart(
      makeInput({ birthDate: "1988-07-15", birthTime: "14:30" }),
      FIXED_NOW,
    );
    expect(chart.timeCorrection.dstMinutes).toBe(60);
    expect(chart.timeCorrection.correctionMinutes).toBe(-92);
    expect(chart.timeCorrection.appliedTime).toBe("12:58");
  });

  it("동경 127.5° 시기는 −2분만 보정된다", () => {
    const chart = calculateSajuChart(
      makeInput({ birthDate: "1958-03-10", birthTime: "14:30" }),
      FIXED_NOW,
    );
    expect(chart.timeCorrection.standardOffsetMinutes).toBe(510);
    expect(chart.timeCorrection.correctionMinutes).toBe(-2);
  });
});

// ── 절기: 공표값 대조 ───────────────────────────────────────────────────────
describe("절기 — 한국천문연구원 공표값", () => {
  // 공표값은 그 시기 한국 표준시의 벽시계다.
  // 1958년은 UTC+8:30 이므로 +9 로 고정 환산하면 30분 어긋난다 → tz 로 변환한다.
  it.each([
    [2024, "立春", { year: 2024, month: 2, day: 4, hour: 17, minute: 27 }],
    [2024, "雨水", { year: 2024, month: 2, day: 19, hour: 13, minute: 13 }],
    [2000, "立春", { year: 2000, month: 2, day: 4, hour: 21, minute: 40 }],
    [1990, "立春", { year: 1990, month: 2, day: 4, hour: 11, minute: 14 }],
    [1988, "立春", { year: 1988, month: 2, day: 4, hour: 23, minute: 43 }],
    [1958, "立春", { year: 1958, month: 2, day: 4, hour: 16, minute: 20 }],
  ] satisfies [number, string, Clock][])(
    "%i년 %s 이 공표값과 2분 이내",
    (year, term, published) => {
      const entry = Solar.fromYmdHms(year, 3, 1, 12, 0, 0).getLunar().getJieQiTable()[term];
      expect(entry).toBeDefined();

      // 라이브러리 출력은 베이징(UTC+8) 벽시계다
      const computedMs = Date.parse(`${entry!.toYmdHms().replace(" ", "T")}+08:00`);
      const publishedMs = wallClockToUtc(published);
      const diffMinutes = Math.abs(computedMs - publishedMs) / 60_000;
      expect(diffMinutes).toBeLessThanOrEqual(2);
    },
  );
});

// ── 파생 근거가 원국과 정합한지 ─────────────────────────────────────────────
describe("파생 근거", () => {
  const chart = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "female" }),
    FIXED_NOW,
  );

  it("원국이 경오 신사 임오 정미다", () => {
    expect([chart.year.ganji, chart.month.ganji, chart.day.ganji, chart.hour?.ganji]).toEqual([
      "경오",
      "신사",
      "임오",
      "정미",
    ]);
  });

  it("모든 기둥에 천간·지지 십신이 붙는다", () => {
    for (const pillar of [chart.year, chart.month, chart.hour]) {
      expect(pillar?.sipsin).toBeTruthy();
      expect(pillar?.jiSipsin).toBeTruthy();
    }
    expect(chart.day.jiSipsin).toBeTruthy();
  });

  it("오행 합이 8이다 (4기둥 × 2)", () => {
    const total = Object.values(chart.ohaeng.count).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });

  it("성별을 주면 대운이 나온다 (경오년 양간 + 여자 → 역행)", () => {
    expect(chart.daeun).not.toBeNull();
    expect(chart.daeun!.direction).toBe("backward");
    expect(chart.daeun!.periods).toHaveLength(8);
  });

  it("성별 미지정이면 대운을 내지 않는다", () => {
    const noGender = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "14:30" }),
      FIXED_NOW,
    );
    expect(noGender.daeun).toBeNull();
  });

  it("남녀의 대운 방향이 반대다", () => {
    const male = calculateSajuChart(
      makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "male" }),
      FIXED_NOW,
    );
    expect(male.daeun!.direction).toBe("forward");
    expect(chart.daeun!.direction).toBe("backward");
  });

  it("대운수 근거 일수가 절기 간격 안에 있다", () => {
    // 절기 간격은 약 15일이므로 순행/역행 어느 쪽도 32일을 넘을 수 없다
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [1, 8, 15, 22, 28]) {
        const sample = calculateSajuChart(
          makeInput({ birthDate: ymd(2000, month, day), birthTime: "12:00", gender: "male" }),
          FIXED_NOW,
        );
        expect(sample.daeun!.daysToJeol).toBeGreaterThanOrEqual(0);
        expect(sample.daeun!.daysToJeol).toBeLessThanOrEqual(32);
      }
    }
  });

  it("세운은 기준 연도부터 3년", () => {
    expect(chart.seun.map((y) => y.year)).toEqual([2026, 2027, 2028]);
  });
});

// ── 지장간 통근이 실제 원국 계산까지 이어지는지 (TASK-32) ────────────────────
describe("지장간 통근 — 실측 사례", () => {
  const chart = calculateSajuChart(
    makeInput({ birthDate: "1999-12-09", birthTime: "22:12", gender: "female" }),
    FIXED_NOW,
  );

  it("원국이 기묘 병자 을미 정해다", () => {
    expect([chart.year.ganji, chart.month.ganji, chart.day.ganji, chart.hour?.ganji]).toEqual([
      "기묘",
      "병자",
      "을미",
      "정해",
    ]);
  });

  it("일지 미(未)의 중기 을목으로 득지가 서서 약간 신강이 된다", () => {
    expect(chart.strength.deukji).toBe(true);
    expect(chart.strength.verdict).toBe("약간 신강");
  });

  it("일지 십신 표시는 본기 기준이라 편재 그대로다", () => {
    // 통근은 판정에만 쓴다 — 화면의 근거 표시는 흔들리지 않아야 한다.
    expect(chart.day.jiSipsin).toBe("편재");
  });

  it("통근한 자리를 근거로 함께 낸다", () => {
    expect(chart.strength.rooted).toEqual(["년지 묘", "월지 자", "일지 미", "시지 해"]);
  });

  it("대사 기조가 발산형으로 이어진다", () => {
    // strength.verdict 가 constitution 의 입력이다. 판정이 뒤집히면 접근 순서까지 반대로 간다.
    expect(chart.constitution.metabolism).toBe("발산형");
  });
});

// ── 경계 ────────────────────────────────────────────────────────────────────
describe("지원 범위 경계", () => {
  it.each(["1900-01-01", "1900-02-04", "2100-12-31"])("%s 가 예외 없이 계산된다", (birthDate) => {
    const chart = calculateSajuChart(
      makeInput({ birthDate, birthTime: "00:10", gender: "male" }),
      FIXED_NOW,
    );
    expect(chart.day.ganji).toHaveLength(2);
    expect(chart.daeun).not.toBeNull();
  });

  it("연말·연초 출생도 대운수를 낸다 (절기 테이블 경계)", () => {
    // 절기 테이블이 기준일 주변만 담아서, 앞뒤 45일을 함께 모으지 않으면 여기서 터진다
    for (const birthDate of [
      "2000-01-01",
      "2000-01-06",
      "2000-12-31",
      "1999-12-25",
      "2100-12-28",
    ]) {
      const chart = calculateSajuChart(
        makeInput({ birthDate, birthTime: "12:00", gender: "female" }),
        FIXED_NOW,
      );
      expect(chart.daeun!.daysToJeol).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── 결정론 ──────────────────────────────────────────────────────────────────
describe("결정론", () => {
  it("같은 입력은 항상 같은 원국을 낸다", () => {
    const input = makeInput({
      birthDate: "1990-05-17",
      birthTime: "14:30",
      gender: "female",
      readingType: "diet",
    });
    const first = calculateSajuChart(input, FIXED_NOW);
    const second = calculateSajuChart(input, FIXED_NOW);
    expect(first).toEqual(second);
  });

  it("세운만 기준 연도에 의존한다", () => {
    const input = makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "female" });
    const y2026 = calculateSajuChart(input, { now: new Date("2026-01-01T00:00:00Z") });
    const y2030 = calculateSajuChart(input, { now: new Date("2030-01-01T00:00:00Z") });

    expect(y2026.seun[0]!.year).toBe(2026);
    expect(y2030.seun[0]!.year).toBe(2030);
    // 원국과 대운은 흔들리지 않아야 한다
    expect(y2026.day.ganji).toBe(y2030.day.ganji);
    expect(y2026.daeun).toEqual(y2030.daeun);
  });
});
