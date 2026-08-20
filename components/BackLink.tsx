import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

/**
 * 화면 맨 위에서 홈으로 돌아가는 링크 (TASK-42).
 *
 * ## 왜 필요했나
 *
 * 홈으로 가는 길이 **푸터 링크 하나뿐**이었다. `/privacy` · `/disclaimer` 는 문서가 길어서
 * 끝까지 스크롤해야 그 링크가 나오는데, 검색이나 공유 링크로 바로 들어온 사람에게는
 * 브라우저 뒤로가기도 없다. 읽다 말고 나갈 방법이 사실상 없었다.
 *
 * ## 한 곳에서만 정의한다
 *
 * 두 고지 페이지에 같은 조각을 각각 적으면 문구와 모양이 갈라진다. 라벨을 주지 않으면
 * 서비스 이름을 쓰므로 **고지 페이지는 둘 다 `<BackLink />` 한 줄**이면 된다.
 * `/reading/[type]` 은 맥락이 달라 자기 라벨을 넘긴다 (원래 그 화면에 있던 문구다).
 *
 * `next/link` 를 쓴다 — 새 탭·가운데 클릭·크롤러가 살아야 한다 (TASK-30 과 같은 이유).
 * `min-h-11`(44px)은 터치 타깃 최소 크기다.
 *
 * 서버 컴포넌트다. **현재 페이지면 링크를 죽이는 처리는 하지 않는다** — `usePathname()` 이
 * 필요해지고, 그러면 `/` 를 통째로 정적으로 두는 성질이 깨진다 (`SiteFooter` 와 같은 판단).
 */
export function BackLink({ label = "다이어트 사주" }: { label?: string }) {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center text-sm text-ink-muted transition hover:text-brand-ink"
    >
      ← {label}
    </Link>
  );
}

/**
 * 아이콘 꼴 뒤로가기 (TASK-93). `/reading/[type]` 맨 위 왼쪽에 놓인다.
 *
 * ## `history.back()` 이 아니다
 *
 * 브라우저 이력에 기대면 클라이언트 JS 가 필요하고, **검색·공유 링크로 바로 들어온
 * 사람에게는 돌아갈 이력이 없다** — `BackLink` 가 처음 생긴 이유가 그것이다. 그래서
 * 위 텍스트 링크와 같은 `next/link` 이고 목적지도 같은 `/` 다.
 *
 * ## 규격을 여기서 다시 만들지 않는다
 *
 * 44px 원형은 `buttonClass({ size: "icon" })` 이 정한다 (`components/ui/Button.tsx`).
 * `Button` 은 `<button>` 이라 링크로 쓸 수 없어 규격 문자열만 가져온다 — 같은 모양을
 * 두 곳에서 스타일링하면 한쪽만 고쳐진다.
 *
 * ## 이름은 글자가 아니라 `aria-label` 이 만든다
 *
 * 화살괄호는 `aria-hidden` 장식이다. 스크린리더가 "왼쪽 화살괄호" 를 읽으면 안 된다
 * (`SajuForm` 의 `수정` 아이콘 버튼과 같은 방식).
 *
 * **두 고지 페이지는 이걸 쓰지 않는다.** 그쪽은 문서가 길어서 어디로 가는지가 글자로
 * 읽혀야 하고, 아이콘만 남기면 목적지가 사라진다 — 위 `BackLink` 가 그 자리를 맡는다.
 */
export function BackIconLink({ label = "처음으로" }: { label?: string }) {
  return (
    <Link
      href="/"
      aria-label={label}
      className={buttonClass({ variant: "ghost", size: "icon", className: "-ml-2.5" })}
    >
      {/* 색은 `currentColor` 라 variant 를 그대로 따른다. 값을 박으면 `tokens.test.ts` 가
          이 파일에서 원시 색상을 찾아낸다. 굵기·둥근 끝은 다른 아이콘들과 같은 규격이다. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </Link>
  );
}
