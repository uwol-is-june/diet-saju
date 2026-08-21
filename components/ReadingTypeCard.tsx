import Link from "next/link";
import {
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  READING_TYPE_QUESTION,
  type ReadingType,
} from "@/lib/saju/schema";
import { NAV_FORWARD } from "./PageTransition";
import { ReadingCardPhoto } from "./ReadingCardPhoto";

/**
 * 유형 카드 — **`/` 와 결과 화면 맨 아래가 같은 부품을 쓴다** (TASK-110 · 115).
 *
 * 둘 다 "다음에 무엇을 볼까" 를 고르는 자리인데 예전에는 `/` 는 사진 카드, 결과 화면은
 * 회색 상자 안의 글자 줄이었다. **각자 그리면 규격이 두 벌이 된다** (`components/CLAUDE.md`
 * 의 "부품만 만들고 호출부를 안 바꾸면" 규칙).
 *
 * **`"use client"` 를 붙이지 않는다.** `/` 는 통째로 정적이어야 하고(빌드 표에서
 * `○ (Static)` 확인), 클라이언트 트리(`SajuForm` → `OtherReadingLinks`)에서 쓰이는 것만으로
 * 그 성질이 깨지지는 않는다. **`lib/counters` 같은 서버 모듈을 이 안으로 끌어들이지 말 것** —
 * 그 순간 클라이언트 쪽 호출부가 깨진다.
 *
 * **사진 전면 + 어둠 + 흰 글씨**이고 규칙은 판정 콜아웃과 같다 — 대비를 보증하는 것은 사진이
 * 아니라 `.card-cover` 의 스크림이고(`tokens.test.ts` 가 그 알파를 잰다), 글자·화살표는
 * `on-photo*` 토큰만 쓴다. **위계는 무게와 크기로만** 만든다.
 *
 * **`<li>` 는 호출부가 씌운다.** 등장 애니메이션(`anim-card-rise`)도 호출부 몫이다 —
 * `/` 는 위에서부터 차례로 떠오르지만(TASK-104) 결과 화면은 스크롤로 내려가 만나는 자리라
 * 지연을 주면 빈 카드를 보게 된다.
 */
export function ReadingTypeCard({
  type,
  priority = false,
  counts = null,
}: {
  type: ReadingType;
  /**
   * `/` 의 **첫 세 장만** 받는다 (그중 첫 장이 그 화면의 LCP 요소다). 결과 화면 카드는
   * 스크롤 아래에 있어 LCP 가 아니므로 주지 않는다 — 전부에 주면 preload 가 서로를 밀어낸다.
   */
  priority?: boolean;
  /**
   * 조회수·좋아요. **`null` 이면 그 자리를 비운다** — 0 을 대신 보여주지 않는다(TASK-51).
   *
   * 결과 화면은 언제나 `null` 이다. `/` 는 서버에서 한 번 읽어 정적으로 굽지만
   * (`readCounters`) 결과 화면은 클라이언트 트리라 그 값이 없고, **거기서 fetch 하면
   * 풀이 한 번에 요청이 유형 수만큼 더 붙는다.**
   */
  counts?: { views: number; likes: number } | null;
}) {
  return (
    <Link
      href={`/reading/${type}`}
      /*
        이 이동이 "앞으로" 임을 알린다 — 값이 없으면 방향이 정해지지 않는다.
        **문자열은 `PageTransition` 이 들고 있다** (직접 적으면 세 곳이 갈린다).
      */
      transitionTypes={[NAV_FORWARD]}
      /*
        **최소 높이는 판정 콜아웃과 같은 13rem 이다.** 사진이 전면에 깔리면 글 세 줄이
        정하는 높이로는 카드가 띠 한 줄로 보인다.

        **면 색을 hover 로 바꾸지 않는다** — 사진에 덮여 보이지 않는다. 그 일은
        `.card-cover:hover` 가 스크림을 깊게 하는 쪽으로 한다.
      */
      className="card-cover flex min-h-52 flex-col overflow-hidden rounded-3xl p-5 transition"
    >
      {/* 카드를 통째로 덮고 그 위에 어둠이 깔린다. 장식이라 `alt=""` 다. */}
      <ReadingCardPhoto readingType={type} priority={priority} />

      {/*
        글이 사진 위에 온다. **폭을 잡지 않는다** — 어둠이 카드 전체에 깔리므로 글이 열 폭을
        다 쓴다 (예전 `w-[58%]` 는 사진이 오른쪽 42% 만 덮던 때의 값이고 되살리지 말 것).
      */}
      <div className="relative z-10 break-keep">
        <span className="block text-xs font-bold text-on-photo-dim">
          {READING_TYPE_QUESTION[type]}
        </span>
        <span className="title-sm title-bold mt-1.5 block text-on-photo">
          {READING_TYPE_LABEL[type]}
        </span>
        {/*
          좁은 폭에서 세 줄로 자른다 — **지우지 않는다** (TASK-64). 열이 넓어지면 자동으로
          다 보인다. **`block` 을 함께 주지 말 것** — `line-clamp` 이 `display: -webkit-box`
          를 걸어야 동작하는데 `block` 이 그걸 덮는다.
        */}
        <span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-on-photo-dim sm:line-clamp-none">
          {READING_TYPE_DESCRIPTION[type]}
        </span>
      </div>

      {/*
        바닥 줄 — 왼쪽에 조회수, 오른쪽에 화살표. `mt-auto` 로 카드 바닥에 붙인다
        (설명 길이가 유형마다 달라 그냥 두면 카드마다 이 줄의 높이가 어긋난다).
      */}
      <div className="relative z-10 mt-auto flex items-end justify-between pt-3">
        {counts ? (
          /* 숫자만 나열하면 무엇인지 알 수 없다. 단위 낱말을 붙여 읽히게 한다. */
          <span className="text-xs text-on-photo-dim">
            조회 {counts.views.toLocaleString("ko-KR")}
            {counts.likes > 0 && <> · 도움됐어요 {counts.likes.toLocaleString("ko-KR")}</>}
          </span>
        ) : (
          <span />
        )}

        {/*
          줄의 끝을 알리는 원형 화살표. **장식이다** — 링크 이름은 제목이 만들고 스크린리더에
          이 글리프가 읽히면 안 된다. 글자와 같은 흰색으로 두고 테두리만 흐린 흰색으로 그린다
          (흰 면 + 어두운 글리프로 두면 어둠 위에 붙은 딱지처럼 보인다).
        */}
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-on-photo-dim text-on-photo"
        >
          →
        </span>
      </div>
    </Link>
  );
}
