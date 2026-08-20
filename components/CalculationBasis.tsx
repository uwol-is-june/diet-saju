"use client";

import { useBirthInput } from "./BirthInputProvider";
import { Button } from "./ui/Button";
import { FIELD_BASE } from "./ui/field";
import { Field } from "./ui/FormField";
import { SelectShell } from "./ui/SelectShell";
import type { BirthInput } from "@/lib/form/birth-input";
import type { TimeCorrectionInfo } from "@/lib/saju/schema";

/**
 * 만세력 계산 기준 — 출생시각 보정 · 자시 기준 (TASK-101).
 *
 * ## 왜 폼이 아니라 결과 화면인가
 *
 * 이 설정을 만지고 싶어지는 순간은 **폼을 채울 때가 아니라 결과를 보고 다른 곳과 다를
 * 때**다. 아무도 폼 앞에서 "진태양시로 봐야지" 하고 생각하지 않는다. TASK-73 이 원국
 * 카드를 접으며 정한 **"근거는 읽고 난 뒤에 확인하는 것"** 과 같은 자리인데, 만세력
 * 설정만 읽기 전에 앞을 막고 서 있었다. **없앤 것이 아니라 옮긴 것이다** — 23시대
 * 출생자는 자시 기준에 따라 일주가 통째로 바뀌고, 다른 만세력과 결과가 다를 때 원인을
 * 짚는 수단이 이것뿐이다.
 *
 * ## `고급` 이라는 낱말을 쓰지 않는다
 *
 * 열면 안 되는 것처럼 읽히는데, 정작 23시대 출생자에게는 필수 항목이다. 카드 이름은
 * `계산 기준` 이고 여는 이유는 접힌 줄의 `note`(실제 적용된 보정량)가 말한다.
 *
 * ## 바꾸면 자동으로 다시 받지 않는다
 *
 * 값이 바뀌면 화면의 풀이·원국은 **옛 기준으로 계산된 것**이 되므로 그 사실을 알리고
 * `이 기준으로 다시 보기` 버튼을 낸다. 바꾸는 즉시 재제출하지 않는 이유는 둘을 함께
 * 바꿀 때 요청이 두 번 나가기 때문이다 — 무료 등급의 병목은 토큰이 아니라 **요청 수**
 * (500 RPD)다.
 *
 * 캐시는 손댈 것이 없다. `lib/form/reading-cache.ts` 가 입력 스냅샷 전체를 훑으므로
 * 두 값이 바뀌면 캐시가 통째로 비워진다 — **손으로 키에 더하지 말 것.**
 */
