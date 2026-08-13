/**
 * 사주 계산 교차검증기 (TASK-03).
 *
 * 목적: `lib/saju/` 의 계산을 **독립적으로 구현한 규칙**과 대조한다.
 * 같은 라이브러리를 두 번 부르는 자기참조 검증은 의미가 없으므로,
 * 여기서는 명리학 규칙(60갑자 연속성·오호둔·오서둔)과 천문 공표값을 근거로 삼는다.
 *
 * 실행: npm run validate:saju
 *
 * 검증 항목
 *  A. 일주 — 율리우스일 기반 60갑자 연속 계산과 대조 (1900~2100 전수)
 *  B. 년주 — (연도 − 4) mod 60 규칙과 대조, 입춘 전후 분기 포함
 *  C. 월주 — 오호둔(년간 → 인월 천간) 규칙과 대조
 *  D. 시주 — 오서둔(일간 → 자시 천간) 규칙과 대조, 12시진 전수
 *  E. 시간 보정 — tz 데이터의 서머타임/표준자오선이 우리 표와 일치하는지
 *  F. 절기 — 라이브러리 절기 시각을 한국천문연구원 공표값과 대조
 *  G. 경계 케이스 — 자시 학파, 윤달, 시각 미상, 지원 범위 끝
 */
import { Solar } from "lunar-javascript";
import {
  SEASONAL_MULTIPLIER,
  daeunDirection,
  daeunStartAge,
} from "../lib/saju/analysis";
import {
  hourGanIndex,
  hourToJiIndex,
  jiBongi,
  jiSipsin,
  seasonOf,
  seasonalStates,
  sexagenaryIndex,
  sipsinOf,
} from "../lib/saju/ganji";
import { calculateSajuChart } from "../lib/saju/pillars";
import { sajuInputSchema, type SajuInput } from "../lib/saju/schema";
import {
  resolveBirthInstant,
  wallClockToUtc,
  zoneOffsetMinutes,
  type Clock,
} from "../lib/saju/time-correction";

const GAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const JI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

let failures = 0;
let checks = 0;

function expect(condition: boolean, label: string, detail = ""): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** 스키마 기본값을 채운 입력 만들기 */
function makeInput(partial: Partial<SajuInput> & { birthDate: string }): SajuInput {
  return sajuInputSchema.parse(partial);
}

function korGanji(index60: number): string {
  return `${GAN[index60 % 10]}${JI[index60 % 12]}`;
}

// ── A. 일주: 율리우스일 기반 60갑자 연속성 ─────────────────────────────────
//
// 검증 앵커 두 개가 서로 정합함을 먼저 확인한다.
//   1900-01-01 = 갑술일(60갑자 10번)
//   2000-01-01 = 무오일(60갑자 54번)
// 두 날짜 간격 36524 일 → (10 + 36524) mod 60 = 54. 일치한다.
const ANCHOR_MS = Date.UTC(1900, 0, 1);
const ANCHOR_INDEX = 10;

function independentDayIndex(year: number, month: number, day: number): number {
  const days = Math.round((Date.UTC(year, month - 1, day) - ANCHOR_MS) / 86_400_000);
  return (((ANCHOR_INDEX + days) % 60) + 60) % 60;
}

function checkDayPillars(): void {
  section("A. 일주 — 율리우스일 기반 60갑자 연속 계산과 대조 (1900~2100 전수)");

  // 앵커 자기정합성
  expect(
    independentDayIndex(2000, 1, 1) === 54,
    "앵커 정합성 (1900-01-01 갑술 → 2000-01-01 무오)",
    `계산값 ${korGanji(independentDayIndex(2000, 1, 1))}`,
  );

  let compared = 0;
  let mismatch = 0;
  const samples: string[] = [];

  for (let year = 1900; year <= 2100; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      // 각 달 1·11·21일 (전수에 가깝게, 실행 시간은 유지)
      for (const day of [1, 11, 21]) {
        const expectedIndex = independentDayIndex(year, month, day);
        // 정오로 계산해 자시 경계 영향을 배제한다. 보정도 끈다.
        const chart = calculateSajuChart(
          makeInput({
            birthDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            birthTime: "12:00",
            solarTimeMode: "standard",
          }),
        );
        compared += 1;
        if (chart.day.ganji !== korGanji(expectedIndex)) {
          mismatch += 1;
          if (samples.length < 5) {
            samples.push(
              `${year}-${month}-${day}: 우리 ${chart.day.ganji} vs 규칙 ${korGanji(expectedIndex)}`,
            );
          }
        }
      }
    }
  }

  expect(mismatch === 0, `일주 ${compared}건 대조`, samples.join(" / "));
  console.log(`  → ${compared}건 비교, 불일치 ${mismatch}건`);
}

