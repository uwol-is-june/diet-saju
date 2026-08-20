/**
 * 출생 시각 보정. 시계시는 세 가지 이유로 실제 태양 위치와 어긋난다.
 *
 * 1. 경도차 — 표준시는 동경 135°(또는 127.5°) 기준이지만 서울은 약 127°다.
 * 2. 표준자오선 변경 — 1954-03-21 ~ 1961-08-09 는 동경 127.5°(UTC+8:30).
 * 3. 서머타임 — 1948~51, 1955~60, 1987~88.
 *
 * **2·3 은 표를 손으로 만들지 않고 Node 내장 IANA tz 데이터(Asia/Seoul)에서 가져온다** —
 * 손으로 옮긴 표보다 정확하고 tzdata 갱신을 자동으로 따른다 (`docs/saju-validation.md`).
 *
 * 순수 계산 모듈 — 외부 I/O 없음.
 */

export const KOREA_TIME_ZONE = "Asia/Seoul";

/** 서울 경도 (도). 출생지를 모를 때의 기본값. */
export const SEOUL_LONGITUDE = 126.9784;

/** 중국 표준시 자오선. lunar-javascript 의 절기 계산 기준이다. */
const BEIJING_OFFSET_MINUTES = 480;

/** 시각 보정 방식 */
export type SolarTimeMode =
  /** 보정하지 않음 — 시계시 그대로 */
  | "standard"
  /** 경도 보정만 (지방 평균태양시). 한국 만세력 다수 관행 */
  | "longitude"
  /** 경도 + 균시차 (엄밀한 진태양시) */
  | "true";

export interface Clock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface BirthInstant {
  /** 절대 시각 */
  utcMs: number;
  /** 출생 시점 한국 표준시의 실제 UTC 오프셋(분). 서머타임·자오선 변경 반영 */
  actualOffsetMinutes: number;
  /** 해당 시기 표준자오선에 따른 오프셋(분) */
  standardOffsetMinutes: number;
  /** 서머타임으로 앞당겨진 분 (보통 0 또는 60) */
  dstMinutes: number;
  /** 절기(년주·월주) 판정용 — lunar-javascript 의 기준 시간대(UTC+8)로 표현한 시각 */
  beijingClock: Clock;
  /** 일주·시주 판정용 — 보정 방식이 적용된 지방시 */
  localClock: Clock;
  /** 시계시 대비 총 보정량(분). 음수면 앞당겨진 것 */
  correctionMinutes: number;
}

/**
 * 한국 표준자오선 이력.
 *
 * `from` 은 해당 자오선이 적용되기 시작한 UTC 시각.
 * 1908 년 이전은 서울 지방 평균시(약 UTC+8:27:52)를 썼다.
 */
const MERIDIAN_HISTORY: readonly { from: number; offsetMinutes: number; label: string }[] = [
  { from: Date.UTC(1961, 7, 9, 15, 0), offsetMinutes: 540, label: "동경 135° (UTC+9)" },
  { from: Date.UTC(1954, 2, 20, 15, 30), offsetMinutes: 510, label: "동경 127.5° (UTC+8:30)" },
  { from: Date.UTC(1911, 11, 31, 15, 0), offsetMinutes: 540, label: "동경 135° (UTC+9)" },
  { from: Date.UTC(1908, 2, 31, 15, 30), offsetMinutes: 510, label: "동경 127.5° (UTC+8:30)" },
  { from: Number.NEGATIVE_INFINITY, offsetMinutes: 508, label: "서울 지방 평균시" },
];

function standardOffsetAt(utcMs: number): number {
  for (const era of MERIDIAN_HISTORY) {
    if (utcMs >= era.from) return era.offsetMinutes;
  }
  return 540;
}

