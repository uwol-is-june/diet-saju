import Link from "next/link";
import {
  PUBLIC_READING_TYPES,
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
 *
 * ## 설명을 덧붙이지 않는다 (TASK-34 · 35)
 *
 * 예전에는 목록 위에 "무엇을 볼까요?" 가, 아래에 "유형을 고르면 입력 화면으로 넘어갑니다"
 * 가 있었다. 둘 다 카드가 이미 보여주는 것이다 — 헤더가 무엇을 하는 화면인지 말하고,
 * 화살표 달린 링크 카드 셋이 누르면 넘어간다는 것을 그림으로 설명한다.
 *
 * **"입력한 정보는 저장하지 않습니다" 도 여기서 뺐다.** 약속이 사라진 것이 아니라
 * `FirstVisitNotice`(입력 화면) · 폼 아래 한 줄 · `app/privacy/page.tsx` 에 그대로 있고,
 * **정보를 넣기 직전에 보여야 뜻이 있다** (TASK-30 에서 안내를 옮긴 이유와 같다).
 * 처리방침 링크는 `SiteFooter` 가 모든 페이지에 깔아 둔다.
 *
 * 목록의 접근 가능한 이름은 `aria-label` 이 잇는다 — 화면에서 제목만 지우면 스크린리더
 * 사용자는 이 목록이 무엇인지 알 수 없다.
 */

/**
 * 카드 썸네일 자리 — **사진이 들어오기 전까지 쓰는 단색이다.**
 *
 * `READING_TYPES` 를 순서대로 돌려 쓴다. `Record<ReadingType, …>` 로 두지 않은 이유는
 * 이것이 **장식**이기 때문이다 — 유형이 늘었을 때 컴파일 오류로 잡아야 하는 것은 계약
 * (라벨·설명·섹션)이지 색이 아니다. 색은 모자라면 앞에서부터 다시 쓰면 된다.
 *
 * 사진으로 바꿀 때 지울 곳 목록은 `globals.css` 의 `--color-thumb-*` 정의 옆에 있다.
 */
const THUMBNAIL_TONES = ["bg-thumb-1", "bg-thumb-2", "bg-thumb-3"] as const;
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

      {/* 내부 유형은 목록에 내지 않는다 (TASK-41). `/admin` 에서만 들어간다. */}
      <ul aria-label="풀이 유형" className="space-y-3">
        {PUBLIC_READING_TYPES.map((type, index) => (
          <li key={type}>
            <Link
              href={`/reading/${type}`}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand hover:bg-brand-subtle"
            >
              {/* 장식이라 스크린리더에서 숨긴다 — 링크 이름은 아래 제목이 만든다 */}
              <span
                aria-hidden
                className={`size-14 shrink-0 rounded-xl ${
                  THUMBNAIL_TONES[index % THUMBNAIL_TONES.length]
                }`}
              />
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
    </main>
  );
}
