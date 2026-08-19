import type { ReadingType, SajuChart } from "@/lib/saju/schema";

/**
 * 판정 한 줄 콜아웃 (TASK-47).
 *
 * ## 왜 LLM 이 쓰지 않는가
 *
 * 두 가지다. ① **판정은 코드가 한다**는 경계 — 라벨은 `constitution.ts` 의 `GAIN_LABEL`
 * 에서 오고 같은 사주면 언제나 같다. ② **`chart` 는 60~70ms 에 오고 첫 글자는 1초 뒤다.**
 * 기다리는 동안 결론 한 줄이 먼저 떠서 볼거리가 생긴다.
 *
 * ## 라벨만 크게 띄우지 않는다
 *
 * 라벨 밑에 **근거 한 줄**을 함께 둔다. 라벨만 있으면 "당신은 먹는 자리에서 찐다" 는
 * 확정 진술로 읽히는데, 단정해도 되는 것은 **이 사주에서 읽히는 결**이지 몸에서 실제로
 * 일어나는 일이 아니다 (TASK-55 경계). 밑줄이 판정 근거(십신 우세 그룹 · 걸리는 지점)와
 * 그 범위를 함께 말한다.
 *
 * ## `Record` 인 이유
 *
 * `prompt.ts` 의 `VERDICT_BLOCK` 과 같은 모양이다. 삼항이나 인덱스 시그니처로 두면
 * **새 유형이 조용히 남의 콜아웃을 달고 나간다** — TASK-15 에서 공유 카드 칩이 실제로
 * 그렇게 샐 뻔했다.
 *
 * ## 모든 유형이 낸다 (TASK-66)
 *
 * 예전에는 `gain-cause`·`exercise` 만 냈고 나머지는 "한 줄로 요약되는 판정이 아니다" 로
 * 비워 뒀다. 지금은 전부 낸다 — **글을 읽기 전에 키워드 하나를 먼저 쥐여 주는 카드**라
 * 유형을 가릴 이유가 없었다.
 *
 * **조건은 하나다: 라벨이 기존 판정에서 1:1 로 파생될 것.** 그래야 같은 사주에 언제나 같은
 * 라벨이 나온다. 억지로 만들면 동점 처리를 새로 정해야 하고, 그 순간 "판정은 코드가 한다" 가
 * 무너진다. 아래 다섯은 전부 이미 결정론적인 값에서 그대로 온다.
 *
 * `deficient[0]` 처럼 **목록의 첫 항목을 쓰는 것도 새 동점 처리가 아니다** — 그 목록은
 * 오행 열거 순서로 만들어져 순서가 이미 고정돼 있다 (`card-model.ts` 의 칩이 같은 값을 쓴다).
 *
 * ## "본문에서 되풀이하지 말라" 는 `gainLabel` 에만 건다
 *
 * `prompt.ts` 의 판정 블록이 `gainLabel` 한 줄에만 그 지시를 붙인다. 그것이 문장 꼴
 * ("먹는 자리에서 붙는 결")이라 본문에 그대로 들어가면 같은 말이 화면 위아래에 두 번
 * 나오기 때문이다.
 *
 * **나머지 라벨에는 걸지 않는다.** 대사 기조·접근 순서 같은 낱말 꼴 라벨은
 * `SYSTEM_INSTRUCTION` 이 **본문에 그대로 쓰라고 요구하는 값**이고, 그 인용률이 이 서비스의
 * 적중감을 만든다(기준선에서 48/48). 되풀이를 금지하면 그 지표를 스스로 깎는다.
 * 콜아웃은 제목처럼 얹히는 한 줄이지 본문과 같은 자리의 문장이 아니다.
 */
interface Callout {
  label: string;
  basis: string;
}

