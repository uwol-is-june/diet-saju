import Link from "next/link";
import { readCounters } from "@/lib/counters";
import {
  PUBLIC_READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  READING_TYPE_QUESTION,
} from "@/lib/saju/schema";
import { NAV_FORWARD, PageTransition } from "@/components/PageTransition";
import { ReadingCardPhoto } from "@/components/ReadingCardPhoto";

/**
 * 유형 선택 화면. **클라이언트 컴포넌트가 없다** — 이 페이지는 통째로 정적이다.
 * 카드는 버튼 + `router.push` 가 아니라 **`next/link`** 여야 새 탭·가운데 클릭·크롤러가 산다.
 *
 * **화면이 이미 말하는 것을 문장으로 되풀이하지 않는다** — 목록 위아래의 안내 줄은 카드가
 * 하는 일을 설명하던 것이라 없앴다.
 *
 * 리스트 카드다 (레퍼런스 `docs/ui_ref/list_reference.jpg`). 한 줄에 한 장씩 쌓고 카드마다
 * **왼쪽 글 + 오른쪽 사진 + 오른쪽 아래 화살표**를 둔다.
 *
 * - 화살표는 카드가 가로로 길어 오른쪽 끝이 **줄의 끝**이 되는 자리다. `aria-hidden`
 *   장식이고 링크 이름은 제목이 만든다.
 * - **설명 줄을 지우지 않는다.** 사진이 오른쪽을 먹어 좁아지므로 `line-clamp-3` 으로
 *   자르되 남긴다 — 거기가 `diet-food` 의 컨셉 한 줄이 사는 곳이다.
 * - **묻는 것 한 줄이 제목 위에 붙는다** (`READING_TYPE_QUESTION`) — 다섯 카드가 이름만
 *   으로는 비슷해 보이던 문제를 여기서 푼다.
 * - `ul` / `li` 구조와 `aria-label` 은 `birth-input.test.ts` 가 소스에서 본다.
 *   **`aria-label` 을 지우지 말 것** — 화면에 목록 제목이 없어 스크린리더가 알 길이 없다.
 *
 * **"저장하지 않습니다" 는 여기 두지 않는다** — 정보를 넣기 직전에 보여야 뜻이 있어
 * `FirstVisitNotice`(입력 화면)와 `app/privacy/page.tsx` 가 든다.
 */

/**
 * 조회수·좋아요를 띄우면서도 **이 페이지를 정적으로 둔다.** 클라이언트에서 fetch 하면
 * `/` 에 JS 가 들어와 위 규칙이 깨진다 — 서버에서 읽고 5분간 재사용한다
 * (`readCounters(300)` 에 같은 시간을 걸어 재생성 때만 저장소를 두드린다).
 */
export const revalidate = 300;

/**
 * 카드 사이 등장 간격(ms). **기준은 목록 전체가 다 뜨는 시간**이다 — 카드당 지연이 쌓이므로
 * 올리면 마지막 카드가 늦게 시작해 스크롤로 내려간 사람이 빈 자리를 본다.
 */
const CARD_STAGGER = 60;

