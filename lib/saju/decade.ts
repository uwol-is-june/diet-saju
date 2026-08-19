/**
 * 대운(10년) 판정 (TASK-45).
 *
 * 순수 함수 모듈. `analysis.ts` 의 대운과 `constitution.ts` 의 오행 과부족을 받아
 * **지금 흐르는 10년이 이 원국에 어떤 구간인지**를 결정론적으로 정한다.
 *
 * ## 왜 코드가 정하는가
 *
 * `yearly.ts` 와 같은 이유다. 시간 이야기는 LLM 이 가장 즉흥적으로 흐르기 쉬워서, 같은
 * 사주에 어떤 날은 "붙는 10년", 어떤 날은 "빠지는 10년" 이 나오면 점괘 뽑기가 된다.
 * **판정은 여기서 하고 LLM 은 서술만 한다.**
 *
 * ## 고전 규칙과 우리 관례
 *
 * - **고전**: 대운 간지(월주에서 순행/역행), 대운 천간·지지의 십신, 대운 오행을 원국의
 *   강약과 견주어 보는 방식 자체.
 * - **우리 관례**: **대운을 세운과 같은 3단계(보완·가중·중립)로 본다** — 이것 하나다.
 *   판정 규칙·동점 처리를 `yearly.ts` 에서 그대로 가져오므로 새로 정할 값이 없다.
 *   대운 세기 가중이나 천간/지지 비중 같은 값을 새로 만들면 관례가 불어난다. **만들지 말 것.**
 *
 * ## 이전 대운과의 비교는 새 관례가 아니다
 *
 * "20대엔 안 쪘는데 30대 들어 붙는다" 가 이 유형이 답하려는 질문이라 **직전 구간에도 같은
 * 규칙을 한 번 더 적용**한다. 규칙이 같으므로 관례가 늘지 않는다 — 늘어나는 것은 적용
 * 횟수뿐이다. 다음 구간은 판정하지 않는다: 아직 오지 않은 시간을 말하면 예측이 된다.
 *
 * ## 단정적 예언을 하지 않는다
 *
 * 아래 문구는 사용자에게 인용된다. `decade.test.ts` 가 `yearly.test.ts` 와 같은 방식으로
 * 사건 예고·단정 어휘를 훑는다. 10년 단위 이야기는 **미래 예측으로 읽히기 가장 쉬우므로**
 * `app/disclaimer/page.tsx` 도 "정해진 시기가 아니다" 를 밖에서 약속한다.
 */
import type { DaeunAnalysis, DaeunPeriod } from "./analysis";
import type { ConstitutionAnalysis } from "./constitution";
import { ganOhaeng, jiOhaeng, type Ohaeng } from "./ganji";
import type { YearlyEffect } from "./yearly";

/**
 * 대운 작용 문구 — **우리 관례**(3단계 표현).
 *
 * `yearly.ts` 의 `EFFECT_NOTE` 와 **문장을 공유하지 않는다.** 층이 다르기 때문이다:
 * 세운은 한 해를 어떻게 보낼지이고 대운은 10년 동안 몸의 기본값이 어디로 기울어 있는지다.
 * 같은 문장을 쓰면 `diet` 의 "올해의 몸 흐름" 과 이 유형이 같은 말을 하게 된다.
 */
export const DECADE_EFFECT_NOTE: Record<YearlyEffect, string> = {
  보완:
    "이 10년 동안 들어오는 기운이 원국에서 얇았던 쪽을 받쳐 준다. 몸이 무리 없이 따라오는 구간이라, 크게 흔들 일보다 하던 것을 이어 가며 기반을 다지는 데 쓰면 남는다.",
  가중:
    "이 10년 동안 들어오는 기운이 이미 넘치던 쪽에 얹힌다. 예전에 통하던 방식이 같은 만큼 돌아오지 않기 쉬운 구간이라, 더 세게 미는 쪽보다 덜어내고 속도를 고르는 편이 맞다.",
  중립:
    "이 10년 동안 들어오는 기운이 원국의 넘치는 쪽도 얇은 쪽도 크게 건드리지 않는다. 바깥 흐름보다 스스로 정해 둔 생활 방식이 그대로 드러나는 구간이다.",
};

/**
 * 직전 구간과 견준 흐름 — **우리 관례**(위 3단계에서 파생).
 *
 * 새 축이 아니라 두 판정을 견준 것이라 **동점 처리가 새로 필요 없다** — 같으면 `유지`다.
 */
export type DecadeShift = "완화" | "심화" | "전환" | "유지";

export const SHIFT_NOTE: Record<DecadeShift, string> = {
  완화: "직전 10년보다 받쳐 주는 쪽으로 옮겨 왔다. 예전에 잘 안 되던 방식이 이번에는 덜 버겁게 느껴지는 구간이다.",
  심화: "직전 10년보다 쏠리는 쪽으로 옮겨 왔다. 예전과 같은 방식을 그대로 이어 가면 같은 만큼 돌아오지 않기 쉽다.",
  전환: "직전 10년과 방향이 바뀌었다. 몸이 반응하는 자리가 옮겨 가는 구간이라, 하던 방식을 한 번 점검할 만하다.",
  유지: "직전 10년과 방향이 크게 다르지 않다. 지금까지의 방식이 여전히 같은 자리에서 통한다.",
};