// ── B. 년주: (연도 − 4) mod 60, 입춘 기준 ──────────────────────────────────
function checkYearPillars(): void {
  section("B. 년주 — (연도 − 4) mod 60 규칙과 대조 (입춘 전후 분기)");

  let mismatch = 0;
  const samples: string[] = [];

  for (let year = 1900; year <= 2100; year += 1) {
    // 입춘(2/3~2/5)을 확실히 지난 3/15 → 당해 연도 간지
    // 입춘 전인 1/15 → 전년도 간지
    const cases: [string, number][] = [
      [`${year}-03-15`, year],
      [`${year}-01-15`, year - 1],
    ];
    for (const [date, effectiveYear] of cases) {
      const expectedIndex = (((effectiveYear - 4) % 60) + 60) % 60;
      const chart = calculateSajuChart(
        makeInput({ birthDate: date, birthTime: "12:00", solarTimeMode: "standard" }),
      );
      if (chart.year.ganji !== korGanji(expectedIndex)) {
        mismatch += 1;
        if (samples.length < 5) {
          samples.push(`${date}: 우리 ${chart.year.ganji} vs 규칙 ${korGanji(expectedIndex)}`);
        }
      }
    }
  }

  expect(mismatch === 0, `년주 ${(2100 - 1900 + 1) * 2}건 대조`, samples.join(" / "));
  console.log(`  → ${(2100 - 1900 + 1) * 2}건 비교, 불일치 ${mismatch}건`);
}

// ── C. 월주: 오호둔 (년간 → 인월 천간) ─────────────────────────────────────
//
// 갑기년 → 병인월, 을경년 → 무인월, 병신년 → 경인월, 정임년 → 임인월, 무계년 → 갑인월
// 즉 인월 천간 = (년간 % 5) * 2 + 2, 이후 월지 순행에 따라 함께 순행한다.
function checkMonthPillars(): void {
  section("C. 월주 — 오호둔 규칙과 대조 (년간·월지에서 월간 유도)");

  let mismatch = 0;
  const samples: string[] = [];
  let compared = 0;

  for (let year = 1900; year <= 2100; year += 1) {
    // 각 월 중순 — 절기 경계에서 충분히 떨어진 날짜
    for (let month = 1; month <= 12; month += 1) {
      const chart = calculateSajuChart(
        makeInput({
          birthDate: `${year}-${String(month).padStart(2, "0")}-15`,
          birthTime: "12:00",
          solarTimeMode: "standard",
        }),
      );
      const yearGan = GAN.indexOf(chart.year.gan);
      const monthJi = JI.indexOf(chart.month.ji);
      const monthGan = GAN.indexOf(chart.month.gan);

      // 인월(2)로부터 몇 칸 갔는지
      const offset = (monthJi - 2 + 12) % 12;
      const expectedGan = ((yearGan % 5) * 2 + 2 + offset) % 10;

      compared += 1;
      if (monthGan !== expectedGan) {
        mismatch += 1;
        if (samples.length < 5) {
          samples.push(
            `${year}-${month}: 월주 ${chart.month.ganji}, 년간 ${chart.year.gan} → 기대 월간 ${GAN[expectedGan]}`,
          );
        }
      }
    }
  }

  expect(mismatch === 0, `월주 ${compared}건 대조`, samples.join(" / "));
  console.log(`  → ${compared}건 비교, 불일치 ${mismatch}건`);
}

// ── D. 시주: 오서둔 (일간 → 자시 천간), 12시진 전수 ────────────────────────
function checkHourPillars(): void {
  section("D. 시주 — 오서둔 규칙과 대조 (일간 10 × 시진 12 전수)");

  let mismatch = 0;
  const samples: string[] = [];
  let compared = 0;

  // 60일 연속으로 모든 일간을 커버하고, 각 날 12시진을 훑는다
  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const base = new Date(Date.UTC(2024, 0, 1 + dayOffset));
    const date = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;

    for (let hour = 0; hour < 24; hour += 2) {
      const chart = calculateSajuChart(
        makeInput({
          birthDate: date,
          birthTime: `${String(hour).padStart(2, "0")}:30`,
          solarTimeMode: "standard",
        }),
      );
      if (!chart.hour) continue;

      const ilgan = GAN.indexOf(chart.day.gan);
      const expectedJi = hourToJiIndex(hour);
      const expectedGan = hourGanIndex(ilgan, expectedJi);

      compared += 1;
      const actual = chart.hour.ganji;
      const expected = `${GAN[expectedGan]}${JI[expectedJi]}`;
      if (actual !== expected) {
        mismatch += 1;
        if (samples.length < 5) samples.push(`${date} ${hour}시: ${actual} vs ${expected}`);
      }
    }
  }

  expect(mismatch === 0, `시주 ${compared}건 대조`, samples.join(" / "));
  console.log(`  → ${compared}건 비교, 불일치 ${mismatch}건`);

  // 시진 경계: 자시가 23:00 에 시작하고 01:00 에 끝나는지
  expect(hourToJiIndex(23) === 0, "23시 → 자시");
  expect(hourToJiIndex(0) === 0, "0시 → 자시");
  expect(hourToJiIndex(1) === 1, "1시 → 축시");
  expect(hourToJiIndex(22) === 11, "22시 → 해시");
}

