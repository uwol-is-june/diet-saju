import Link from "next/link";

/**
 * 모든 페이지 하단에 붙는다 (app/layout.tsx).
 * 법적 고지 접근 경로를 항상 노출하는 것이 목적이다.
 *
 * 아래 여백이 넉넉한 이유: 문서 끝까지 내려오면 "맨 위로" 버튼(고정, 우측 하단)이
 * 화면 아래 64px 안에 떠 있어 이 문단의 오른쪽 끝을 가린다 (TASK-29).
 * 버튼 크기(44px) + 아래 여백(20px)보다 큰 값이어야 한다.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-2xl px-5 pb-24 text-center">
      <div className="border-t border-line pt-6">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          <Link href="/" className="text-ink-muted hover:text-brand-ink">
            사주 풀이
          </Link>
          <Link href="/disclaimer" className="text-ink-muted hover:text-brand-ink">
            면책 고지
          </Link>
          <Link href="/privacy" className="text-ink-muted hover:text-brand-ink">
            개인정보 처리방침
          </Link>
        </nav>
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          오락·참고 목적의 콘텐츠입니다. 의학적·법률적 조언이 아닙니다.
          <br />
          입력한 생년월일은 저장하지 않으며, 해석문 생성을 위해 Google 로 전송됩니다.
        </p>
      </div>
    </footer>
  );
}
