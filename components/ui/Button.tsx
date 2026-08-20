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

export type ButtonVariant = "primary" | "outline" | "ghost";
export type ButtonSize = "default" | "compact" | "icon";

/**
 * 높이·여백·글자 크기 — dasii 실측값이다.
 *
 * **radius 도 여기 있다** (TASK-89). 예전에는 아래 공통 문자열에 `rounded-xl` 이 박혀
 * 있었는데, 그러면 원형 버튼을 만들 길이 **호출부에서 `rounded-full` 을 덧대는 것**뿐이다.
 * 두 유틸리티는 특정도가 같아 **스타일시트에 늦게 나오는 쪽이 이긴다** — 클래스 문자열
 * 순서로는 정해지지 않는다. 그래서 버튼 하나에 radius 클래스가 **언제나 하나만** 붙게 한다.
 */
const SIZE: Record<ButtonSize, string> = {
  // 48px. 저쪽 주 버튼과 같다.
  default: "h-12 rounded-xl px-4 text-base",
  // 40px. 폼 안의 보조 동작처럼 줄 안에 얹히는 버튼.
  compact: "min-h-10 rounded-xl px-4 py-2 text-sm",
  /*
    아이콘 하나만 들어가는 **원형** 버튼. 44px 이고 dasii 값(36px)을 따르지 않는다 —
    글자가 없어 누를 면이 아이콘 크기로 정해지는 자리라, 터치 타깃 최소 크기(44px)가
    규격보다 앞선다 (`BackLink`·`ScrollToTop` 이 쓰는 `min-h-11` 과 같은 값).
    **줄이지 말 것.** 지금 호출부(`SajuForm` 의 `수정`)가 모바일에서 손가락으로 누르는 자리다.

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
};

/**
 * 규격 문자열을 만드는 단일 소스 (TASK-93).
 *
 * **`<button>` 이 아닌 요소도 이 규격을 써야 하기 때문에 갈라 뒀다.** `/reading/[type]`
 * 맨 위의 뒤로가기는 **`<a>` 여야 하고**(새 탭·가운데 클릭·크롤러) `Button` 은
 * `ButtonHTMLAttributes` 를 받는 `<button>` 이라 쓸 수 없다. 그때 44px 원형을 호출부에서
 * 다시 스타일링하면 **규격이 두 벌이 된다** — 한쪽만 고쳐지는 자리다.
 *
 * `disabled:*` 도 그대로 둔다. 링크에는 걸릴 일이 없고, 빼면 이 함수와 `Button` 이
 * 서로 다른 문자열을 만들어 "단일 소스" 가 아니게 된다.
 *
 * `active:translate-y-px` 는 dasii 에서 받았다. **`prefers-reduced-motion` 규칙 대상이
 * 아니다** — 키프레임이 아니라 transition 이라 `motion.test.ts` 가 보는 `anim-*` 계약과
 * 무관하다. 누른 순간의 상태 변화이지 재생되는 동작이 아니다.
 *
 * 포커스 링을 여기서 그리지 않는다 — 전역 `:focus-visible` 이 이미 건다.
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
