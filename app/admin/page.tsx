import type { Metadata } from "next";
import Link from "next/link";
import {
  INTERNAL_READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
} from "@/lib/saju/schema";

/**
 * 내부 유형 입구 (TASK-41).
 *
 * ## 인증이 없다 — 숨김이지 보호가 아니다
 *
 * 이 주소를 아는 사람은 누구나 들어온다. 지금 목적은 **본인이 다른 사주 서비스와 결과를
 * 대조하는 것**이고, 여기 있는 것은 비밀이 아니라 "메인에서 내린 유형" 일 뿐이라 그것으로
 * 충분하다. **나중에 진짜 관리 기능(사용량 조회·설정 변경 등)을 붙이려면 그 전에 인증을
 * 먼저 넣어야 한다.** 지금 없다는 사실을 모르고 기능만 얹으면 그대로 공개된다.
 *
 * `noindex` 는 검색 유입만 막는다. 접근 제어가 아니다.
 *
 * ## 정적 서버 컴포넌트다
 *
 * `/` 와 같은 이유로 클라이언트 컴포넌트를 두지 않는다. 링크 목록뿐이라 JS 가 필요 없다.
 */

export const metadata: Metadata = {
  title: "내부 유형 | 다이어트 사주",
  /**
   * 메인에서 링크가 사라져도 이미 색인됐을 수 있고, 검색에서 들어오면 내린 의미가 없다.
   * `/reading/general` 쪽 `noindex` 는 `app/reading/[type]/page.tsx` 가 붙인다.
   */
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <header className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">내부 유형</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          메인 유형 선택에서 내린 풀이입니다. 다른 사주 서비스와 결과를 대조하는 용도로만
          씁니다.
        </p>
      </header>

      {INTERNAL_READING_TYPES.length === 0 ? (
        <p className="text-sm text-ink-muted">내린 유형이 없습니다.</p>
      ) : (
        <ul aria-label="내부 풀이 유형" className="space-y-3">
          {INTERNAL_READING_TYPES.map((type) => (
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
                <span
                  aria-hidden
                  className="shrink-0 text-ink-muted transition group-hover:text-brand-ink"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
