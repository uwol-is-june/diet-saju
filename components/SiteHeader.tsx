import Link from "next/link";

/**
 * 콘텐츠 열 맨 위에 붙는 전역 헤더 (TASK-74).
 *
 * ## TASK-42 의 "전역 헤더를 두지 않는다" 를 뒤집었다
 *
 * 그때 반대한 이유는 **결과 화면에서 스트리밍 중에 시선을 뺏는다** 였고, 그 이유는
 * 사라진 것이 아니라 **감수한 것**이다. 대신 값을 최소로 치른다 — `h-14` 로 낮고
 * 로고 하나뿐이라 글 위에 얹힌 띠가 읽기를 방해하지 않는다. 실제로 거슬리면
 * `/reading/*` 에서만 sticky 를 푼다(레이아웃 한 곳만 고치면 된다).
 *
 * ## 검색을 받지 않는다
 *
 * 레퍼런스(web.dasii.kr) 헤더는 로고 + 검색인데 **우리에게는 검색 대상이 없다.**
 * 유형 다섯 개는 `/` 한 화면에 다 보인다.
 *
 * ## 서버 컴포넌트다
 *
 * 상태를 하나라도 들면 레이아웃에 있는 이 조각 때문에 **`/` 가 통째로 정적이라는 성질이
 * 깨진다** (`SiteFooter` 에서 `aria-current` 를 포기한 것과 같은 판단).
 *
 * ## 로고는 텍스트 워드마크다
 *
 * 이미지로 만들면 자산이 하나 늘고, 웹폰트를 얹으면 모바일 첫 화면 속도를 깎는다
 * (TASK-71 이 웹폰트를 넣지 않은 것과 같은 판단). 굵기와 자간으로 낸다.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line bg-surface/95 px-5 backdrop-blur">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-base font-bold tracking-tight"
      >
        <span aria-hidden className="size-2 rounded-full bg-brand" />
        다이어트 사주
      </Link>
    </header>
  );
}
