"use client";

import { useRef } from "react";

/**
 * 선택지 둘~셋짜리 라디오 그룹을 **칩**으로 그린다 (TASK-85).
 *
 * 성별(`남성`·`여성`)과 양력/음력이 쓴다. 둘 다 선택지가 사실상 둘인데 드롭다운이었고,
 * 그건 **한 번 더 눌러야 보이는 목록** 이라 값이 둘일 때 치를 이유가 없는 비용이다.
 *
 * ## 규격은 `field.ts`·`Button.tsx` 와 같은 값이다
 *
 * 높이 48px(`h-12`) · radius 12px(`rounded-xl`). 그래야 폼 그리드에서 옆 칸의 입력과
 * **밑선과 모서리가 맞는다.** 이 값을 여기서 다시 정하지 말 것 — 어긋나면 같은 줄의
 * `생년월일` 입력과 높이가 달라 보인다.
 *
 * ## `Button` 부품을 쓰지 않는다
 *
 * `LikeButton` 과 같은 이유다 — 이건 버튼이 아니라 **켜짐/꺼짐이 있는 칩**이고 선택된
 * 상태를 면 색으로 보여야 해서 variant 축이 다르다. 부품에 네 번째 variant 를 만들면
 * 그 축이 섞인다. 다만 모양(높이·radius)은 부품과 **같은 값**을 쓴다.
 *
 * 선택된 면은 `bg-brand` + `text-on-brand` 다 — 검증된 짝(9.61:1)이다.
 * **`green500` 위에 흰 글씨를 올리지 말 것** (1.82:1 로 AA 미달이고 토큰 테스트가 잡는다).
 * 포커스 링은 그리지 않는다 — 전역 `:focus-visible` 이 이미 건다.
 *
 * ## 접근성은 우리가 만들어야 한다
 *
 * `<select>` 가 공짜로 주던 것을 잃는 자리다. 그래서
 * ⓐ `role="radiogroup"` + `aria-labelledby` 로 그룹에 이름을 주고,
 * ⓑ 각 칩은 `role="radio"` + `aria-checked` 이며,
 * ⓒ **좌우·상하 화살표로 옮길 수 있다** (라디오 그룹에서 기대되는 조작이다).
 *
 * **`value` 가 `null` 인 상태를 허용한다.** 성별이 그렇다 — `남성`·`여성` 두 칩만 두고
 * **둘 다 비선택인 것이 곧 `unspecified`** 다. `선택 안 함` 을 세 번째 칩으로 만들면
 * "고르지 않음" 이 하나의 선택지처럼 보이고, 값 셋을 화면에 그대로 옮긴 모양이 된다.
 * 고른 뒤 다시 미선택으로 돌아가는 길은 두지 않았다 — 되돌릴 값이 아니고, 세 번째
 * 컨트롤(지우기)을 만들면 위에서 없앤 것이 이름만 바꿔 돌아온다.
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
   * 화살표로 옮긴다. **선택과 포커스를 함께 옮겨야** 라디오 그룹처럼 동작한다 —
   * 선택만 바꾸면 포커스가 뒤에 남아 다음 화살표가 엉뚱한 칸에서 출발한다.
   *
   * 미선택 상태(`value === null`)에서 화살표를 누르면 첫 칸이 선택된다.
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
                ? "border-brand bg-brand font-bold text-on-brand"
                : "border-line-strong bg-surface text-ink-soft hover:border-brand hover:bg-brand-subtle"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
