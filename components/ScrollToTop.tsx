"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 맨 위로 가는 플로팅 버튼 (TASK-29).
 *
 * 결과 화면이 길다 — 원국 카드 + 도식 둘 + 대운·세운 + 풀이 8절(문장마다 문단) + 공유 카드.
 * 다 읽고 폼으로 돌아가는 데 스크롤이 오래 걸려서 만들었다.
 *
 * ## 스크롤 리스너 대신 IntersectionObserver
 *
 * `scroll` 이벤트는 스크롤하는 내내 발생해서 rAF 스로틀을 붙여도 매 프레임 일이 생긴다.
 * 문서 맨 위에 보이지 않는 **감시용 요소**를 한 뼘(100vh) 높이로 깔아 두면, 그것이
 * 화면에서 벗어나는 **순간에만** 콜백이 온다. 임계값을 px 로 박지 않아도 되는 것은 덤이다 —
 * 화면 한 판만큼 내려왔다는 뜻이 기기 크기와 무관하게 유지된다.
 *
 * 감시용 요소는 `position: absolute; top: 0` 이다. `body` 에 `position` 이 없으므로
 * 최초 컨테이닝 블록(= 문서 원점)을 기준으로 잡혀, 이 컴포넌트가 `<body>` 어디에 있든
 * 문서 맨 위에 놓인다. 흐름에서 빠져 있어 레이아웃에 영향을 주지 않는다.
 *
 * ## 포커스는 일부러 옮기지 않는다
 *
 * 맨 위에 닿으면 버튼이 사라진다. 포커스를 가진 요소가 DOM 에서 빠지면 브라우저가 포커스를
 * `<body>` 로 되돌리고, 그다음 Tab 은 **문서의 첫 번째 초점 가능 요소**로 간다. 맨 위로
 * 이동한 뒤 기대하는 바로 그 위치다. 별도로 `<h1>`·`<main>` 에 `tabIndex` 를 심어 옮기는
 * 방법도 있지만, 우리 트리 밖 요소를 건드리게 되는데 얻는 것이 같다.
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
            등장만 애니메이션한다. 키프레임을 `from` 만으로 두는 규칙(TASK-25) 때문에
            퇴장은 만들 수 없다 — 사라질 때는 요소 자체가 없어지므로 재생할 자리가 없다.
            여기서는 그래도 괜찮다. 위로 올라가는 동안 버튼이 사라지는 것은 목적지에
            닿았다는 신호라, 서서히 사라지는 편보다 오히려 분명하다.

            `bottom` 에 안전 영역을 더해 iOS 홈 인디케이터를 피한다.
          */
          className="anim-rise fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-50 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand-solid text-on-brand-solid shadow-lg transition hover:bg-brand-solid-hover"
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
