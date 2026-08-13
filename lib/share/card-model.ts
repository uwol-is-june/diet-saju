import { READING_TYPE_LABEL, type ReadingType, type SajuChart } from "../saju/schema";

/**
 * 공유 카드에 무엇을 넣을지 정한다 (TASK-10).
 *
 * 그리기(캔버스)와 분리한 이유는 **무엇을 노출하는지가 판단이 필요한 부분**이고,
 * 그 판단만 따로 테스트하고 싶기 때문이다.
 *
 * ## 생년월일을 카드에 찍지 않는다
 *
 * 이 카드는 사용자가 SNS 에 올리려고 만드는 이미지다. 날짜를 찍어 두면 공개 게시물에
 * 그대로 실린다. 그래서 **띠와 계절까지만** 넣고 정확한 날짜는 넣지 않는다.
 *
 * 사주팔자 자체가 생년월일시를 상당히 좁혀 준다는 점은 사실이고, 그건 "내 사주를 공유한다"
 * 는 행위에 내재한 것이라 사용자의 선택으로 둔다. 다만 우리가 **먼저 날짜를 찍어 줄 이유는
 * 없다.** 풀이 본문도 넣지 않는다 — 길고, 카드가 읽히지 않으며, AI 문장이라 맥락 없이
 * 퍼지면 오해를 만든다.
 */

export interface ShareCardPillar {
  label: string;
  ganji: string;
  sipsin: string;
}

export interface ShareCardBadge {
  element: string;
  count: number;
  state: string;
}

export interface ShareCardModel {
  /** 풀이 유형 이름 */
  typeLabel: string;
  pillars: ShareCardPillar[];
  badges: ShareCardBadge[];
  /** 카드 가운데 한 줄 요약 */
  headline: string;
  /** 유형별 판정 칩. diet 는 한열·패턴, general 은 최강 오행·신강신약 */
  chips: string[];
  /**
   * 칩 아래 근거 줄. **나이와 날짜를 넣지 않는다** — 대운 구간을 나이로 적으면
   * 출생 연도가 좁혀진다. 간지와 십신까지만 쓴다.
   */
  notes: string[];
  footer: string;
}

const SITE = "diet-saju.vercel.app";

export function buildShareCardModel(chart: SajuChart, readingType: ReadingType): ShareCardModel {
  const pillars: ShareCardPillar[] = [
    { label: "연주", pillar: chart.year },
    { label: "월주", pillar: chart.month },
    { label: "일주", pillar: chart.day },
    { label: "시주", pillar: chart.hour },
  ].map(({ label, pillar }) => ({
    label,
    // 시각 미상이면 시주가 없다. 임의로 채우지 않는다.
    ganji: pillar ? pillar.ganji : "미상",
    sipsin: pillar ? pillar.jiSipsin : "",
  }));

  const badges: ShareCardBadge[] = Object.entries(chart.ohaeng.count).map(([element, count]) => ({
    element,
    count,
    state: chart.ohaeng.seasonalState[element as keyof typeof chart.ohaeng.seasonalState],
  }));

  const chips =
    readingType === "diet"
      ? [`한열 ${chart.constitution.thermal}`, chart.constitution.gainPattern]
      : [`${chart.ohaeng.strongest} 기운이 강함`, chart.strength.verdict];

  const mark = (met: boolean) => (met ? "○" : "×");
  const strength = chart.strength;

  const notes = [
    // "신강·신약 신약" 처럼 겹쳐 읽히므로 판정만 앞세운다.
    `${strength.verdict} — 득령 ${mark(strength.deukryeong)} · 득지 ${mark(
      strength.deukji,
    )} · 득세 ${mark(strength.deukse)}`,
    // 현재 대운은 나이 구간을 빼고 간지·십신만 쓴다 (위 주석 참고).
    currentDaeunLabel(chart),
    readingType === "diet"
      ? `대사 기조 ${chart.constitution.metabolism}`
      : `${chart.ohaeng.season} 기세 기준 · ${chart.ohaeng.strongest} 왕(旺)`,
  ].filter((note): note is string => note !== null);

  return {
    typeLabel: READING_TYPE_LABEL[readingType],
    pillars,
    badges,
    headline: `${chart.saencho}띠 · ${chart.ohaeng.season}에 태어난 사주`,
    chips,
    notes,
    footer: SITE,
  };
}

/** 성별 미지정이면 대운이 없다 (순행·역행을 정할 수 없다) → 줄을 넣지 않는다. */
function currentDaeunLabel(chart: SajuChart): string | null {
  const currentAge = chart.seun[0]?.age;
  if (!chart.daeun || currentAge === undefined) return null;

  const period = chart.daeun.periods.find(
    (candidate) => currentAge >= candidate.startAge && currentAge <= candidate.endAge,
  );
  return period ? `현재 대운 ${period.ganji} · ${period.sipsin}` : null;
}
