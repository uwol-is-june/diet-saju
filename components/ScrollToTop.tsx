"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 맨 위로 가는 플로팅 버튼. 결과 화면이 길어 다 읽고 폼으로 돌아가는 데 스크롤이 오래 걸린다.
 *
 * **스크롤 리스너 대신 IntersectionObserver.** `scroll` 이벤트는 스로틀을 붙여도 매 프레임
 * 일이 생긴다 — 문서 맨 위에 보이지 않는 감시용 요소를 한 뼘(100vh) 깔면 그것이 화면에서
 * 벗어나는 **순간에만** 콜백이 온다. 임계값을 px 로 박지 않아도 되는 것은 덤이다.
 *
 * 감시용 요소는 `position: absolute; top: 0` 이라 `<body>` 어디에 있든 문서 맨 위에 놓이고
 * 흐름에서 빠져 레이아웃에 영향을 주지 않는다.
 *
 * **포커스를 일부러 옮기지 않는다.** 맨 위에 닿으면 버튼이 사라지고, 포커스를 가진 요소가
 * DOM 에서 빠지면 다음 Tab 이 **문서의 첫 번째 초점 가능 요소**로 간다 — 기대하는 위치다.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => {
      // 감시용 요소가 조금이라도 보이면 아직 위쪽이다.
      setVisible(!entry?.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function toTop() {
    /*
      `behavior: "smooth"` 를 명시하면 CSS `scroll-behavior` 가 무시되므로, 모션 최소화
      대응을 스타일시트에 맡길 수 없다. `SajuForm` 의 자동 스크롤과 같은 방식으로 여기서
      직접 판단한다 — 두 곳이 다르게 굴면 한쪽만 설정을 지키는 꼴이 된다.
    */
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-screen"
      />

      {visible && (
        <button
          type="button"
          onClick={toTop}
          aria-label="맨 위로"
          /*
            **등장만 애니메이션한다.** 키프레임을 `from` 만으로 두는 규칙 때문에 퇴장은
            만들 수 없다(사라질 때는 요소 자체가 없다) — 여기서는 그래도 괜찮다.

            `bottom` 에 안전 영역을 더해 iOS 홈 인디케이터를 피한다.

            `right` 는 **콘텐츠 열의 오른쪽 끝**이다. `right-5` 로 두면 데스크톱에서 이
            버튼만 뷰포트 오른쪽 끝에 홀로 떠 글과 멀어진다. 열이 화면을 꽉 채우는 폭에서는
            `max` 가 0 이라 같은 값이다. **`fixed` 를 유지한다** — `absolute` 로 바꾸면
            스크롤과 함께 밀려 올라간다.
          */
          className="anim-rise fixed right-[calc(max(0px,50vw-16rem)+1.25rem)] bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand-solid text-on-brand-solid shadow-lg transition hover:bg-brand-solid-hover"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      )}
    </>
  );
}