/** 특정 절대 시각에서 해당 시간대의 UTC 오프셋(분)을 구한다. */
export function zoneOffsetMinutes(utcMs: number, timeZone = KOREA_TIME_ZONE): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const { type, value } of formatter.formatToParts(new Date(utcMs))) {
    parts[type] = value;
  }

  // Intl 은 자정을 "24" 로 줄 수 있다.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );

  return Math.round((asIfUtc - utcMs) / 60_000);
}

/**
 * 벽시계 시각을 절대 시각으로 바꾼다. 오프셋이 시각에 의존하므로 한 번 추정한 뒤
 * 재확인한다 (서머타임 전환 경계에서 첫 추정이 틀릴 수 있다).
 */
export function wallClockToUtc(clock: Clock, timeZone = KOREA_TIME_ZONE): number {
  const naive = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, 0);
  const firstGuess = zoneOffsetMinutes(naive, timeZone);
  let utcMs = naive - firstGuess * 60_000;

  const verified = zoneOffsetMinutes(utcMs, timeZone);
  if (verified !== firstGuess) {
    utcMs = naive - verified * 60_000;
  }
  return utcMs;
}

/** 절대 시각을 임의 오프셋(분)의 벽시계로 표현한다. */
export function utcToClock(utcMs: number, offsetMinutes: number): Clock {
  const shifted = new Date(utcMs + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/**
 * 균시차(均時差) — 평균태양시와 진태양시의 차이. 연중 약 ±16분 진동한다.
 *
 * NOAA 근사식. 오차 약 0.1분으로 사주 판정 목적에는 충분하다.
 */
export function equationOfTimeMinutes(utcMs: number): number {
  const date = new Date(utcMs);
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((utcMs - startOfYear) / 86_400_000) + 1;
  const fractionalHour = date.getUTCHours() + date.getUTCMinutes() / 60;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (fractionalHour - 12) / 24);

  return (
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  );
}

export interface ResolveOptions {
  mode: SolarTimeMode;
  /** 출생지 경도(도). 기본 서울 */
  longitude?: number;
}

/**
 * 한국 벽시계 기준 출생 시각을 받아, 사주 판정에 필요한 두 개의 시각 표현을 만든다.
 *
 * - `beijingClock`: 절기 판정용. lunar-javascript 가 절기를 UTC+8 로 계산하므로
 *   같은 좌표계에서 비교해야 월주 경계가 어긋나지 않는다.
 * - `localClock`: 일주·시주 판정용. 보정 방식에 따른 지방시.
 */
export function resolveBirthInstant(
  wallClock: Clock,
  options: ResolveOptions,
): BirthInstant {
  const utcMs = wallClockToUtc(wallClock);
  const actualOffsetMinutes = zoneOffsetMinutes(utcMs);
  const standardOffsetMinutes = standardOffsetAt(utcMs);
  const dstMinutes = actualOffsetMinutes - standardOffsetMinutes;

  const longitude = options.longitude ?? SEOUL_LONGITUDE;

  let rawOffsetMinutes: number;
  if (options.mode === "standard") {
    rawOffsetMinutes = actualOffsetMinutes;
  } else {
    // 경도 1도 = 4분
    rawOffsetMinutes = longitude * 4;
    if (options.mode === "true") {
      rawOffsetMinutes += equationOfTimeMinutes(utcMs);
    }
  }

  // 분 단위로 한 번만 반올림한다.
  // 소수를 그대로 두면 표시 시각이 절사되어 correctionMinutes 와 1분 어긋나 보인다
  // (예: −92분인데 14:30 → 12:57). 시진 판정에 미치는 영향은 최대 30초로 무의미하다.
  const localOffsetMinutes = Math.round(rawOffsetMinutes);

  return {
    utcMs,
    actualOffsetMinutes,
    standardOffsetMinutes,
    dstMinutes,
    beijingClock: utcToClock(utcMs, BEIJING_OFFSET_MINUTES),
    localClock: utcToClock(utcMs, localOffsetMinutes),
    correctionMinutes: localOffsetMinutes - actualOffsetMinutes,
  };
}
