import { ViewTransition } from "react";

/**
 * 화면 사이 좌우 밀림 전환. `/` 의 카드를 누르면 상세가 **오른쪽에서 밀려 들어오고**
 * 뒤로가기는 반대로 나간다 — 두 화면이 같은 사진을 쓰는데 전환에서 끊기던 자리다.
 *
 * **`/` 에 클라이언트 JS 를 들이지 않는 것이 설계의 축이다.** 라우터 전환에 JS 상태를 들면
 * `/` 가 동적이 되어 "유형 선택 화면은 통째로 정적" 이 깨진다. 그래서 이 컴포넌트는
 * **이름표만 붙이고 움직임은 전부 `globals.css` 가 만든다** — 클라이언트 지시문도 상태도
 * 없고 `motion.test.ts` 가 소스에서 확인한다.
 *
 * **방향은 링크가 말한다.** 링크의 `transitionTypes` 가 아래 표에서 CSS 클래스가 되고
 * `globals.css` 의 `::view-transition-*(.nav-*)` 가 그 방향으로 민다.
 * **앞뒤가 같은 방향이면 전환이 앞뒤를 구분해 주지 못한다.** 여기 없는 이동은 `none` 이다.
 *
 * 브라우저 뒤로가기·스와이프에도 유형이 실리지 않아 `none` 이다 — 이력 이동에 방향을
 * 지어내면 실제 이력과 어긋난 방향이 나올 수 있다.
 *
 * **레이아웃이 아니라 페이지마다 감싼다.** 레이아웃은 이동에서 다시 렌더되지 않아
 * `enter`/`exit` 가 아예 일어나지 않는다 — 한쪽만 감싸면 절반짜리 전환이 된다.
 */

/** `/` → `/reading/[type]`. 나가는 화면이 왼쪽으로, 들어오는 화면이 오른쪽에서. */
export const NAV_FORWARD = "nav-forward";

/** `/reading/[type]` → `/`. 위와 반대 방향. */
export const NAV_BACK = "nav-back";

/**
 * 전환 유형 → CSS 클래스 표. `enter` 와 `exit` 가 같은 표를 쓰는 것이 요점이다 —
 * 한 번의 이동에서 나가는 화면과 들어오는 화면이 **같은 방향으로** 흘러야 한 덩어리가
 * 밀려나는 것으로 읽힌다. 좌우 어느 쪽으로 갈지는 CSS 가 old/new 로 갈라 정한다.
 */
const DIRECTION = {
  [NAV_FORWARD]: NAV_FORWARD,
  [NAV_BACK]: NAV_BACK,
  default: "none",
} as const;

export function PageTransition({ children }: { children: React.ReactNode }) {
  /**
   * `default="none"` 이 없으면 이 `<ViewTransition>` 이 **관계없는 전환마다** 제 크로스
   * 페이드를 돌린다. 방향이 붙은 이동에서만 움직이게 못 박는다.
   */
  return (
    <ViewTransition enter={DIRECTION} exit={DIRECTION} default="none">
      {children}
    </ViewTransition>
  );
}
