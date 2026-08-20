import type { ButtonHTMLAttributes } from "react";

/**
 * 버튼 부품 (dasii 규격).
 *
 * **규격만 저쪽에서 가져오고 색은 우리 시맨틱 토큰이다.** 높이 48px · radius 12px ·
 * 누를 때 1px 내려감. 저쪽 클래스 문자열을 그대로 복사하지 않는다 — 우리가 **가져오지
 * 않기로 한** shadcn 시맨틱 층 이름이다 (근거는 `docs/design-tokens.md`).
 *
 * **`"use client"` 를 붙이지 않는다.** 서버 컴포넌트에서도 쓸 수 있어야 한다 — 붙이면
 * 이 부품을 쓰는 화면이 전부 클라이언트가 되고 **`/` 를 정적으로 두는 성질이 깨진다.**
 *
 * **주 버튼은 검정이다** (흰 글씨 대비가 넉넉히 통과한다). **브랜드가 초록인 것과 충돌하지
 * 않는다** — 초록은 연한 강조 면·칩·링으로 계속 산다.
 *
 * **비활성은 면을 비운다.** 회색으로 채우면 흰 글씨가 대비를 넘기려 회색이 어두워져야
 * 하고, 그러면 활성 버튼과 명도가 같아져 "누를 수 없음" 이 색상으로만 전달된다
 * (근거표는 `docs/design-tokens.md` 의 "채운 버튼의 사각지대" 절).
 */

export type ButtonVariant = "primary" | "outline" | "ghost" | "surface";
export type ButtonSize = "default" | "compact" | "icon";

/**
 * 높이·여백·글자 크기 — dasii 규격값이다.
 *
 * **radius 도 여기 있다.** 공통 문자열에 박아 두면 원형 버튼을 만들 길이 호출부에서
 * `rounded-full` 을 덧대는 것뿐인데, 두 유틸리티는 특정도가 같아 **스타일시트 순서**가
 * 이긴다. 버튼 하나에 radius 클래스가 **언제나 하나만** 붙게 한다.
 */
const SIZE: Record<ButtonSize, string> = {
  // 48px. 저쪽 주 버튼과 같다.
  default: "h-12 rounded-xl px-4 text-base",
  // 40px. 폼 안의 보조 동작처럼 줄 안에 얹히는 버튼.
  compact: "min-h-10 rounded-xl px-4 py-2 text-sm",
  /*
    아이콘 하나만 들어가는 **원형** 버튼. 44px 이고 dasii 값(36px)을 따르지 않는다 —
    글자가 없어 누를 면이 아이콘 크기로 정해지는 자리라 **터치 타깃 최소 크기가 규격보다
    앞선다.** 줄이지 말 것.

    원형인 것은 옆에 글자 줄이 흐르는 자리라서다 — 사각 면은 그 줄에서 또 하나의
    블록으로 읽히고, 원은 줄 끝에 얹힌 동작으로 읽힌다.
  */
  icon: "size-11 rounded-full",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-ink-solid text-on-ink-solid hover:bg-ink-solid-hover " +
    "disabled:bg-brand-solid-disabled disabled:text-on-brand-solid-disabled",
  outline:
    "border border-line-strong text-ink-soft hover:bg-surface-inset " +
    "disabled:text-ink-placeholder",
  ghost: "text-ink-soft hover:bg-surface-inset disabled:text-ink-placeholder",
  /*
    **대비를 보증할 수 없는 면 위에 얹히는 꼴.** 지금 쓰는 곳은 `/reading/[type]` 맨 위의
    뒤로가기 하나이고 그 자리는 히어로 사진 위다.

    사진 안의 색은 `tokens.test.ts` 가 닿지 않으므로 이 variant 는 **자기 면을 들고 간다** —
    아이콘이 사진이 아니라 `canvas` 위에 놓여 대비가 다시 토큰으로 보증된다.
    **스크림을 까는 안은 버렸다**: 어느 사진에서도 통하려면 진해야 하고, 그러면 띠 위쪽에
    직선 경계가 생겨 **"얹힌 띠"** 가 된다 — 히어로로 쓰면서 피하려던 모습이다.

    `shadow-sm` 은 밝은 사진 위에서 면의 가장자리를 세운다. 색이 아니라 알파라 팔레트에
    값이 늘지 않는다.
  */
  surface: "bg-canvas text-ink-soft shadow-sm hover:bg-surface-inset disabled:text-ink-placeholder",
};

/**
 * 규격 문자열을 만드는 단일 소스.
 *
 * **`<button>` 이 아닌 요소도 이 규격을 써야 해서 갈라 뒀다** — 뒤로가기는 `<a>` 여야 하고
 * (새 탭·가운데 클릭·크롤러) `Button` 은 `<button>` 이라 쓸 수 없다. 호출부에서 44px 원형을
 * 다시 스타일링하면 **규격이 두 벌이 된다.**
 *
 * `disabled:*` 도 그대로 둔다 — 빼면 이 함수와 `Button` 이 서로 다른 문자열을 만든다.
 *
 * `active:translate-y-px` 는 **`prefers-reduced-motion` 규칙 대상이 아니다** (키프레임이
 * 아니라 transition 이다). 포커스 링도 여기서 그리지 않는다 — 전역 `:focus-visible` 이 건다.
 */
export function buttonClass({
  variant = "primary",
  size = "default",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return `inline-flex items-center justify-center font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 ${SIZE[size]} ${VARIANT[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}
