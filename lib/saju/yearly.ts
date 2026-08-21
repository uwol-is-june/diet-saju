/**
 * 올해 운세 판정. 순수 함수 모듈 — **판정은 여기서 하고 LLM 은 서술만 한다**(운세는 LLM 이
 * 가장 즉흥적으로 흐르기 쉬운 영역이라 같은 사주에 다른 답이 나오면 점괘 뽑기가 된다).
 *
 * - **고전**: 세운 간지((연도−4) mod 60), 세운 천간·지지의 십신, 십신 5분류, 세운 오행을
 *   원국의 강약과 견주어 보는 방식 자체.
 * - **우리 관례**: 작용 3단계(채워 주는·겹치는·무던한), 동점 처리, 십신 그룹 → "그 해의 주제" 대응표.
 *
 * **단정적 예언을 하지 않는다.** 여기 문구는 사용자에게 인용되고 `yearly.test.ts` 가 사건
 * 예고·단정 어휘를 훑어 막는다 — **유형이 없어져도 이 검사를 지우지 않는다.**
 */
import type { ConstitutionAnalysis } from "./constitution";
import {
  ganOhaeng,
  jiOhaeng,
  sipsinGroup,
  type Ohaeng,
  type SipsinGroup,
  type Sipsin,
} from "./ganji";
import type { SeunYear } from "./analysis";

/** 세운 오행이 원국에 주는 작용 — **우리 관례**(3단계 표현) */
export type YearlyEffect = "채워 주는" | "겹치는" | "무던한";

export const EFFECT_NOTE: Record<YearlyEffect, string> = {
  "채워 주는":
    "올해 들어오는 기운이 원국에서 얇았던 쪽을 채워 준다. 미뤄 둔 일을 벌이기보다 부족했던 자리를 메우는 데 쓰면 남는 해다.",
  "겹치는":
    "올해 들어오는 기운이 이미 넘치던 쪽에 더해진다. 하던 방식을 더 세게 밀기보다 덜어내고 속도를 고르는 편이 낫다.",
  "무던한":
    "올해 기운이 원국의 넘치는 쪽도 얇은 쪽도 크게 건드리지 않는다. 외부 변수보다 스스로 정한 계획이 결과를 가른다.",
};

/**
 * **우리 관례**: 십신 우세 → 그 해의 주제. 고전 상의(象意)에서 끌어왔지만 축 자체는 이
 * 서비스가 만든 것이다.
 *
 * **이 축은 프롬프트로 나가지 않는다.** 작용(채워 주는·겹치는)과 달리 주제 라벨은 **생활 영역
 * 어휘**라 몸 이야기에 얹으면 겉돌고, 옮기려면 근거 없는 대응표가 필요하며 "압박이 늘어
 * 몸이 상한다" 류는 면책 고지가 막는 주장에 닿는다.
 *
 * **계산은 남겨 둔다** — 십신 그룹 판정 자체는 고전이라 생활 영역 유형이 생기면 그대로 쓴다.
 */
export const THEME_LABEL: Record<SipsinGroup, string> = {
  비겁: "경쟁과 독립",
  식상: "표현과 생산",
  재성: "활동과 결실",
  관성: "책임과 압박",
  인성: "학습과 정비",
};

export const THEME_NOTE: Record<SipsinGroup, string> = {
  비겁:
    "내 힘으로 밀고 나가는 쪽이 강해진다. 사람과 겨루는 자리가 늘어나므로, 이기는 쪽보다 오래 가는 쪽을 고르는 판단이 필요하다.",
  식상:
    "내놓고 만드는 힘이 강해진다. 표현하고 시작하기에는 좋지만 벌여 놓은 것을 거두는 힘은 따로 챙겨야 한다.",
  재성:
    "밖으로 움직이는 쪽이 강해진다. 일정과 씀씀이가 함께 늘기 쉬우므로 무엇을 남길지 미리 정해 두는 편이 좋다.",
  관성:
    "틀이 조여지는 구간이다. 맡는 몫과 책임이 늘어나므로 감당할 범위를 먼저 그어 두면 덜 흔들린다.",
  인성:
    "받아들이고 고르는 결이다. 새로 벌이기보다 배우고 정비하기에 맞는 해이며, 결정을 미루는 쪽으로 기울지 않게 기한을 정해 두면 좋다.",
};

export interface YearlyAnalysis {
  year: number;
  /** 세운 간지 (고전: (연도 − 4) mod 60) */
  ganji: string;
  /** 세운 천간·지지의 오행 */
  ohaeng: Ohaeng[];
  /** 세운 천간의 십신 — 그 해의 주제를 정하는 기준 */
  sipsin: Sipsin;
  /** 세운 지지의 십신 (지장간 본기) */
  jiSipsin: Sipsin;
  /** 올해가 속한 대운 간지. 성별 미지정이면 null */
  daeunGanji: string | null;

  effect: YearlyEffect;
  effectNote: string;
  /** 작용 판정의 근거 — 세운 오행 중 부족/과다에 걸린 것 */
  fills: Ohaeng[];
  piles: Ohaeng[];

  theme: SipsinGroup;
  themeLabel: string;
  themeNote: string;
}

export interface YearlyInput {
  /** 기준 연도의 세운. 보통 `chart.seun[0]` */
  seun: SeunYear;
  /** 세운 간지의 인덱스 — 오행을 뽑기 위해 필요하다 */
  gan: number;
  ji: number;
  constitution: ConstitutionAnalysis;
}

export function analyzeYearly(input: YearlyInput): YearlyAnalysis {
  const { seun, constitution } = input;

  // 세운 두 글자의 오행. 같은 오행이면 한 번만 센다 (한 해의 성격은 하나다).
  const elements = [...new Set([ganOhaeng(input.gan), jiOhaeng(input.ji)])];

  const fills = elements.filter((element) => constitution.deficient.includes(element));
  const piles = elements.filter((element) => constitution.excess.includes(element));

  // 우리 관례: 채우는 개수와 더하는 개수를 비교한다. 같으면(둘 다 0 포함) 무던한 쪽.
  const effect: YearlyEffect =
    fills.length > piles.length ? "채워 주는" : piles.length > fills.length ? "겹치는" : "무던한";

  const theme = sipsinGroup(seun.sipsin);

  return {
    year: seun.year,
    ganji: seun.ganji,
    ohaeng: elements,
    sipsin: seun.sipsin,
    jiSipsin: seun.jiSipsin,
    daeunGanji: seun.daeunGanji,

    effect,
    effectNote: EFFECT_NOTE[effect],
    fills,
    piles,

    theme,
    themeLabel: THEME_LABEL[theme],
    themeNote: THEME_NOTE[theme],
  };
}