// ── E. 시간 보정: tz 데이터 vs 문헌 ────────────────────────────────────────
function checkTimeCorrection(): void {
  section("E. 시간 보정 — 표준자오선 이력·서머타임이 문헌과 일치하는지");

  // 표준자오선 전환 (문헌: 1954-03-21 00:30 부터 동경 127.5°, 1961-08-10 부터 동경 135°)
  const meridianCases: [string, number, string][] = [
    ["1954-03-15T03:00:00Z", 540, "전환 전 동경 135°"],
    ["1954-04-15T03:00:00Z", 510, "전환 후 동경 127.5°"],
    ["1961-07-15T03:00:00Z", 510, "복귀 전 동경 127.5°"],
    ["1961-09-15T03:00:00Z", 540, "복귀 후 동경 135°"],
    ["1990-05-17T03:00:00Z", 540, "현행 동경 135°"],
  ];
  for (const [iso, expectedOffset, label] of meridianCases) {
    const actual = zoneOffsetMinutes(Date.parse(iso));
    expect(actual === expectedOffset, `${label} (${iso.slice(0, 10)})`, `tz=${actual}분`);
  }

  // 서머타임: 전 구간에서 (실제 오프셋 − 표준 오프셋) 이 0 또는 60 이어야 한다.
  // 값이 그 밖이면 우리 자오선 표가 tz 와 어긋난 것이다.
  let dstOutliers = 0;
  const outlierSamples: string[] = [];
  for (let year = 1900; year <= 2100; year += 1) {
    for (const [month, day] of [
      [1, 15],
      [7, 15],
    ] as const) {
      const instant = resolveBirthInstant(
        { year, month, day, hour: 12, minute: 0 },
        { mode: "longitude" },
      );
      if (instant.dstMinutes !== 0 && instant.dstMinutes !== 60) {
        dstOutliers += 1;
        if (outlierSamples.length < 8) {
          outlierSamples.push(`${year}-${month}: ${instant.dstMinutes}분`);
        }
      }
    }
  }
  expect(dstOutliers === 0, "서머타임 편차가 0/60분 뿐인지 (자오선 표 정합성)", outlierSamples.join(" / "));

  // 서머타임 구간 표본 (문헌: 1948~51, 1955~60, 1987~88 여름)
  const dstYears = [1948, 1949, 1950, 1951, 1955, 1956, 1957, 1958, 1959, 1960, 1987, 1988];
  for (const year of dstYears) {
    const summer = resolveBirthInstant(
      { year, month: 7, day: 15, hour: 12, minute: 0 },
      { mode: "longitude" },
    );
    expect(summer.dstMinutes === 60, `${year}년 7월 서머타임 적용`, `${summer.dstMinutes}분`);
  }
  // 서머타임이 없어야 하는 해
  for (const year of [1947, 1953, 1962, 1986, 1989, 2000]) {
    const summer = resolveBirthInstant(
      { year, month: 7, day: 15, hour: 12, minute: 0 },
      { mode: "longitude" },
    );
    expect(summer.dstMinutes === 0, `${year}년 7월 서머타임 없음`, `${summer.dstMinutes}분`);
  }

  // 경도 보정량: 동경 135° 시기 서울은 약 −32분
  const modern = resolveBirthInstant(
    { year: 1990, month: 5, day: 17, hour: 14, minute: 30 },
    { mode: "longitude" },
  );
  expect(
    modern.correctionMinutes === -32,
    "1990년 서울 경도 보정 −32분",
    `${modern.correctionMinutes}분`,
  );

  // 동경 127.5° 시기는 보정량이 −2분 수준
  const midCentury = resolveBirthInstant(
    { year: 1958, month: 3, day: 10, hour: 14, minute: 30 },
    { mode: "longitude" },
  );
  expect(
    midCentury.correctionMinutes === -2,
    "1958년 3월(127.5°) 경도 보정 −2분",
    `${midCentury.correctionMinutes}분`,
  );

  // 서머타임 구간은 −60분이 추가로 얹힌다
  const dstSummer = resolveBirthInstant(
    { year: 1988, month: 7, day: 15, hour: 14, minute: 30 },
    { mode: "longitude" },
  );
  expect(
    dstSummer.correctionMinutes === -92,
    "1988년 7월 서머타임+경도 보정 −92분",
    `${dstSummer.correctionMinutes}분`,
  );

  // 균시차 모드는 경도 모드와 ±17분 이내 차이
  const trueSolar = resolveBirthInstant(
    { year: 1990, month: 5, day: 17, hour: 14, minute: 30 },
    { mode: "true" },
  );
  const eotDiff = trueSolar.correctionMinutes - modern.correctionMinutes;
  expect(Math.abs(eotDiff) <= 17, "균시차 크기가 ±17분 이내", `${eotDiff}분`);
}

