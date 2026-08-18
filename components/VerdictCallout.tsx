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
 * 그렇게 샐 뻔했다. 지금 값을 내는 것은 `gain-cause` 뿐이고 나머지는 `null` 이다.
 */
interface Callout {
  label: string;
  basis: string;
}

const CALLOUT: Record<ReadingType, (chart: SajuChart) => Callout | null> = {
  general: () => null,
  // 결·방법·시기 유형은 한 줄로 요약되는 판정이 아니다 — 요약 절이 그 자리를 쓴다.
  diet: () => null,
  "gain-cause": (chart) => ({
    label: chart.constitution.gainLabel,
    basis: `십신 우세 ${chart.constitution.dominantGroup} · ${chart.constitution.gainSite} 쪽에서 먼저 드러나는 결입니다`,
  }),
  "diet-method": () => null,
  decade: () => null,
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
