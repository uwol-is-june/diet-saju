/**
 * 올해 운세 판정 (TASK-15).
 *
 * 순수 함수 모듈. `analysis.ts` 의 세운·대운과 `constitution.ts` 의 오행 과부족을 받아
 * **올해가 이 원국에 어떤 해인지**를 결정론적으로 정한다.
 *
 * ## 왜 코드가 정하는가
 *
 * 운세는 LLM 이 가장 즉흥적으로 흐르기 쉬운 영역이다. 같은 사주에 어떤 날은 "재물이 들어오는
 * 해", 어떤 날은 "지출을 조심할 해" 가 나오면 서비스가 아니라 점괘 뽑기가 된다.
 * 원국·체질과 같은 원칙으로 **판정은 여기서 하고 LLM 은 서술만 한다.**
 *
 * ## 고전 규칙과 우리 관례
 *
 * - **고전**: 세운 간지((연도−4) mod 60), 세운 천간·지지의 십신, 십신 5분류,
 *   세운 오행을 원국의 강약과 견주어 보는 방식 자체.
 * - **우리 관례**: 작용을 3단계(보완·가중·중립)로 표현하는 것, 동점 처리, 십신 그룹을
 *   "그 해의 주제" 로 옮긴 대응표. 전부 아래 상수에 모아 뒀다.
 *
 * ## 단정적 예언을 하지 않는다
 *
 * 여기 문구는 사용자에게 인용될 수 있다. 사건을 예고하는 어휘(대박·사고·이혼 …)와
 * 단정 어휘(반드시·틀림없이 …)를 쓰지 않으며, `yearly.test.ts` 가 전 문구를 훑어 막는다.
 * 면책 고지가 "확정된 사실이나 미래 예측으로 받아들이지 마세요" 라고 약속하고 있다.
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
export type YearlyEffect = "보완" | "가중" | "중립";

export const EFFECT_NOTE: Record<YearlyEffect, string> = {
  보완:
    "올해 들어오는 기운이 원국에서 얇았던 쪽을 채워 준다. 미뤄 둔 일을 벌이기보다 부족했던 자리를 메우는 데 쓰면 남는 해다.",
  가중:
    "올해 들어오는 기운이 이미 넘치던 쪽에 더해진다. 하던 방식을 더 세게 밀기보다 덜어내고 속도를 고르는 편이 낫다.",
  중립:
    "올해 기운이 원국의 넘치는 쪽도 얇은 쪽도 크게 건드리지 않는다. 외부 변수보다 스스로 정한 계획이 결과를 가른다.",
};

/**
 * **우리 관례**: 십신 우세 → 그 해의 주제.
 * 고전 상의(象意)에서 끌어왔지만 "올해의 주제" 라는 축은 이 서비스가 만든 것이다.
 *
 * **지금 이 축은 프롬프트로 나가지 않는다** (TASK-39 결정 ①). `yearly` 유형이 없어지면서
 * 세운 판정은 `diet` 의 "올해의 몸 흐름" 으로 옮겨갔는데, 작용(보완·가중)과 달리 주제
 * 라벨은 **생활 영역 어휘**라 몸 이야기에 그대로 얹으면 겉돈다. 몸 쪽으로 옮기려면 근거
 * 없는 새 대응표가 필요하고 "압박이 늘어 몸이 상한다" 류의 추론은 면책 고지가 막는
 * 의학적 주장에 닿는다.
 *
 * 계산은 남겨 둔다 — 십신 그룹 판정 자체는 고전 규칙이고, 생활 영역을 다루는 유형이
 * 다시 생기면 그대로 쓸 수 있다. 되살릴 때 필요한 것은 이 표가 아니라 **몸/생활 중 어느
 * 맥락에 쓸지의 판단**이다.
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

  // 우리 관례: 채우는 개수와 더하는 개수를 비교한다. 같으면(둘 다 0 포함) 중립.
  const effect: YearlyEffect =
    fills.length > piles.length ? "보완" : piles.length > fills.length ? "가중" : "중립";

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
