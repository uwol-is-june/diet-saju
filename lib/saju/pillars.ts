import "server-only";
import { Lunar, Solar } from "lunar-javascript";
import {
  analyzeDaeun,
  analyzeOhaeng,
  analyzeSeun,
  analyzeStrength,
  daeunDirection,
  type DaeunAnalysis,
} from "./analysis";
import { analyzeConstitution } from "./constitution";
import {
  ganjiToKorean,
  hourGanIndex,
  hourToJiIndex,
  isYang,
  jiAnimal,
  jiSipsin,
  parseGanjiHanja,
  pillarOhaeng,
  sexagenaryIndex,
  sipsinOf,
  type GanjiIndex,
} from "./ganji";
import type { Pillar, SajuChart, SajuInput } from "./schema";
import { resolveBirthInstant, type Clock } from "./time-correction";

/**
 * 사주 원국 계산.
 *
 * lunar-javascript 를 쓰지만 **그대로 믿지 않는다.** 실측으로 확인한 세 가지 문제를
 * 이 모듈이 보정한다 (근거는 docs/saju-validation.md).
 *
 * 1. 절기를 베이징 시간(UTC+8)으로 계산한다 → 한국 시각을 그대로 넣으면 월주 경계가
 *    1시간 어긋난다. 그래서 년주·월주는 출생 시각을 **베이징 벽시계로 변환해** 넣는다.
 * 2. `sect` 설정이 일주에만 적용되고 시주에는 반영되지 않아 학파가 섞인다
 *    (sect=2 인데 시주는 23시 기준 일간을 쓴다) → 시주는 우리가 직접 계산한다.
 * 3. 진태양시·서머타임 개념이 없다 → 일주·시주는 보정된 **지방시**로 넣는다.
 */

/** 출생시각을 모를 때 쓰는 기준 시각. 시주는 어차피 제외한다. */
const HOUR_UNKNOWN = { hour: 12, minute: 0 } as const;

/**
 * 대운수 계산에 쓰는 12절(節). 12기(氣)는 쓰지 않는다.
 *
 * 라이브러리 절기 테이블은 **간체**(`惊蛰`, `芒种`)를 쓰고, 인접 연도 항목은 로마자 키
 * (`LI_CHUN` 등)로 중복 제공한다. 어느 표기로 오든 잡히도록 전부 넣는다.
 */
const JEOL_KEYS = new Set([
  "立春", "惊蛰", "驚蟄", "清明", "立夏", "芒种", "芒種", "小暑",
  "立秋", "白露", "寒露", "立冬", "大雪", "小寒",
  "LI_CHUN", "JING_ZHE", "QING_MING", "LI_XIA", "MANG_ZHONG", "XIAO_SHU",
  "LI_QIU", "BAI_LU", "HAN_LU", "LI_DONG", "DA_XUE", "XIAO_HAN",
]);

export interface CalculateOptions {
  /** 세운 기준 시각. 검증에서 결과를 고정하려면 명시한다. 기본값은 현재. */
  now?: Date;
}

