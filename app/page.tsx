import Link from "next/link";
import {
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
} from "@/lib/saju/schema";

/**
 * 유형 선택 화면 (TASK-30).
 *
 * **클라이언트 컴포넌트가 없다** — 첫 방문 안내는 정보를 넣기 직전에 뜻이 있으므로
 * `/reading/[type]` 으로 옮겼다. 그래서 이 페이지는 통째로 정적이다.
 *
 * 카드는 버튼 + `router.push` 가 아니라 **`next/link`** 다. 새 탭·가운데 클릭·크롤러가
 * 다 동작해야 한다.
 */
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium tracking-widest text-brand-ink">DIET SAJU</p>
        <h1 className="mb-3 text-3xl font-bold tracking-tight">사주로 읽는 나의 기질</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          생년월일시로 사주 원국(사주팔자)을 계산하고,
          <br />
          오행 균형을 바탕으로 타고난 기질과 생활 습관을 풀어드립니다.
        </p>
      </header>

      <h2 className="mb-3 text-sm font-medium text-ink-soft">무엇을 볼까요?</h2>
      <ul className="space-y-3">
        {READING_TYPES.map((type) => (
          <li key={type}>
            <Link
              href={`/reading/${type}`}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand hover:bg-brand-subtle"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{READING_TYPE_LABEL[type]}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                  {READING_TYPE_DESCRIPTION[type]}
                </span>
              </span>
              {/* 장식용 화살표라 스크린리더에서 숨긴다 — 링크 이름은 위 제목이 만든다 */}
              <span aria-hidden className="shrink-0 text-ink-muted transition group-hover:text-brand-ink">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-muted">
        유형을 고르면 생년월일을 입력하는 화면으로 넘어갑니다.
        <br />
        입력한 정보는 저장하지 않습니다.
      </p>
    </main>
  );
}