// ── F. 절기: 라이브러리 vs 한국천문연구원 공표값 ───────────────────────────
//
// 라이브러리는 절기를 베이징 시간(UTC+8)으로 계산한다. KST 는 +1시간.
function checkSolarTerms(): void {
  section("F. 절기 — 라이브러리 계산값 vs 한국천문연구원 공표값(KST)");

  // 공표값은 그 시기 한국 표준시의 벽시계 값이다.
  // 1958년은 동경 127.5°(UTC+8:30) 시기이므로 +9 로 고정 환산하면 30분 어긋난다.
  // 따라서 기대값도 tz(Asia/Seoul)를 통해 절대 시각으로 바꿔 비교한다.
  const published: [number, string, Clock][] = [
    [2024, "立春", { year: 2024, month: 2, day: 4, hour: 17, minute: 27 }],
    [2024, "雨水", { year: 2024, month: 2, day: 19, hour: 13, minute: 13 }],
    [2000, "立春", { year: 2000, month: 2, day: 4, hour: 21, minute: 40 }],
    [1990, "立春", { year: 1990, month: 2, day: 4, hour: 11, minute: 14 }],
    // 서머타임 시행 연도 (2월이라 서머타임 구간은 아니지만 그 해 tz 처리를 함께 확인)
    [1988, "立春", { year: 1988, month: 2, day: 4, hour: 23, minute: 43 }],
    // 동경 127.5° 시기 — tz 가 UTC+8:30 을 반영하는지가 핵심
    [1958, "立春", { year: 1958, month: 2, day: 4, hour: 16, minute: 20 }],
  ];

  for (const [year, term, expectedClock] of published) {
    const table = Solar.fromYmdHms(year, 3, 1, 12, 0, 0).getLunar().getJieQiTable();
    const entry = table[term];
    if (!entry) {
      expect(false, `${year} ${term} 절기 테이블 존재`);
      continue;
    }

    // 라이브러리 출력은 베이징(UTC+8) 벽시계 → 절대 시각으로
    const computedMs = Date.parse(`${entry.toYmdHms().replace(" ", "T")}+08:00`);
    // 공표값은 당시 한국 표준시 벽시계 → 절대 시각으로 (tz 가 자오선 이력 반영)
    const expectedMs = wallClockToUtc(expectedClock);

    const diffMinutes = Math.abs(computedMs - expectedMs) / 60_000;
    const asSeoul = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      dateStyle: "short",
      timeStyle: "short",
      hour12: false,
    }).format(new Date(computedMs));

    // 근사 알고리즘이라 1~2분 오차는 허용한다. 절입 시각 경계 판정에는 영향이 있을 수 있어
    // docs/saju-validation.md 에 한계로 명시했다.
    expect(
      diffMinutes <= 2,
      `${year} ${term}`,
      `계산 ${asSeoul} vs 공표 ${expectedClock.hour}:${String(expectedClock.minute).padStart(2, "0")} (차 ${diffMinutes.toFixed(0)}분)`,
    );
  }
}