export function calculateSajuChart(
  input: SajuInput,
  options: CalculateOptions = {},
): SajuChart {
  const [year, month, day] = input.birthDate.split("-").map(Number) as [number, number, number];

  const timeUnknown = !input.birthTime;
  const [hour, minute] = timeUnknown
    ? [HOUR_UNKNOWN.hour, HOUR_UNKNOWN.minute]
    : (input.birthTime!.split(":").map(Number) as [number, number]);

  // ── 1. 입력을 양력 벽시계로 정규화 ──────────────────────────────────────
  const solarWallClock = toSolarWallClock({
    year,
    month,
    day,
    hour,
    minute,
    isLunar: input.calendar === "lunar",
    isLeapMonth: input.isLeapMonth === true,
  });

  // ── 2. 시각 보정 ────────────────────────────────────────────────────────
  // 시각을 모르면 정오를 임시로 쓰는 것이므로 보정해도 의미가 없다. 보정을 끈다.
  const solarTimeMode = timeUnknown ? "standard" : input.solarTimeMode;
  const instant = resolveBirthInstant(solarWallClock, {
    mode: solarTimeMode,
    longitude: input.longitude,
  });

  // ── 3. 년주·월주 — 절기 판정이므로 라이브러리의 기준 시간대(UTC+8)로 비교 ──
  const eightCharForSeason = eightCharAt(instant.beijingClock);
  const yearGanji = parseGanjiHanja(eightCharForSeason.getYear());
  const monthGanji = parseGanjiHanja(eightCharForSeason.getMonth());

  // ── 4. 일주 — 보정된 지방시 + 자시 학파 ──────────────────────────────────
  const eightCharForDay = eightCharAt(instant.localClock);
  eightCharForDay.setSect(input.dayBoundary === "jasi" ? 1 : 2);
  const dayGanji = parseGanjiHanja(eightCharForDay.getDay());

  // ── 5. 시주 — 일간과 시지에서 직접 계산 (학파 혼용 방지) ─────────────────
  const hourGanji: GanjiIndex | null = timeUnknown
    ? null
    : (() => {
        const ji = hourToJiIndex(instant.localClock.hour);
        return { gan: hourGanIndex(dayGanji.gan, ji), ji };
      })();

  const pillars = [yearGanji, monthGanji, dayGanji, ...(hourGanji ? [hourGanji] : [])];
  const ilgan = dayGanji.gan;

  // ── 6. 파생 근거 ────────────────────────────────────────────────────────
  const ohaeng = analyzeOhaeng(pillars, monthGanji.ji);
  const strength = analyzeStrength({
    ilgan,
    year: yearGanji,
    month: monthGanji,
    day: dayGanji,
    hour: hourGanji,
  });

  // 체질 판정은 리딩 유형과 무관하게 원국에서 결정된다. 유형별로 다르게 계산하면
  // "같은 사주는 같은 판정" 이 깨진다. diet 프롬프트만 이 값을 근거로 쓴다.
  const constitution = analyzeConstitution({
    ilgan,
    year: yearGanji,
    month: monthGanji,
    day: dayGanji,
    hour: hourGanji,
    ohaeng,
    strength,
  });

  // 대운은 순행/역행을 성별로 정하므로 성별 미지정이면 낼 수 없다.
  const daeun =
    input.gender === "unspecified"
      ? null
      : computeDaeun({
          ilgan,
          monthGanji,
          birthUtcMs: instant.utcMs,
          direction: daeunDirection(isYang(yearGanji.gan), input.gender),
        });

  const referenceYear = (options.now ?? new Date()).getFullYear();
  const seun = analyzeSeun({
    ilgan,
    birthYear: Number(formatDate(solarWallClock).slice(0, 4)),
    fromYear: referenceYear,
    daeun: daeun ?? undefined,
  });

  return {
    solarDate: formatDate(solarWallClock),
    lunarDate: formatLunarDate(solarWallClock),
    timeUnknown,
    year: toPillar(yearGanji, ilgan),
    month: toPillar(monthGanji, ilgan),
    day: { ...toPillar(dayGanji, ilgan), sipsin: "일간" },
    hour: hourGanji ? toPillar(hourGanji, ilgan) : null,
    saencho: jiAnimal(yearGanji.ji),
    ilgan: ganjiToKorean(dayGanji).slice(0, 1),
    ohaeng,
    strength,
    constitution,
    daeun,
    seun,
    timeCorrection: {
      mode: solarTimeMode,
      dayBoundary: input.dayBoundary,
      correctionMinutes: instant.correctionMinutes,
      dstMinutes: instant.dstMinutes,
      standardOffsetMinutes: instant.standardOffsetMinutes,
      appliedTime: timeUnknown
        ? null
        : `${pad(instant.localClock.hour, 2)}:${pad(instant.localClock.minute, 2)}`,
      appliedDateShifted: formatDate(instant.localClock) !== formatDate(solarWallClock),
    },
  };
}

// ── 내부 ────────────────────────────────────────────────────────────────────

interface RawInput extends Clock {
  isLunar: boolean;
  isLeapMonth: boolean;
}

/** 음력 입력이면 양력으로 환산한다. 윤달은 음수 월로 지정한다(라이브러리 규약). */
function toSolarWallClock(raw: RawInput): Clock {
  if (!raw.isLunar) {
    return { year: raw.year, month: raw.month, day: raw.day, hour: raw.hour, minute: raw.minute };
  }

  const lunarMonth = raw.isLeapMonth ? -raw.month : raw.month;
  const solar = Lunar.fromYmdHms(
    raw.year,
    lunarMonth,
    raw.day,
    raw.hour,
    raw.minute,
    0,
  ).getSolar();

  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    hour: raw.hour,
    minute: raw.minute,
  };
}