const CALLOUT: Record<ReadingType, (chart: SajuChart) => Callout | null> = {
  // 내부 유형이지만 `Record` 라 값이 필요하다. 신강신약은 고전 규칙이라 그대로 쓴다.
  general: (chart) => ({
    label: chart.strength.verdict,
    basis: `${chart.ohaeng.season}에 태어나 ${chart.ohaeng.strongest} 기운이 가장 강한 사주입니다`,
  }),
  /**
   * 종합 체질 (TASK-66). **대사 기조를 라벨로 쓴다** — 신강신약에서 1:1 로 나오는 값이고,
   * 이 유형이 답하는 "몸이 어떤 결인가" 에 가장 가깝다. 한열은 근거 줄로 내린다.
   */
  diet: (chart) => ({
    label: chart.constitution.metabolism,
    basis: `신강신약 ${chart.strength.verdict}에서 나온 기조이고, 한열은 ${chart.constitution.thermal} 쪽입니다`,
  }),
  "gain-cause": (chart) => ({
    label: chart.constitution.gainLabel,
    basis: `십신 우세 ${chart.constitution.dominantGroup} · ${chart.constitution.gainSite} 쪽에서 먼저 드러나는 결입니다`,
  }),
  // 방법 유형 (TASK-66): 접근 순서가 이 유형이 답하는 질문이다. 2×2 표라 동점이 없다.
  "diet-method": (chart) => ({
    label: chart.constitution.dietApproach,
    basis: `대사 기조 ${chart.constitution.metabolism} · 걸리는 지점 ${chart.constitution.gainSite}에서 나온 순서입니다`,
  }),
  /**
   * 식단 유형 (TASK-63 · 66). 곁들일 계열이 이 유형이 답하는 질문이다.
   *
   * **부족한 오행이 없을 때 지어내지 않는다** — 그 사실 자체가 판정이므로 그렇게 쓴다.
   * 대신 근거 줄이 한열을 들어 "그래도 조리와 온도는 정해진다" 를 말한다.
   */
  "diet-food": (chart) => {
    const short = chart.constitution.deficient[0];
    return {
      label: short ? `${short} 계열을 곁들이기` : "곁들일 계열이 따로 없음",
      basis: short
        ? `오행 ${short}이 부족한 쪽이고, 한열 ${chart.constitution.thermal}이 조리와 온도를 정합니다`
        : `오행이 한쪽으로 쏠리지 않았고, 한열 ${chart.constitution.thermal}이 조리와 온도를 정합니다`,
    };
  },
  /**
   * 운동 유형 (TASK-48). **콜아웃이 이 유형의 핵심이다** — "어떤 운동을" 을 하나로 좁혀
   * 보여주는 것이 목적이라, 종목이 본문 어딘가가 아니라 맨 위에 떠 있어야 한다.
   *
   * 근거 줄은 **두 층을 각자의 표에서 가져와 합친다** — 종목은 `MOVEMENT_PLAN`(접근 순서
   * 층), 실행 조건은 `THERMAL_GUIDE`(한열 층). 층을 섞지 않으므로 4 × 5 = 20가지 문장이
   * 나오면서도 각 칸의 근거를 설명할 수 있다.
   */
  exercise: (chart) => ({
    label: chart.constitution.movementPrimary,
    basis: `${chart.constitution.movementKind} · ${chart.constitution.dietApproach}에서 나온 종목이고, 한열 ${chart.constitution.thermal}이 실행 조건을 정합니다`,
  }),
  /**
   * 시기 유형 (TASK-66). 작용 3단계가 라벨이다 — `yearly.ts` 의 규칙을 그대로 대운에
   * 적용한 값이라 새 관례가 없다. **다음 구간은 판정하지 않았으므로 라벨에도 없다.**
   */
  decade: (chart) =>
    chart.decade
      ? {
          label: `${chart.decade.current.effect}하는 10년`,
          basis: chart.decade.shift
            ? `지금 ${chart.decade.current.ganji} 대운이고, 직전 구간과 견주면 ${chart.decade.shift}입니다`
            : `지금 ${chart.decade.current.ganji} 대운이고, 첫 대운을 지나는 중입니다`,
        }
      : null,
};

export function VerdictCallout({
  chart,
  readingType,
}: {
  chart: SajuChart;
  readingType: ReadingType;
}) {
  const callout = CALLOUT[readingType](chart);
  if (!callout) return null;

  return (
    <section className="rounded-2xl border border-brand-border bg-brand-subtle p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold tracking-wide text-ink-muted">이 사주에서 읽은 결</p>
      <p className="mt-1 text-xl font-bold text-brand-ink sm:text-2xl">{callout.label}</p>
      <p className="mt-2 text-sm text-ink-soft">{callout.basis}</p>
    </section>
  );
}
