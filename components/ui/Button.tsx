import type { ButtonHTMLAttributes } from "react";

/**
 * 버튼 부품 (TASK-75 · dasii 규격).
 *
 * **규격만 저쪽에서 가져오고 색은 우리 시맨틱 토큰이다.** 높이 48px · radius 12px ·
 * 누를 때 1px 내려감. 저쪽 클래스 문자열(`bg-primary`·`text-primary-foreground`)을
 * 그대로 복사하지 않는다 — 그건 우리가 **가져오지 않기로 한** shadcn 시맨틱 층 이름이다
 * (근거는 `docs/design-tokens.md`).
 *
 * ## `"use client"` 를 붙이지 않는다
 *
 * 서버 컴포넌트에서도 쓸 수 있어야 한다. 여기에 지시문을 붙이면 이 부품을 쓰는 화면이
 * 전부 클라이언트가 되고, **`/` 를 통째로 정적으로 두는 성질이 깨진다.**
 * (지금 호출부는 전부 이미 클라이언트 컴포넌트 안이지만, 그건 이 부품의 사정이 아니다.)
 *
 * ## 주 버튼이 검정인 이유
 *
 * dasii 의 `default` variant 가 그 색이고 `docs/ui_ref/*.png` 의 검정 필도 같다.
 * TASK-71 은 "새 토큰과 대비 검증이 필요해서" green 을 유지했는데, 재보니
 * **흰 글씨 17.46:1** 로 통과한다 (그때의 유보 사유가 사라졌다).
 * **브랜드가 초록인 것과 충돌하지 않는다** — dasii 자신이 초록 브랜드에 검정 버튼이다.
 * 초록은 연한 강조 면·칩·링으로 계속 산다.
 *
 * ## 비활성은 저쪽을 따르지 않는다
 *
 * dasii 는 회색 면 + 한 단계 밝은 회색 글씨(3.91:1)인데 우리는 **면을 비운다.**
 * (저쪽 클래스 이름을 그대로 적지 않는다 — `tokens.test.ts` 가 소스에서 Tailwind 기본
 * 색상 유틸리티를 찾는데, 주석이라도 걸린다. 검사를 약하게 만들지 말고 문장을 고친다.)
 * 근거표가 `docs/design-tokens.md` 의 "채운 버튼의 사각지대" 절에 있다 — 회색으로 채우면
 * 흰 글씨가 4.5:1 을 넘기 위해 회색이 어두워져야 하고, 그러면 활성 버튼과 명도가 같아져
 * "누를 수 없음" 이 색상으로만 전달된다.
 */

type Variant = "primary" | "outline" | "ghost";
type Size = "default" | "compact" | "icon";

/** 높이·여백·글자 크기 — dasii 실측값이다. */
const SIZE: Record<Size, string> = {
  // 48px. 저쪽 주 버튼과 같다.
  default: "h-12 px-4 text-base",
  // 40px. 폼 안의 보조 동작(`수정`)처럼 줄 안에 얹히는 버튼.
  compact: "min-h-10 px-4 py-2 text-sm",
  // 정사각. 아이콘 하나만 들어간다.
  icon: "size-9",
};

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-ink-solid text-on-ink-solid hover:bg-ink-solid-hover " +
    "disabled:bg-brand-solid-disabled disabled:text-on-brand-solid-disabled",
  outline:
    "border border-line-strong text-ink-soft hover:bg-surface-inset " +
    "disabled:text-ink-placeholder",
  ghost: "text-ink-soft hover:bg-surface-inset disabled:text-ink-placeholder",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      /*
        `active:translate-y-px` 는 저쪽에서 받았다. **`prefers-reduced-motion` 규칙 대상이
        아니다** — 키프레임이 아니라 transition 이라 `motion.test.ts` 가 보는 `anim-*`
        계약과 무관하다. 누른 순간의 상태 변화이지 재생되는 동작이 아니다.

        포커스 링을 여기서 그리지 않는다 — 전역 `:focus-visible` 이 이미 건다.
      */
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
