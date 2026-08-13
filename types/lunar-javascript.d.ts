/**
 * lunar-javascript 는 타입 정의를 제공하지 않는다.
 * 이 프로젝트에서 실제로 사용하는 표면만 최소로 선언한다.
 * 새 API 를 쓰게 되면 여기에 추가할 것.
 */
declare module "lunar-javascript" {
  export class EightChar {
    /**
     * 야자시 학파 설정.
     * 1 = 23:00 부터 다음날 일주 (자시파/중국식)
     * 2 = 자정부터 다음날 일주 (야자시·조자시 구분). 기본값
     *
     * 주의: sect 는 **일주에만** 적용된다. 시주(timeGanIndex)는 라이브러리 내부에서
     * 항상 23시 기준 일간으로 계산되므로 sect=2 에서는 일주와 시주의 학파가 어긋난다.
     * 그래서 이 프로젝트는 시주를 `lib/saju/ganji.ts` 에서 직접 계산한다.
     */
    setSect(sect: 1 | 2): void;
    getSect(): number;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearGan(): string;
    getYearZhi(): string;
    getMonthGan(): string;
    getMonthZhi(): string;
    getDayGan(): string;
    getDayZhi(): string;
    getTimeGan(): string;
    getTimeZhi(): string;
    getYearWuXing(): string;
    getMonthWuXing(): string;
    getDayWuXing(): string;
    getTimeWuXing(): string;
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getDayShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearShiShenZhi(): string[];
    getMonthShiShenZhi(): string[];
    getDayShiShenZhi(): string[];
    getTimeShiShenZhi(): string[];
  }

  /** 절기 시각. lunar-javascript 는 **베이징 시간(UTC+8)** 기준으로 계산한다. */
  export interface JieQiEntry {
    toYmdHms(): string;
  }

  export class Lunar {
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Lunar;
    getSolar(): Solar;
    getEightChar(): EightChar;
    /** 절기명(한자, 예: "立春") → 시각. 값은 베이징 시간이다. */
    getJieQiTable(): Record<string, JieQiEntry | undefined>;
    getYearShengXiao(): string;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toString(): string;
  }

  export class Solar {
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    toString(): string;
  }
}