export function CalculationBasis({
  correction,
  timeUnknown,
  onReapply,
  busy,
}: {
  correction: TimeCorrectionInfo;
  timeUnknown: boolean;
  onReapply: () => void;
  busy: boolean;
}) {
  const { input, update } = useBirthInput();

  /**
   * **시각 미상이면 `pillars.ts` 가 보정을 강제로 끈다** (`solarTimeMode = timeUnknown ?
   * "standard" : …`). 그 상태에서 고른 값과 실제 쓰인 값이 다르므로, 화면은 **실제로
   * 쓰인 것**을 기준으로 판단해야 한다 — 안 그러면 바뀐 것이 없는데도 "다시 보기" 가
   * 계속 떠 있다.
   */
  const effectiveMode = timeUnknown ? "standard" : input.solarTimeMode;
  const stale =
    effectiveMode !== correction.mode || input.dayBoundary !== correction.dayBoundary;

  return (
    <div className="space-y-4">
      <Field label="출생시각 보정" htmlFor="calc-solar-time">
        {/*
          시각 미상이면 이 값이 쓰이지 않는다. **숨기지 않고 잠근다** — 숨기면 왜 보정이
          안 됐는지 물을 자리가 없어진다 (시주가 빠진 이유와 같은 이야기다).
        */}
        <SelectShell>
          <select
            id="calc-solar-time"
            value={input.solarTimeMode}
            disabled={timeUnknown}
            onChange={(e) =>
              update({ solarTimeMode: e.target.value as BirthInput["solarTimeMode"] })
            }
            className={selectClass}
          >
            <option value="longitude">경도 보정 (권장 · 한국 만세력 관행)</option>
            <option value="true">진태양시 (경도 + 균시차)</option>
            <option value="standard">보정 없음 (시계시 그대로)</option>
          </select>
        </SelectShell>
        <p className="mt-1.5 text-xs text-ink-muted">
          {timeUnknown
            ? "출생시각을 모르면 보정할 시각이 없어 이 값은 쓰이지 않습니다."
            : "한국 표준시는 동경 135° 기준이라 서울(127°)의 실제 태양시보다 약 32분 빠릅니다. 서머타임·표준시 변경 시기는 자동으로 함께 보정됩니다."}
        </p>
      </Field>

      <Field label="자시(子時) 기준" htmlFor="calc-day-boundary">
        <SelectShell>
          <select
            id="calc-day-boundary"
            value={input.dayBoundary}
            disabled={timeUnknown}
            onChange={(e) =>
              update({ dayBoundary: e.target.value as BirthInput["dayBoundary"] })
            }
            className={selectClass}
          >
            <option value="yajasi">야자시·조자시 구분 (권장 · 자정에 날짜 변경)</option>
            <option value="jasi">자시파 (23시부터 다음 날)</option>
          </select>
        </SelectShell>
        <p className="mt-1.5 text-xs text-ink-muted">
          {timeUnknown
            ? "출생시각을 모르면 23시대인지 알 수 없어 이 값도 쓰이지 않습니다."
            : "23:00~23:59 출생일 때 일주를 어느 날로 볼지의 차이입니다. 그 시간대가 아니면 결과가 같습니다."}
        </p>
      </Field>

      {/*
        **바뀐 것이 없으면 아무것도 내지 않는다.** 꺼진 버튼을 늘 띄워 두면 왜 눌리지
        않는지 설명할 자리가 또 필요해진다. `role="status"` 라 값을 바꾼 순간 스크린리더도
        이 사실을 받는다.
      */}
      {stale && (
        <div role="status" className="space-y-2 border-t border-line pt-4">
          <p className="text-xs text-ink-muted">
            지금 화면의 풀이와 원국은 이전 기준으로 계산된 것입니다.
          </p>
          <Button type="button" className="w-full" onClick={onReapply} disabled={busy}>
            {busy ? "다시 계산하고 있습니다…" : "이 기준으로 다시 보기"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** 규격은 `field.ts` 가 단일 소스다 — 높이·radius 를 여기서 다시 정하지 않는다. */
const selectClass = `${FIELD_BASE} text-ink disabled:bg-surface-inset disabled:text-ink-muted`;

/** 접힌 줄에 낼 한 줄 — **실제로 적용된 값**이지 고른 값이 아니다. */
export function describeCalculationBasis(correction: TimeCorrectionInfo): string {
  /**
   * **시각 미상이면 두 값 다 쓰이지 않는다** — 보정할 시각이 없고 23시대인지도 알 수
   * 없다. 그 상태에서 `자정 기준` 이라고 적으면 쓰이지도 않은 값을 적용된 것처럼
   * 말하게 된다 (이 줄은 고른 값이 아니라 적용된 값을 말하는 자리다).
   */
  if (correction.appliedTime === null) return "시각 미상 · 시주 제외";

  const boundary = correction.dayBoundary === "jasi" ? "자시파 23시" : "자정 기준";

  const mode = MODE_LABEL[correction.mode];
  if (correction.correctionMinutes === 0) return `${mode} · ${boundary}`;
  const sign = correction.correctionMinutes < 0 ? "−" : "+";
  return `${mode} ${sign}${Math.abs(correction.correctionMinutes)}분 · ${boundary}`;
}

const MODE_LABEL: Record<TimeCorrectionInfo["mode"], string> = {
  standard: "보정 없음",
  longitude: "경도 보정",
  true: "진태양시",
};