export interface DecadePeriodVerdict {
  /** 대운 간지 (표시용 한글) */
  ganji: string;
  startAge: number;
  endAge: number;
  /** 대운 천간·지지의 오행 (같으면 하나로 센다) */
  ohaeng: Ohaeng[];
  effect: YearlyEffect;
  /** 작용 판정의 근거 — 대운 오행 중 부족/과다에 걸린 것 */
  fills: Ohaeng[];
  piles: Ohaeng[];
}

export interface DecadeAnalysis {
  /** 지금 흐르는 대운 */
  current: DecadePeriodVerdict;
  /** 직전 대운. 첫 대운을 지나는 중이면 null */
  previous: DecadePeriodVerdict | null;
  effectNote: string;
  /** 직전과 견준 흐름. `previous` 가 없으면 null */
  shift: DecadeShift | null;
  shiftNote: string | null;
  /** 현재 대운의 십신 (고전) */
  sipsin: DaeunPeriod["sipsin"];
  jiSipsin: DaeunPeriod["jiSipsin"];
}

/**
 * 지금 나이가 속한 대운을 찾는다.
 *
 * **여기 한 곳에서만 정한다** — 예전에는 같은 `find` 가 `DaeunTimeline` · `ResultView` ·
 * `card-model` 세 곳에 흩어져 있었다. 나이 구간 판정이 어긋나면 화면·카드·풀이가 서로
 * 다른 대운을 가리킨다.
 *
 * `currentAge` 는 `chart.seun[0]?.age` 이며 **세는나이** 관례다 (`analyzeSeun` 참고).
 */
export function findCurrentDaeunIndex(
  daeun: DaeunAnalysis | null,
  currentAge: number | undefined,
): number {
  if (!daeun || currentAge === undefined) return -1;
  return daeun.periods.findIndex(
    (period) => currentAge >= period.startAge && currentAge <= period.endAge,
  );
}

export function findCurrentDaeun(
  daeun: DaeunAnalysis | null,
  currentAge: number | undefined,
): DaeunPeriod | null {
  const index = findCurrentDaeunIndex(daeun, currentAge);
  return index >= 0 ? (daeun?.periods[index] ?? null) : null;
}

export interface DecadeInput {
  /** 성별 미지정이면 null 이고, 그때 이 유형은 성립하지 않는다. */
  daeun: DaeunAnalysis | null;
  /** 기준 연도의 나이 (`chart.seun[0]?.age`) */
  currentAge: number | undefined;
  constitution: ConstitutionAnalysis;
}

/** `yearly.ts` 와 **같은 규칙**이다. 새 관례를 만들지 않기 위해 여기서만 재사용한다. */
function judge(period: DaeunPeriod, constitution: ConstitutionAnalysis): DecadePeriodVerdict {
  // 두 글자의 오행. 같은 오행이면 한 번만 센다 (한 구간의 성격은 하나다).
  const ohaeng = [...new Set([ganOhaeng(period.gan), jiOhaeng(period.ji)])];

  const fills = ohaeng.filter((element) => constitution.deficient.includes(element));
  const piles = ohaeng.filter((element) => constitution.excess.includes(element));

  // 채우는 개수와 더하는 개수를 비교한다. 같으면(둘 다 0 포함) 중립.
  const effect: YearlyEffect =
    fills.length > piles.length ? "보완" : piles.length > fills.length ? "가중" : "중립";

  return {
    ganji: period.ganji,
    startAge: period.startAge,
    endAge: period.endAge,
    ohaeng,
    effect,
    fills,
    piles,
  };
}

/** 두 구간의 작용을 견준다. 같으면 `유지` 이므로 동점 처리가 따로 없다. */
function compare(current: YearlyEffect, previous: YearlyEffect): DecadeShift {
  if (current === previous) return "유지";
  if (current === "보완") return "완화";
  if (current === "가중") return "심화";
  return "전환"; // 중립으로 옮겨 온 경우
}

/**
 * 성별 미지정(`daeun === null`)이거나 나이가 어느 구간에도 들지 않으면 **null 을 돌려준다.**
 * 순행을 임의로 정하지 않는다 — 그러면 같은 사주에 다른 판정이 나간다.
 */
export function analyzeDecade(input: DecadeInput): DecadeAnalysis | null {
  const index = findCurrentDaeunIndex(input.daeun, input.currentAge);
  if (index < 0 || !input.daeun) return null;

  const period = input.daeun.periods[index]!;
  const current = judge(period, input.constitution);
  const previousPeriod = index > 0 ? input.daeun.periods[index - 1]! : null;
  const previous = previousPeriod ? judge(previousPeriod, input.constitution) : null;
  const shift = previous ? compare(current.effect, previous.effect) : null;

  return {
    current,
    previous,
    effectNote: DECADE_EFFECT_NOTE[current.effect],
    shift,
    shiftNote: shift ? SHIFT_NOTE[shift] : null,
    sipsin: period.sipsin,
    jiSipsin: period.jiSipsin,
  };
}
