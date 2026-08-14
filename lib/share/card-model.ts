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
  /**
   * 세력의 상대 비중 (0~1). 화면의 오행 막대와 **같은 시각 언어**를 카드에도 두기 위한
   * 값이다 (TASK-25).
   *
   * 근거는 `score`(개수 × 계절 배수)인데 그 배수는 **우리 관례**라 절대 수치가 아니다.
   * 그래서 화면과 똑같이 **길이로만 쓰고 숫자로 찍지 않는다.**
   */
  weight: number;
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

  const scores = chart.ohaeng.score;
  const maxScore = Math.max(...Object.values(scores), 1);
  const badges: ShareCardBadge[] = Object.entries(chart.ohaeng.count).map(([element, count]) => ({
    element,
    count,
    state: chart.ohaeng.seasonalState[element as keyof typeof chart.ohaeng.seasonalState],
    weight: scores[element as keyof typeof scores] / maxScore,
  }));

  const mark = (met: boolean) => (met ? "○" : "×");
  const strength = chart.strength;

  const notes = [
    // "신강·신약 신약" 처럼 겹쳐 읽히므로 판정만 앞세운다.
    `${strength.verdict} — 득령 ${mark(strength.deukryeong)} · 득지 ${mark(
      strength.deukji,
    )} · 득세 ${mark(strength.deukse)}`,
    // 현재 대운은 나이 구간을 빼고 간지·십신만 쓴다 (위 주석 참고).
    currentDaeunLabel(chart),
    TAIL_NOTE[readingType](chart),
  ].filter((note): note is string => note !== null);

  return {
    typeLabel: READING_TYPE_LABEL[readingType],
    pillars,
    badges,
    headline: `${chart.saencho}띠 · ${chart.ohaeng.season}에 태어난 사주`,
    chips: CHIPS[readingType](chart),
    notes,
    footer: SITE,
  };
}

/**
 * 유형별 판정 칩 — **`Record` 로 두어 유형을 늘리면 컴파일이 막히게 한다.**
 * 삼항으로 두면 새 유형이 조용히 다른 유형의 칩을 달고 나간다.
 *
 * 칩은 카드 폭에 맞춰 **항상 두 개**다.
 */
const CHIPS: Record<ReadingType, (chart: SajuChart) => [string, string]> = {
  general: (chart) => [`${chart.ohaeng.strongest} 기운이 강함`, chart.strength.verdict],
  diet: (chart) => [`한열 ${chart.constitution.thermal}`, chart.constitution.gainPattern],
  // 원인 유형 (TASK-44): 걸리는 지점이 첫 칩이다 — 이 유형이 답하는 질문이 그것이다.
  "gain-cause": (chart) => [
    `${chart.constitution.gainSite}에서 걸림`,
    chart.constitution.gainPattern,
  ],
  "diet-method": (chart) => [
    chart.constitution.dietApproach,
    chart.constitution.movementKind,
  ],
};

/**
 * 근거 줄 마지막 항목도 유형별로 다르다.
 *
 * diet 에 접근 순서를 **칩이 아니라 여기** 넣은 이유 (TASK-24): 칩은 두 개로 고정돼 있고
 * 그 자리는 체질 자체(한열·패턴)가 쓴다. 접근 순서는 대사 기조에서 파생된 결론이라
 * 원래 이 줄에 있던 대사 기조와 같은 자리에 두는 것이 맞다. 둘을 함께 적어 두면
 * "무엇에서 이 순서가 나왔는지" 가 카드에서도 보인다.
 */
const TAIL_NOTE: Record<ReadingType, (chart: SajuChart) => string> = {
  general: (chart) => `${chart.ohaeng.season} 기세 기준 · ${chart.ohaeng.strongest} 왕(旺)`,
  diet: (chart) =>
    `방식 ${chart.constitution.dietApproach} · 대사 기조 ${chart.constitution.metabolism}`,
  // 칩이 걸리는 지점·패턴을 쓰므로 여기는 그 둘이 어디서 나왔는지를 밝힌다.
  "gain-cause": (chart) =>
    `대사 기조 ${chart.constitution.metabolism} · 십신 우세 ${chart.constitution.dominantGroup}`,
  // 칩이 방식·종류를 쓰므로 여기는 그 둘이 어디서 나왔는지를 밝힌다.
  "diet-method": (chart) =>
    `대사 기조 ${chart.constitution.metabolism} · 걸리는 지점 ${chart.constitution.gainSite}`,
};

/** 성별 미지정이면 대운이 없다 (순행·역행을 정할 수 없다) → 줄을 넣지 않는다. */
function currentDaeunLabel(chart: SajuChart): string | null {
  const currentAge = chart.seun[0]?.age;
  if (!chart.daeun || currentAge === undefined) return null;

  const period = chart.daeun.periods.find(
    (candidate) => currentAge >= candidate.startAge && currentAge <= candidate.endAge,
  );
  return period ? `현재 대운 ${period.ganji} · ${period.sipsin}` : null;
}