function eightCharAt(clock: Clock) {
  return Solar.fromYmdHms(clock.year, clock.month, clock.day, clock.hour, clock.minute, 0)
    .getLunar()
    .getEightChar();
}

function toPillar(ganji: GanjiIndex, ilgan: number): Pillar {
  const korean = ganjiToKorean(ganji);
  return {
    ganji: korean,
    gan: korean.slice(0, 1),
    ji: korean.slice(1, 2),
    ohaeng: pillarOhaeng(ganji),
    sipsin: sipsinOf(ilgan, ganji.gan),
    jiSipsin: jiSipsin(ilgan, ganji.ji),
  };
}

// ── 대운 ────────────────────────────────────────────────────────────────────
interface DaeunComputeInput {
  ilgan: number;
  monthGanji: GanjiIndex;
  birthUtcMs: number;
  direction: "forward" | "backward";
}

/**
 * 대운수는 출생시점부터 절기까지의 거리로 정한다.
 * 순행이면 **다음 절(節)까지**, 역행이면 **이전 절부터**의 일수를 3으로 나눈다.
 */
function computeDaeun(input: DaeunComputeInput): DaeunAnalysis {
  const jeolTimes = collectJeolInstants(input.birthUtcMs);

  const next = jeolTimes.find((ms) => ms > input.birthUtcMs);
  const previous = [...jeolTimes].reverse().find((ms) => ms <= input.birthUtcMs);

  const boundary = input.direction === "forward" ? next : previous;
  if (boundary === undefined) {
    // 절기 테이블 범위를 벗어난 경우 — 있어서는 안 되지만 조용히 틀리는 것보다 낫다.
    throw new Error("대운수 계산 실패: 인접 절기를 찾지 못했습니다");
  }

  const daysToJeol = Math.abs(boundary - input.birthUtcMs) / 86_400_000;

  return analyzeDaeun({
    ilgan: input.ilgan,
    monthSexagenary: sexagenaryIndex(input.monthGanji),
    direction: input.direction,
    daysToJeol,
  });
}

/**
 * 출생시점 주변의 12절 시각을 절대 시각(ms)으로 모아 정렬해 돌려준다.
 *
 * 라이브러리 절기 테이블은 기준일 주변 1년여만 담고 있어, 연말·연초 출생자는
 * 한 테이블로 앞뒤 절기를 모두 찾지 못한다. 앞뒤로 45일씩 옮긴 기준일에서도 모아 합친다.
 */
function collectJeolInstants(birthUtcMs: number): number[] {
  const found = new Set<number>();

  for (const offsetDays of [-45, 0, 45]) {
    const base = new Date(birthUtcMs + offsetDays * 86_400_000);
    const table = Solar.fromYmdHms(
      base.getUTCFullYear(),
      base.getUTCMonth() + 1,
      base.getUTCDate(),
      12,
      0,
      0,
    )
      .getLunar()
      .getJieQiTable();

    for (const [key, entry] of Object.entries(table)) {
      if (!entry || !JEOL_KEYS.has(key)) continue;
      // 라이브러리 절기 시각은 베이징 시간(UTC+8)이다.
      found.add(Date.parse(`${entry.toYmdHms().replace(" ", "T")}+08:00`));
    }
  }

  return [...found].sort((a, b) => a - b);
}

function formatDate(clock: Clock): string {
  return `${pad(clock.year, 4)}-${pad(clock.month, 2)}-${pad(clock.day, 2)}`;
}

/** 표시용 음력 날짜. 윤달이면 명시한다. */
function formatLunarDate(clock: Clock): string {
  const lunar = Solar.fromYmdHms(clock.year, clock.month, clock.day, 12, 0, 0).getLunar();
  const month = lunar.getMonth();
  const leap = month < 0 ? "윤" : "";
  return `${pad(lunar.getYear(), 4)}-${leap}${pad(Math.abs(month), 2)}-${pad(lunar.getDay(), 2)}`;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}
