import Link from "next/link";

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
