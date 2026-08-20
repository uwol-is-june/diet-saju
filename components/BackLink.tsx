import Link from "next/link";
import { NAV_BACK } from "@/components/PageTransition";
import { buttonClass } from "@/components/ui/Button";

/**
 * 화면 맨 위에서 홈으로 돌아가는 링크. 두 고지 페이지(`/privacy` · `/disclaimer`)가 쓴다 —
 * **문서가 길어** 푸터 링크까지 스크롤을 되감아야 하고, 검색·공유 링크로 들어온 사람에게는
 * 뒤로가기도 없다.
 *
 * **한 곳에서만 정의한다** (같은 조각을 각각 적으면 문구와 모양이 갈라진다). 라벨 기본값이
 * 있어 **`<BackLink />` 한 줄**이면 된다.
 *
 * `next/link` 여야 새 탭·가운데 클릭·크롤러가 산다. `min-h-11`(44px)은 터치 타깃 최소 크기다.
 *
 * 서버 컴포넌트다. **현재 페이지면 링크를 죽이는 처리는 하지 않는다** — `usePathname()` 이
 * 필요해지고 그러면 `/` 의 정적 성질이 깨진다.
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
 * 아이콘 꼴 뒤로가기. `/reading/[type]` 맨 위 왼쪽, **히어로 사진 위**에 놓인다.
 *
 * 사진 안의 색은 `tokens.test.ts` 가 닿지 않으므로 `ghost`(면 없음)로 두면 사진에 따라
 * 아이콘이 보이거나 안 보인다 — 그래서 **`surface`**(자기 면을 들고 가는 variant)다.
 *
 * **자리(`absolute`)는 호출부가 정한다** — 음수 여백으로 사진을 펼치는 것과 같은 요소에
 * 위치 기준이 있어야 한다. 여기서 위치까지 박으면 두 파일을 맞춰야 한다.
 *
 * **`history.back()` 이 아니다** — 이력에 기대면 클라이언트 JS 가 필요하고 검색·공유
 * 링크로 들어온 사람에게는 돌아갈 이력이 없다. `next/link` 로 `/` 에 간다.
 *
 * **규격을 여기서 다시 만들지 않는다** — 44px 원형은 `buttonClass({ size: "icon" })` 이
 * 정한다(`Button` 은 `<button>` 이라 링크로 쓸 수 없어 문자열만 가져온다).
 *
 * **이름은 `aria-label` 이 만든다** (화살괄호는 `aria-hidden` 장식이다).
 *
 * **두 고지 페이지는 이걸 쓰지 않는다** — 문서 상단에서는 어디로 가는지가 글자로 읽혀야 한다.
 *
 * `transitionTypes={[NAV_BACK]}` 가 방향을 정한다. **위 `BackLink` 에는 붙이지 않는다** —
 * 그쪽은 `PageTransition` 밖이라 한쪽만 달면 절반짜리 전환이 된다.
 */
export function BackIconLink({ label = "처음으로" }: { label?: string }) {
  return (
    <Link
      href="/"
      aria-label={label}
      transitionTypes={[NAV_BACK]}
      className={buttonClass({ variant: "surface", size: "icon" })}
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