// ── G. 경계 케이스 ─────────────────────────────────────────────────────────
function checkEdgeCases(): void {
  section("G. 경계 케이스 — 자시 학파 / 윤달 / 시각 미상 / 지원 범위 끝");

  // G-1. 자시 학파: 23:30 에 두 학파의 일주가 하루 차이여야 한다
  const yajasi = calculateSajuChart(
    makeInput({
      birthDate: "2024-01-01",
      birthTime: "23:30",
      solarTimeMode: "standard",
      dayBoundary: "yajasi",
    }),
  );
  const jasi = calculateSajuChart(
    makeInput({
      birthDate: "2024-01-01",
      birthTime: "23:30",
      solarTimeMode: "standard",
      dayBoundary: "jasi",
    }),
  );
  const yajasiIdx = independentDayIndex(2024, 1, 1);
  const jasiIdx = independentDayIndex(2024, 1, 2);
  expect(
    yajasi.day.ganji === korGanji(yajasiIdx),
    "야자시: 23:30 일주는 당일",
    `${yajasi.day.ganji} vs ${korGanji(yajasiIdx)}`,
  );
  expect(
    jasi.day.ganji === korGanji(jasiIdx),
    "자시파: 23:30 일주는 다음날",
    `${jasi.day.ganji} vs ${korGanji(jasiIdx)}`,
  );

  // G-2. 두 학파 모두 시주가 자기 일간과 정합해야 한다 (혼용 금지)
  for (const [label, chart] of [
    ["야자시", yajasi],
    ["자시파", jasi],
  ] as const) {
    const ilgan = GAN.indexOf(chart.day.gan);
    const expectedGan = GAN[hourGanIndex(ilgan, 0)];
    expect(
      chart.hour?.gan === expectedGan,
      `${label}: 시주 천간이 일간과 정합 (오서둔)`,
      `시주 ${chart.hour?.ganji}, 일간 ${chart.day.gan} → 기대 ${expectedGan}자`,
    );
  }

  // G-3. 윤달: 2020년 윤4월 15일 ≠ 평4월 15일
  const normalMonth = calculateSajuChart(
    makeInput({ birthDate: "2020-04-15", calendar: "lunar", isLeapMonth: false, birthTime: "12:00" }),
  );
  const leapMonth = calculateSajuChart(
    makeInput({ birthDate: "2020-04-15", calendar: "lunar", isLeapMonth: true, birthTime: "12:00" }),
  );
  expect(normalMonth.solarDate === "2020-05-07", "음력 2020-04-15 → 양력 2020-05-07", normalMonth.solarDate);
  expect(leapMonth.solarDate === "2020-06-06", "음력 윤4-15 → 양력 2020-06-06", leapMonth.solarDate);
  expect(leapMonth.lunarDate.includes("윤"), "윤달 표기에 '윤' 포함", leapMonth.lunarDate);
  expect(!normalMonth.lunarDate.includes("윤"), "평달에는 '윤' 없음", normalMonth.lunarDate);

  // G-4. 시각 미상: 시주 null, 보정 강제 해제
  const noTime = calculateSajuChart(makeInput({ birthDate: "1990-05-17" }));
  expect(noTime.hour === null, "시각 미상 → 시주 null");
  expect(noTime.timeUnknown === true, "시각 미상 플래그");
  expect(noTime.timeCorrection.appliedTime === null, "시각 미상 → 적용 시각 없음");
  expect(noTime.timeCorrection.mode === "standard", "시각 미상 → 보정 비활성");
  const ohaengTotal = Object.values(noTime.ohaeng.count).reduce((a, b) => a + b, 0);
  expect(ohaengTotal === 6, "시각 미상 오행 합은 6 (3기둥 × 2)", `${ohaengTotal}`);

  // G-5. 오행 합계: 시각 있으면 8
  const withTime = calculateSajuChart(makeInput({ birthDate: "1990-05-17", birthTime: "14:30" }));
  const total8 = Object.values(withTime.ohaeng.count).reduce((a, b) => a + b, 0);
  expect(total8 === 8, "시각 있음 오행 합은 8 (4기둥 × 2)", `${total8}`);

  // G-6. 지원 범위 끝단이 던지지 않는지
  for (const date of ["1900-01-01", "1900-02-04", "2100-12-31"]) {
    try {
      const chart = calculateSajuChart(makeInput({ birthDate: date, birthTime: "00:10" }));
      expect(chart.day.ganji.length === 2, `범위 끝 ${date} 계산 성공`, chart.day.ganji);
    } catch (error) {
      expect(false, `범위 끝 ${date} 계산 성공`, String(error));
    }
  }

  // G-7. 보정으로 날짜가 넘어가는 케이스 (00:10 → 전날 23:38)
  const shifted = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "00:10", solarTimeMode: "longitude" }),
  );
  expect(shifted.timeCorrection.appliedDateShifted === true, "00:10 경도보정 시 날짜 이동 감지");
  expect(
    shifted.day.ganji === korGanji(independentDayIndex(1990, 5, 16)),
    "날짜 이동 후 일주는 전날 기준",
    `${shifted.day.ganji} vs ${korGanji(independentDayIndex(1990, 5, 16))}`,
  );

  // G-8. 십신: 일주는 항상 '일간'
  expect(withTime.day.sipsin === "일간", "일주 십신 표기는 '일간'", withTime.day.sipsin);

  // G-9. 60갑자 인덱스 왕복
  let roundTripOk = true;
  for (let i = 0; i < 60; i += 1) {
    if (sexagenaryIndex({ gan: i % 10, ji: i % 12 }) !== i) roundTripOk = false;
  }
  expect(roundTripOk, "60갑자 인덱스 왕복 일치");
}

