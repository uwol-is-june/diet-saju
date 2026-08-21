import type { SajuChart } from "@/lib/saju/schema";

/** 몸의 온도 5단계(코드에서는 한열·조후). `lib/saju/constitution.ts` 의 `THERMAL_SCALE` 과 같은 순서다. */
const STEPS = ["찬 쪽", "서늘한 쪽", "고른 쪽", "따뜻한 쪽", "더운 쪽"] as const;

/**
 * 몸의 온도 눈금 (TASK-25). **화면에는 `한열`·`조후` 를 쓰지 않는다** (TASK-117).
 *
 * `thermalScore` 는 −2~+2 이고 5단계와 1:1로 짝이 맞는다(`constitution.ts`). 그래서
 * 눈금 위 위치가 곧 판정이다 — **점수를 숫자로 찍지 않아도** 어디에 있는지 보인다.
 * (눈금 자체가 우리 관례라 숫자로 인용하지 않는다는 규칙을 지킨다.)
 *
 * 단계 이름을 다섯 개 다 적어 두는 이유: 표식만 있으면 "중화보다 얼마나 서늘한지" 는
 * 보이지만 "무엇에서 무엇 사이인지" 가 안 보인다. 축의 양 끝을 밝혀야 위치가 뜻을 갖는다.
 */
export function ThermalScale({ constitution }: { constitution: SajuChart["constitution"] }) {
  const index = STEPS.indexOf(constitution.thermal);
  // 다섯 칸의 가운데. 인덱스를 못 찾는 경우는 타입상 없지만 0으로 떨어뜨려도 안전하다.
  const position = ((Math.max(index, 0) + 0.5) / STEPS.length) * 100;

  return (
    <div>
      <div className="relative h-2 rounded-full bg-surface-inset">
        {/* 눈금 칸 경계 — 다섯 칸임을 보이게 한다 */}
        <div className="absolute inset-0 flex">
          {STEPS.map((step) => (
            <div key={step} className="flex-1 border-r border-surface last:border-r-0" />
          ))}
        </div>

        {/*
          표식은 **바깥에서 위치, 안에서 등장**으로 나눈다. 한 요소에 합치면 `chart-pop` 의
          `transform: scale()` 이 가운데 맞추는 `translate` 를 덮어써서, 재생 시작 순간
          표식이 왼쪽 위로 튀었다가 제자리로 돌아온다.
        */}
        <span
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${position}%` }}
        >
          <span className="anim-pop block size-full rounded-full border-2 border-surface bg-brand-solid" />
        </span>
      </div>

      <div className="mt-1.5 flex text-xs">
        {STEPS.map((step) => (
          <span
            key={step}
            className={`flex-1 text-center ${
              step === constitution.thermal ? "font-bold text-ink" : "text-ink-muted"
            }`}
          >
            {step}
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        태어난 계절의 춥고 더움을 먼저 보고 원국의 화·수 세력으로 보정한 판정입니다.
      </p>
    </div>
  );
}
