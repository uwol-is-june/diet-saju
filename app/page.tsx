import Link from "next/link";
import { readCounters } from "@/lib/counters";
import {
  PUBLIC_READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
} from "@/lib/saju/schema";
import { ReadingThumbnail } from "@/components/thumbnails/ReadingThumbnail";

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
 * 카드 면 전체가 링크라 누르면 넘어간다는 것을 hover 상태가 설명한다.
 *
 * ## 카드 그리드다 (TASK-64)
 *
 * 예전에는 세로로 쌓인 행이었다(썸네일 왼쪽 · 글 가운데 · 화살표 오른쪽). 지금은 **두 칸
 * 그리드**이고 카드마다 썸네일이 위에 있다.
 *
 * - **칸 수를 하드코딩하지 않는다.** 공개 유형이 홀수면 마지막 줄에 빈칸이 남는데,
 *   "첫 카드만 가로로 넓게" 같은 index 특례로 메우면 **유형이 하나 늘 때 조용히 깨진다.**
 * - **화살표를 뺐다.** 카드에서는 면 전체가 누를 곳이라 오른쪽 끝의 화살표가 가리킬 방향이
 *   없다. 행에서는 그 화살표가 "누르면 넘어간다" 를 설명했지만 카드에서는 테두리와 hover 가
 *   그 일을 한다.
 * - **설명 줄을 지우지 않는다.** 카드가 좁아지면 제일 먼저 지우고 싶어지는 자리인데,
 *   거기가 `diet-food` 의 컨셉 한 줄이 사는 곳이다. 좁아서 안 들어가면 설명이 아니라
 *   칸 수를 줄인다.
 * - `ul` / `li` 구조와 `aria-label` 은 그대로다 — `birth-input.test.ts` 가 소스에서 본다.
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
 * 조회수·좋아요를 카드에 띄우면서도 **이 페이지를 정적으로 둔다** (TASK-51).
 *
 * 클라이언트에서 fetch 하면 `/` 에 JS 가 들어와 위 "클라이언트 컴포넌트가 없다" 가 깨진다.
 * 대신 서버에서 읽고 그 결과를 5분간 재사용한다 — 숫자가 5분 늦지만 조회수가 실시간일
 * 이유가 없다. 저장소를 읽는 fetch 에 같은 시간을 걸어 두어 (`readCounters(300)`) 재생성
 * 때만 저장소를 두드린다.
 */
export const revalidate = 300;

export default async function HomePage() {
  /**
   * 저장소가 없거나 죽어도 화면은 그대로다 — 숫자 자리만 사라진다. 여기서 `null` 이면
   * 아래에서 그 줄을 그리지 않는다. **0 을 대신 보여주지 않는다**: 아무도 안 봤다는
   * 거짓말이 되는데 실제로는 셀 수가 없는 상태다.
   */
  const counters = await readCounters(revalidate);
  const counts = counters.state === "ok" ? counters.counts : null;

  return (
    <>
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
      <ul aria-label="풀이 유형" className="grid grid-cols-2 gap-3 sm:gap-4">
        {PUBLIC_READING_TYPES.map((type) => (
          <li key={type} className="contents">
            {/*
              `li` 에 `contents` 를 주어 **카드(`a`)가 직접 그리드 칸이 되게** 한다.
              그래야 같은 줄의 카드들이 같은 높이로 늘어나 아래 카운트 줄이 나란히 선다
              (`li` 가 칸이면 그 안의 `a` 는 내용 높이에 머문다).
            */}
            <Link
              href={`/reading/${type}`}
              className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-brand hover:bg-brand-subtle sm:p-5"
            >
              {/* 유형별 모티프 (TASK-50). 장식이라 스크린리더에서 숨긴다 —
                  링크 이름은 아래 제목이 만든다. `Record` 라 유형이 늘면 컴파일이 막는다. */}
              <ReadingThumbnail readingType={type} />
              <span className="mt-3 block font-bold">{READING_TYPE_LABEL[type]}</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                {READING_TYPE_DESCRIPTION[type]}
              </span>
              {counts && (
                /*
                  숫자만 나열하면 무엇인지 알 수 없다. 단위 낱말을 붙여 읽히게 한다.
                  `mt-auto` 로 카드 바닥에 붙여 둔다 — 설명 길이가 유형마다 달라서
                  그냥 두면 같은 줄의 두 카드에서 이 줄의 높이가 어긋난다.
                */
                <span className="mt-auto block pt-3 text-xs text-ink-muted">
                  조회 {counts[type].views.toLocaleString("ko-KR")}
                  {counts[type].likes > 0 && (
                    <> · 도움됐어요 {counts[type].likes.toLocaleString("ko-KR")}</>
                  )}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