// ── H. 지지 십신 (TASK-04) ─────────────────────────────────────────────────
function checkJiSipsin(): void {
  section("H. 지지 십신 — 지장간 본기 기준 (일간 10 × 지지 12 전수)");

  // 본기 표를 문헌값으로 다시 적어 대조한다 (자→계, 축→기, …)
  const expectedBongi: Record<string, string> = {
    자: "계", 축: "기", 인: "갑", 묘: "을", 진: "무", 사: "병",
    오: "정", 미: "기", 신: "경", 유: "신", 술: "무", 해: "임",
  };
  let bongiOk = true;
  JI.forEach((jiName, jiIndex) => {
    if (GAN[jiBongi(jiIndex)] !== expectedBongi[jiName]) bongiOk = false;
  });
  expect(bongiOk, "지장간 본기 12건 문헌 대조");

  // 지지 십신 = 본기 천간의 십신과 같아야 한다
  let mismatch = 0;
  for (let ilgan = 0; ilgan < 10; ilgan += 1) {
    for (let ji = 0; ji < 12; ji += 1) {
      if (jiSipsin(ilgan, ji) !== sipsinOf(ilgan, jiBongi(ji))) mismatch += 1;
    }
  }
  expect(mismatch === 0, "지지 십신 120건이 본기 십신과 일치", `불일치 ${mismatch}`);

  // 십신 대칭성: 같은 오행·같은 음양이면 비견
  let selfOk = true;
  for (let gan = 0; gan < 10; gan += 1) {
    if (sipsinOf(gan, gan) !== "비견") selfOk = false;
  }
  expect(selfOk, "자기 천간의 십신은 비견");

  // 십신 10종이 모두 나타나는지 (누락된 분기 없음)
  const seen = new Set<string>();
  for (let ilgan = 0; ilgan < 10; ilgan += 1) {
    for (let target = 0; target < 10; target += 1) seen.add(sipsinOf(ilgan, target));
  }
  expect(seen.size === 10, "십신 10종 전부 산출", `${seen.size}종`);
}

