"use client";

import { useRef } from "react";

/**
 * 선택지 둘~셋짜리 라디오 그룹을 **칩**으로 그린다. 성별과 양력/음력이 쓴다 — 값이 둘일 때
 * 드롭다운은 **한 번 더 눌러야 보이는 목록**이라 치를 이유가 없는 비용이다.
 *
 * **규격은 `field.ts`·`Button.tsx` 와 같은 값이다** (48px · radius 12px). 그래야 폼 그리드에서
 * 옆 칸 입력과 밑선·모서리가 맞는다 — **여기서 다시 정하지 말 것.**
 *
 * **`Button` 부품을 쓰지 않는다** (`LikeButton` 과 같은 이유) — 켜짐/꺼짐이 있는 칩이라
 * variant 축이 다르다. 모양만 부품과 같은 값을 쓴다.
 *
 * 선택된 면은 `bg-brand-solid` + `text-on-brand-solid`(green700 + 흰 글씨 · 5.14:1)다.
 * **`green500` 위에 흰 글씨를 올리지 말 것** — AA 미달이고 토큰 테스트가 잡는다.
 * 포커스 링은 전역 `:focus-visible` 이 건다.
 *
 * **연한 초록 면(`bg-brand` + `text-on-brand`)에서 옮겨 왔다** (TASK-107). 대비는 9.52:1 로
 * 넉넉했지만 그것이 문제가 아니었다 — WCAG 대비는 명도만 재고, green500 은 중간 회색보다
 * 밝으면서 채도가 높아 **어두운 글리프의 가장자리가 물러 보인다.** 앱에서 글자가 `bg-brand`
 * 위에 올라가는 곳이 여기 하나뿐이라 규격에서도 튀었다.
 *
 * **채운 초록은 CTA 가 아니다** (주 버튼은 검정이다 · TASK-75). `brand-solid` 를 쓰는 자리는
 * `DaeunTimeline` 의 **현재** 대운 · `ThermalScale` 의 현재 지점 · `ScrollToTop` 으로 전부
 * "지금 이것" 을 가리킨다 — 선택된 칩이 같은 뜻이라 어법이 하나가 된다.
 *
 * **연한 면(green50·green100)으로 가지 않은 이유**: green50 + green700 은 4.77:1 로 통과하지만
 * 선택 신호가 약하고 비선택 hover 와 같은 모습이 된다. green100 + green700 은 4.44:1 로
 * **AA 미달**이다. 비선택 hover 를 `bg-surface-inset` 으로 내린 것도 같은 정리다 — `Button` 의
 * `outline` variant 가 이미 그 값이라 규격이 하나가 된다.
 *
 * **접근성은 우리가 만들어야 한다** — `<select>` 가 공짜로 주던 것을 잃는 자리다.
 * ⓐ `role="radiogroup"` + `aria-labelledby`, ⓑ 각 칩은 `role="radio"` + `aria-checked`,
 * ⓒ **좌우·상하 화살표로 옮길 수 있다.**
 *
 * **`value` 가 `null` 인 상태를 허용한다** — 성별은 **둘 다 비선택인 것이 곧 `unspecified`** 다.
 * `선택 안 함` 을 세 번째 칩으로 만들면 "고르지 않음" 이 선택지처럼 보인다. 고른 뒤 미선택으로
 * 돌아가는 길도 두지 않았다 — 세 번째 컨트롤을 만들면 없앤 것이 이름만 바꿔 돌아온다.
 */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
}: {
  options: readonly { value: T; label: string }[];
  /** `null` 이면 아무것도 고르지 않은 상태다. */
  value: T | null;
  onChange: (value: T) => void;
  /** 그룹 이름을 만드는 라벨의 id. 없으면 스크린리더가 이 그룹이 무엇인지 알 수 없다. */
  labelledBy: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  /**
   * 화살표로 옮긴다. **선택과 포커스를 함께 옮겨야** 라디오 그룹처럼 동작한다 — 선택만
   * 바꾸면 포커스가 뒤에 남아 다음 화살표가 엉뚱한 칸에서 출발한다.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();

    const current = options.findIndex((option) => option.value === value);
    const next =
      current === -1
        ? 0
        : (current + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next]!.value);
    const buttons = groupRef.current?.querySelectorAll("button");
    buttons?.[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-2 gap-2"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={`h-12 rounded-xl border text-base font-medium transition sm:text-sm ${
              selected
                ? "border-brand-solid bg-brand-solid font-bold text-on-brand-solid"
                : "border-line-strong bg-surface text-ink-soft hover:border-brand hover:bg-surface-inset"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