export default async function HomePage() {
  /**
   * 저장소가 죽어도 화면은 산다 — `null` 이면 그 줄을 그리지 않는다.
   * **0 을 대신 보여주지 않는다** (아무도 안 봤다는 거짓말이 된다).
   */
  const counters = await readCounters(revalidate);
  const counts = counters.state === "ok" ? counters.counts : null;

  return (
    /*
      카드를 누르면 이 화면이 왼쪽으로 밀려 나간다. 감싸는 자리가 레이아웃이 아니라
      **페이지**여야 `exit` 가 일어난다 — 근거는 `PageTransition`.
    */
    <PageTransition>
      {/*
        머리 부분은 레퍼런스를 그대로 받는다 — **강조색 윗줄 + 큰 두 줄 제목**, 그리고
        위쪽에서 옅게 시작해 본문 흰 면으로 풀리는 배경.

        음수 여백으로 콘텐츠 열의 좌우·위 여백(`main` 의 `px-5 py-10`)을 넘어 **열 끝까지**
        면을 펼친다. 안 그러면 띠가 본문 폭에만 걸려 잘린 사각형으로 보인다.
        색은 시맨틱 토큰이고 유형별로 갈지 않는다 (확정 결정: 테마를 유형별로 두지 않는다).
      */}
      {/*
        머리 띠부터 카드 다섯까지 **위에서부터 차례로** 떠오른다 (TASK-104). 목록을 훑는
        방향(위 → 아래)과 같은 방향이라 순서가 그대로 읽힌다.

        **라이브러리를 넣지 않는다.** 이 화면은 통째로 정적이고 클라이언트 컴포넌트가
        하나도 없다 — 등장 효과 하나 때문에 그 성질을 내주지 않는다. 서버 컴포넌트가
        인라인 `style` 로 지연만 박아 내보내면 정적 HTML 그대로다(도식 넷이 이미 그
        방식이다). 움직임은 전부 `globals.css` 의 `.anim-card-rise` 가 정한다.
      */}
      <header className="anim-card-rise -mx-5 -mt-10 mb-7 bg-gradient-to-b from-brand-subtle to-canvas px-5 pt-12 pb-8 text-center">
        <p className="text-sm font-bold text-brand-ink">생년월일시로 계산한 사주 원국에서</p>
        <h1 className="title-lg title-extrabold mt-2">나의 기질과 몸을 읽어드립니다</h1>
      </header>

      {/* 내부 유형은 목록에 내지 않는다 (TASK-41). `/admin` 에서만 들어간다. */}
      <ul aria-label="풀이 유형" className="flex flex-col gap-3">
        {PUBLIC_READING_TYPES.map((type, index) => (
          /*
            카드마다 `CARD_STAGGER` 만큼 늦게 시작한다 (머리 띠가 0 이고 카드가 뒤를 따른다).
            **모션 최소화에서는 이 지연이 통째로 0 이 된다** — `globals.css` 의
            `prefers-reduced-motion` 블록이 `animation-delay` 도 지운다.
          */
          <li
            key={type}
            className="anim-card-rise"
            style={{ animationDelay: `${(index + 1) * CARD_STAGGER}ms` }}
          >
            <Link
              href={`/reading/${type}`}
              /*
                이 이동이 "앞으로" 임을 알린다 — 값이 없으면 방향이 정해지지 않는다.
                **문자열은 `PageTransition` 이 들고 있다** (직접 적으면 세 곳이 갈린다).
              */
              transitionTypes={[NAV_FORWARD]}
              /*
                **최소 높이는 판정 콜아웃과 같은 13rem 이다** (TASK-110). 사진이 전면에
                깔리면 글 세 줄이 정하는 높이(약 160px)로는 카드가 띠 한 줄로 보인다 —
                `.verdict-cover` 가 같은 이유로 같은 값을 든다.

                **면 색을 hover 로 바꾸지 않는다** — 사진에 덮여 보이지 않는다. 그 일은
                `.card-cover:hover` 가 스크림을 깊게 하는 쪽으로 한다.
              */
              className="card-cover flex min-h-52 flex-col overflow-hidden rounded-3xl p-5 transition"
            >
              {/*
                카드를 통째로 덮고 그 위에 어둠이 깔린다 (TASK-110). 장식이라 `alt=""` 다.
                **첫 세 장만 `priority`** — 그중 첫 장이 이 화면의 LCP 요소다 (TASK-87 실측:
                LCP 1.02 → 0.72초). 다섯 장 전부에 주면 preload 가 서로를 밀어낸다.
              */}
              <ReadingCardPhoto readingType={type} priority={index < 3} />

              {/*
                글이 사진 위에 온다 (TASK-110). **폭을 잡지 않는다** — 예전에는 사진이
                오른쪽 42% 만 덮어 글을 `w-[58%]` 로 묶어 두어야 했고(합이 100% 를 넘으면
                설명 줄이 흐려지는 면 위로 넘어갔다), 이제 어둠이 카드 전체에 깔리므로
                글이 열 폭을 다 쓴다.

                **위계는 무게와 크기로만 만든다** — 색은 흰색 하나이고 흐린 흰색도 같은
                계산에서 나온 알파다 (`text-on-photo*` 밖의 색을 여기 쓰지 말 것).
                예전 `묻는 것` 줄의 `text-brand-ink` 는 어둠 위에서 대비를 보증할 수 없다.
              */}
              <div className="relative z-10 break-keep">
                <span className="block text-xs font-bold text-on-photo-dim">
                  {READING_TYPE_QUESTION[type]}
                </span>
                <span className="title-sm title-bold mt-1.5 block text-on-photo">
                  {READING_TYPE_LABEL[type]}
                </span>
                {/*
                  좁은 폭에서 세 줄로 자른다 — **지우지 않는다** (TASK-64). 열이 넓어지면
                  자동으로 다 보인다. **`block` 을 함께 주지 말 것** — `line-clamp` 이
                  `display: -webkit-box` 를 걸어야 동작하는데 `block` 이 그걸 덮는다
                  (실측에서 네 줄이 카드 밖으로 잘려 나갔다).
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
                    조회 {counts[type].views.toLocaleString("ko-KR")}
                    {counts[type].likes > 0 && (
                      <> · 도움됐어요 {counts[type].likes.toLocaleString("ko-KR")}</>
                    )}
                  </span>
                ) : (
                  /* 저장소가 죽으면 그 자리를 비운다 — 0 을 보여주지 않는다 (TASK-51). */
                  <span />
                )}

                {/*
                  줄의 끝을 알리는 원형 화살표 (레퍼런스). **장식이다** — 링크 이름은 제목이
                  만들고 스크린리더에 이 글리프가 읽히면 안 된다.

                  예전에는 흰 면 + 어두운 글리프였다. 사진이 전면에 깔리면 카드에서 흰 면이
                  이것 하나만 남아 **어둠 위에 붙은 딱지처럼 보인다.** 글자와 같은 흰색으로
                  두고 테두리만 흐린 흰색으로 그린다 (`text-on-photo*` 밖의 색을 쓰지 않는다).
                */}
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-on-photo-dim text-on-photo"
                >
                  →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageTransition>
  );
}
