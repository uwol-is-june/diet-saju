import "server-only";
import { Lunar, Solar } from "lunar-javascript";
import {
  GAN_TO_OHAENG,
  JI_TO_OHAENG,
  ganjiToKorean,
  ohaengToKorean,
  saenchoToKorean,
  sipsinToKorean,
} from "./hanja";
import type { Pillar, SajuChart, SajuInput } from "./schema";

/**
 * 만세력 계산은 lunar-javascript(절기 기반 EightChar)에 위임하고,
 * 이 모듈은 "한글화 + 서비스 도메인 형태로 정규화"만 담당한다.
 *
 * 현재 한계 (개선은 docs/TASK.md TASK-03 참고)
 * - 진태양시(경도 보정, 한국 표준시 -30분 전후) 미적용
 * - 야자시/조자시 구분 미적용
 * - 대운/세운 미산출
 */

const HOUR_UNKNOWN_DEFAULT = { hour: 12, minute: 0 };

export function calculateSajuChart(input: SajuInput): SajuChart {
  const [year, month, day] = input.birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];

  const timeUnknown = !input.birthTime;
  const [hour, minute] = timeUnknown
    ? [HOUR_UNKNOWN_DEFAULT.hour, HOUR_UNKNOWN_DEFAULT.minute]
    : (input.birthTime!.split(":").map(Number) as [number, number]);

  // 음력 입력이면 양력으로 환산한 뒤 계산한다.
  const solar =
    input.calendar === "lunar"
      ? Lunar.fromYmdHms(year, month, day, hour, minute, 0).getSolar()
      : Solar.fromYmdHms(year, month, day, hour, minute, 0);

  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const yearPillar = toPillar(ec.getYear(), ec.getYearWuXing(), ec.getYearShiShenGan());
  const monthPillar = toPillar(ec.getMonth(), ec.getMonthWuXing(), ec.getMonthShiShenGan());
  const dayPillar = toPillar(ec.getDay(), ec.getDayWuXing(), "일간");
  const hourPillar = timeUnknown
    ? null
    : toPillar(ec.getTime(), ec.getTimeWuXing(), ec.getTimeShiShenGan());

  const ganjiChars = [ec.getYear(), ec.getMonth(), ec.getDay()]
    .concat(timeUnknown ? [] : [ec.getTime()])
    .join("");

  return {
    solarDate: `${pad(solar.getYear(), 4)}-${pad(solar.getMonth(), 2)}-${pad(solar.getDay(), 2)}`,
    lunarDate: `${pad(lunar.getYear(), 4)}-${pad(Math.abs(lunar.getMonth()), 2)}-${pad(lunar.getDay(), 2)}${lunar.getMonth() < 0 ? " (윤달)" : ""}`,
    timeUnknown,
    year: yearPillar,
    month: monthPillar,
    day: dayPillar,
    hour: hourPillar,
    saencho: saenchoToKorean(lunar.getYearShengXiao()),
    ilgan: dayPillar.gan,
    ohaengCount: countOhaeng(ganjiChars),
  };
}

function toPillar(ganji: string, wuxing: string, sipsin: string): Pillar {
  const korean = ganjiToKorean(ganji);
  return {
    ganji: korean,
    gan: korean.slice(0, 1),
    ji: korean.slice(1, 2),
    ohaeng: ohaengToKorean(wuxing),
    sipsin: sipsinToKorean(sipsin),
  };
}

/** 원국 간지 전체에서 오행 개수를 센다. */
function countOhaeng(ganjiChars: string): Record<string, number> {
  const counts: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const ch of ganjiChars) {
    const element = GAN_TO_OHAENG[ch] ?? JI_TO_OHAENG[ch];
    if (element) counts[element] += 1;
  }
  return counts;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}