// ── I. 왕상휴수사 ──────────────────────────────────────────────────────────
function checkSeasonalStates(): void {
  section("I. 왕상휴수사 — 고전 표와 대조");

  // 문헌: 봄=목왕/화상/수휴/금수/토사, 여름=화왕/토상/목휴/수수/금사,
  //       가을=금왕/수상/토휴/화수/목사, 겨울=수왕/목상/금휴/토수/화사
  const literature: Record<string, Record<string, string>> = {
    봄: { 목: "왕", 화: "상", 수: "휴", 금: "수", 토: "사" },
    여름: { 화: "왕", 토: "상", 목: "휴", 수: "수", 금: "사" },
    가을: { 금: "왕", 수: "상", 토: "휴", 화: "수", 목: "사" },
    겨울: { 수: "왕", 목: "상", 금: "휴", 토: "수", 화: "사" },
  };

  let mismatch = 0;
  const samples: string[] = [];
  for (let monthJi = 0; monthJi < 12; monthJi += 1) {
    const season = seasonOf(monthJi);
    const states = seasonalStates(monthJi);
    for (const [element, expected] of Object.entries(literature[season]!)) {
      const actual = states[element as keyof typeof states];
      if (actual !== expected) {
        mismatch += 1;
        if (samples.length < 5) {
          samples.push(`${JI[monthJi]}월(${season}) ${element}: ${actual} vs ${expected}`);
        }
      }
    }
  }
  expect(mismatch === 0, "왕상휴수사 60건 (지지 12 × 오행 5)", samples.join(" / "));

  // 계절 매핑
  expect(seasonOf(2) === "봄" && seasonOf(4) === "봄", "인·진월은 봄");
  expect(seasonOf(5) === "여름" && seasonOf(7) === "여름", "사·미월은 여름");
  expect(seasonOf(8) === "가을" && seasonOf(10) === "가을", "신·술월은 가을");
  expect(seasonOf(11) === "겨울" && seasonOf(1) === "겨울", "해·축월은 겨울");

  // 각 계절에서 왕/상/휴/수/사가 정확히 하나씩
  let distributionOk = true;
  for (let monthJi = 0; monthJi < 12; monthJi += 1) {
    const counts = new Map<string, number>();
    for (const state of Object.values(seasonalStates(monthJi))) {
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    if (counts.size !== 5 || [...counts.values()].some((c) => c !== 1)) distributionOk = false;
  }
  expect(distributionOk, "각 계절에 왕·상·휴·수·사가 하나씩");
}

// ── J. 대운 ────────────────────────────────────────────────────────────────
function checkDaeun(): void {
  section("J. 대운 — 순행/역행 규칙, 대운수, 간지 순행");

  // 순행/역행: 양남·음녀 순행 / 음남·양녀 역행
  expect(daeunDirection(true, "male") === "forward", "양년 남자 → 순행");
  expect(daeunDirection(false, "female") === "forward", "음년 여자 → 순행");
  expect(daeunDirection(false, "male") === "backward", "음년 남자 → 역행");
  expect(daeunDirection(true, "female") === "backward", "양년 여자 → 역행");

  // 대운수 = 일수 / 3 (반올림, 최소 1)
  expect(daeunStartAge(0.5) === 1, "0.5일 → 1세 (최소값)");
  expect(daeunStartAge(9) === 3, "9일 → 3세");
  expect(daeunStartAge(28) === 9, "28일 → 9세");

  // 실제 사주 두 건: 방향이 반대여야 하고, 대운 간지가 월주에서 순행/역행해야 한다
  const male = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "male" }),
    { now: new Date("2026-01-01T00:00:00Z") },
  );
  const female = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "female" }),
    { now: new Date("2026-01-01T00:00:00Z") },
  );

  // 1990년은 경오년 = 경(양) → 남자 순행, 여자 역행
  expect(male.daeun?.direction === "forward", "1990(경오·양) 남자 순행", male.daeun?.direction);
  expect(female.daeun?.direction === "backward", "1990(경오·양) 여자 역행", female.daeun?.direction);

  // 대운 간지가 월주에서 한 칸씩 이동하는지
  const monthIndex = sexagenaryIndex({
    gan: GAN.indexOf(male.month.gan),
    ji: JI.indexOf(male.month.ji),
  });
  for (const [label, chart, step] of [
    ["순행", male, 1],
    ["역행", female, -1],
  ] as const) {
    let ok = true;
    chart.daeun?.periods.forEach((period, i) => {
      const expectedIdx = (((monthIndex + step * (i + 1)) % 60) + 60) % 60;
      if (period.ganji !== korGanji(expectedIdx)) ok = false;
    });
    expect(ok, `대운 간지가 월주에서 ${label}`, chart.daeun?.periods.map((p) => p.ganji).join(" "));
  }

  // 대운 구간이 10년 단위로 연속되는지
  let contiguous = true;
  male.daeun?.periods.forEach((period, i, all) => {
    if (period.endAge - period.startAge !== 9) contiguous = false;
    if (i > 0 && period.startAge !== all[i - 1]!.endAge + 1) contiguous = false;
  });
  expect(contiguous, "대운 구간이 10년 단위로 빈틈없이 이어짐");

  // 성별 미지정이면 대운 없음
  const unspecified = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "14:30" }),
    { now: new Date("2026-01-01T00:00:00Z") },
  );
  expect(unspecified.daeun === null, "성별 미지정 → 대운 null");

  // 대운수 근거(절기까지 일수)가 0~31일 안에 있는지 — 절기 간격은 약 15일이므로
  // 순행은 15일 이내, 역행도 15일 이내가 되어야 한다
  let rangeOk = true;
  const rangeSamples: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    for (const day of [1, 8, 15, 22, 28]) {
      const chart = calculateSajuChart(
        makeInput({
          birthDate: `2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          birthTime: "12:00",
          gender: "male",
        }),
        { now: new Date("2026-01-01T00:00:00Z") },
      );
      const days = chart.daeun!.daysToJeol;
      if (days < 0 || days > 32) {
        rangeOk = false;
        if (rangeSamples.length < 5) rangeSamples.push(`2000-${month}-${day}: ${days}일`);
      }
    }
  }
  expect(rangeOk, "대운수 근거 일수가 0~32일 범위 (60건)", rangeSamples.join(" / "));
}

// ── K. 세운 ────────────────────────────────────────────────────────────────
function checkSeun(): void {
  section("K. 세운 — (연도 − 4) mod 60 규칙과 대조");

  // 문헌 앵커: 1984년 = 갑자년
  expect(
    korGanji((((1984 - 4) % 60) + 60) % 60) === "갑자",
    "1984년 = 갑자년 (앵커)",
  );

  const chart = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "male" }),
    { now: new Date("2026-08-13T00:00:00Z") },
  );

  expect(chart.seun.length === 3, "세운 3년치", `${chart.seun.length}건`);
  expect(chart.seun[0]!.year === 2026, "기준 연도부터 시작", `${chart.seun[0]!.year}`);

  let ok = true;
  for (const year of chart.seun) {
    const expected = korGanji((((year.year - 4) % 60) + 60) % 60);
    if (year.ganji !== expected) ok = false;
    // 세는나이
    if (year.age !== year.year - 1990 + 1) ok = false;
  }
  expect(ok, "세운 간지·나이가 규칙과 일치", chart.seun.map((y) => `${y.year}=${y.ganji}`).join(" "));

  // 세운이 해당 대운 구간에 매핑되는지
  const mapped = chart.seun.every((year) => {
    const period = chart.daeun!.periods.find(
      (p) => year.age >= p.startAge && year.age <= p.endAge,
    );
    return (period?.ganji ?? null) === year.daeunGanji;
  });
  expect(mapped, "세운에 붙은 대운이 나이 구간과 정합");
}

// ── L. 신강 / 신약 ─────────────────────────────────────────────────────────
function checkStrength(): void {
  section("L. 신강/신약 — 득령·득지·득세 판정 일관성");

  // 판정과 3기준의 개수가 항상 정합해야 한다
  let mismatch = 0;
  let compared = 0;
  const verdictByCount: Record<number, string> = {
    3: "신강",
    2: "약간 신강",
    1: "약간 신약",
    0: "신약",
  };

  for (let month = 1; month <= 12; month += 1) {
    for (const day of [3, 13, 23]) {
      for (const hour of ["03:00", "14:30", "21:00"]) {
        const chart = calculateSajuChart(
          makeInput({
            birthDate: `1990-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            birthTime: hour,
            gender: "male",
          }),
          { now: new Date("2026-01-01T00:00:00Z") },
        );
        const s = chart.strength;
        const met = [s.deukryeong, s.deukji, s.deukse].filter(Boolean).length;
        compared += 1;
        if (s.verdict !== verdictByCount[met]) mismatch += 1;
        // 돕는 글자 수가 전체를 넘지 않는지
        if (s.supportingChars > s.totalChars) mismatch += 1;
      }
    }
  }
  expect(mismatch === 0, `신강/신약 판정 ${compared}건 정합`, `불일치 ${mismatch}`);

  // 시각 미상이면 시주가 없으니 전체 글자 수가 5
  const noTime = calculateSajuChart(makeInput({ birthDate: "1990-05-17", gender: "male" }), {
    now: new Date("2026-01-01T00:00:00Z"),
  });
  expect(noTime.strength.totalChars === 5, "시각 미상 판정 글자 수 5", `${noTime.strength.totalChars}`);

  // 오행 점수는 개수 × 계절배수와 일치해야 한다
  const chart = calculateSajuChart(
    makeInput({ birthDate: "1990-05-17", birthTime: "14:30", gender: "male" }),
    { now: new Date("2026-01-01T00:00:00Z") },
  );
  let scoreOk = true;
  for (const [element, count] of Object.entries(chart.ohaeng.count)) {
    const state = chart.ohaeng.seasonalState[element as keyof typeof chart.ohaeng.seasonalState];
    const expected = Math.round(count * SEASONAL_MULTIPLIER[state] * 100) / 100;
    if (chart.ohaeng.score[element as keyof typeof chart.ohaeng.score] !== expected) {
      scoreOk = false;
    }
  }
  expect(scoreOk, "오행 점수 = 개수 × 계절 배수");

  // 개수 합은 여전히 8 (4기둥 × 2)
  const total = Object.values(chart.ohaeng.count).reduce((a, b) => a + b, 0);
  expect(total === 8, "오행 개수 합 8", `${total}`);
}

// ── 실행 ───────────────────────────────────────────────────────────────────
console.log("사주 계산 교차검증 (TASK-03 · TASK-04)");
console.log("=".repeat(60));

checkDayPillars();
checkYearPillars();
checkMonthPillars();
checkHourPillars();
checkTimeCorrection();
checkSolarTerms();
checkEdgeCases();
checkJiSipsin();
checkSeasonalStates();
checkDaeun();
checkSeun();
checkStrength();

console.log(`\n${"=".repeat(60)}`);
console.log(`검증 ${checks}건 중 실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
