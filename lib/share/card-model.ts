import { verdictOf } from "../reading/verdict";
import type { ReadingType, SajuChart } from "../saju/schema";

/**
 * 공유 카드에 무엇을 넣을지 정한다. 그리기(캔버스)와 갈라 둔 것은 **무엇을 노출하는지가
 * 판단이 필요한 부분**이고 그 판단만 따로 테스트하기 위해서다.
 *
 * ## 카드에 뜨는 것은 판정 한 줄이다 (TASK-116)
 *
 * 예전 카드는 면적의 8할이 **사주팔자 네 기둥 · 신강신약 · 득령/득지/득세 · 대운 간지 ·
 * 십신**이었다. 두 가지가 틀렸다.
 *
 * 1. **읽을 수 없다.** 카드를 받아 든 사람은 자기 사주도 모르는 제3자다. TASK-113 이 같은
 *    이유로 본문에서 걷어낸 낱말들이 카드에서는 가장 큰 자리를 차지하고 있었다.
 * 2. **네 기둥은 사실상 생년월일시다.** 연·월·일·시주가 정해지면 60년 주기 안에서 날짜가
 *    거의 유일하게 특정되고, 띠와 대운 간지가 연도를 좁힌다. `생년월일을 찍지 않는다` 를
 *    형식으로만 지키고 있었다 — **날짜 문자열이 아니라 역산 가능성이 기준이다.**
 *
 * **그래서 간지를 한 자도 싣지 않는다** (`card-model.test.ts` 가 막는다). 남는 것은 화면
 * 콜아웃과 **같은 값**(`lib/reading/verdict.ts`)과, 개수만으로는 날짜를 특정할 수 없는
 * 오행 막대다.
 *
 * **풀이 본문도 넣지 않는다** — 길고, 카드가 읽히지 않으며, 맥락 없이 퍼지면 오해를 만든다.
 */

export interface ShareCardBadge {
  element: string;
  count: number;
  state: string;
  /**
   * 세력의 상대 비중 (0~1). 화면의 오행 막대와 **같은 시각 언어**를 카드에도 두는 값이다.
   * 근거가 되는 배수는 **우리 관례**라 **길이로만 쓰고 숫자로 찍지 않는다.**
   */
  weight: number;
}

export interface ShareCardModel {
  /** 아래 라벨이 무엇에 대한 답인지 말하는 줄 (유형마다 다르다) */
  eyebrow: string;
  /** 카드의 주인공 — 판정 라벨 */
  label: string;
  /** 라벨의 뜻을 생활어로 옮긴 한 줄 */
  basis: string;
  /** `public/verdict/<slug>.jpg`. 사진이 없는 내부 유형은 `null` 이고 연한 면으로 그린다. */
  photo: string | null;
  badges: ShareCardBadge[];
  /** 사진 아래 한 줄. **날짜가 아니라 띠와 계절까지만** 쓴다. */
  headline: string;
  footer: string;
}

const SITE = "diet-saju.vercel.app";

export function buildShareCardModel(chart: SajuChart, readingType: ReadingType): ShareCardModel {
  const scores = chart.ohaeng.score;
  const maxScore = Math.max(...Object.values(scores), 1);
  const badges: ShareCardBadge[] = Object.entries(chart.ohaeng.count).map(([element, count]) => ({
    element,
    count,
    state: chart.ohaeng.seasonalState[element as keyof typeof chart.ohaeng.seasonalState],
    weight: scores[element as keyof typeof scores] / maxScore,
  }));

  /*
    **화면 콜아웃과 같은 함수를 부른다.** 값을 여기서 다시 고르면 저장된 이미지가 방금 본
    화면과 다른 말을 한다. 판정이 성립하지 않는 경우(대운 없는 `decade`)는 화면과 똑같이
    비워 두고, 카드는 눈썹 줄 없이 원국 요약만 남는다.
  */
  const verdict = verdictOf(chart, readingType);

  return {
    eyebrow: verdict?.eyebrow ?? "",
    label: verdict?.label ?? "",
    basis: verdict?.basis ?? "",
    photo: verdict?.photo ?? null,
    badges,
    headline: `${chart.saencho}띠 · ${chart.ohaeng.season}에 태어난 사주`,
    footer: SITE,
  };
}
