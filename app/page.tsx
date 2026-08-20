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
 * ## 리스트 카드다 (TASK-86 · 레퍼런스 `docs/ui_ref/list_reference.jpg`)
 *
 * **TASK-64 의 두 칸 그리드를 뒤집었다** (2026-08-19 사용자 확정). 한 줄에 한 장씩 쌓고
 * 카드마다 **왼쪽 글 + 오른쪽 사진 + 오른쪽 아래 화살표**를 둔다.
 *
 * - **화살표를 되살렸다.** TASK-64 는 "카드는 면 전체가 링크라 화살표가 가리킬 방향이
 *   없다" 로 뺐다. 리스트 카드에서는 사정이 다르다 — 카드가 가로로 길어 오른쪽 끝이
 *   **줄의 끝**이 되고, 레퍼런스가 거기에 원형 화살표를 두는 이유도 그것이다. 장식이라
 *   `aria-hidden` 이고 링크 이름은 제목이 만든다.
 * - **`li` 의 `display: contents` 를 걷어냈다.** 그건 두 칸 그리드에서 같은 줄 카드의
 *   높이를 맞추려던 장치다. 한 줄에 한 장이면 맞출 상대가 없다.
 * - **설명 줄은 그대로 둔다** (TASK-64). 사진이 오른쪽을 먹어 글 폭이 좁아지므로 세 줄로
 *   자르되(`line-clamp-3`) **지우지는 않는다** — 거기가 `diet-food` 의 컨셉 한 줄이 사는
 *   곳이다. 열이 넓어지면(`sm:`) 저절로 다 들어간다.
 * - **묻는 것 한 줄이 제목 위에 붙는다** (`READING_TYPE_QUESTION`). 레퍼런스의 강조색
 *   윗줄 자리이고, 다섯 카드가 이름만으로는 비슷해 보이던 문제를 여기서 푼다.
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

/**
 * 카드 사이 등장 간격(ms) — 다섯 장이라 마지막이 300ms 뒤에 시작한다 (TASK-104).
 *
 * 도식들의 관례(45~70ms)와 같은 자리에 둔다. **목록 전체가 다 뜨는 시간**을 기준으로
 * 잡은 값이다 — 카드당 지연이 쌓이므로 100ms 로 올리면 마지막 카드가 0.5초 뒤에
 * 시작해 스크롤로 내려간 사람이 빈 자리를 본다.
 */
const CARD_STAGGER = 60;

export default async function HomePage() {
  /**
   * 저장소가 없거나 죽어도 화면은 그대로다 — 숫자 자리만 사라진다. 여기서 `null` 이면
   * 아래에서 그 줄을 그리지 않는다. **0 을 대신 보여주지 않는다**: 아무도 안 봤다는
   * 거짓말이 되는데 실제로는 셀 수가 없는 상태다.
   */
  const counters = await readCounters(revalidate);
  const counts = counters.state === "ok" ? counters.counts : null;

  return (
    /*
      카드를 누르면 이 화면이 왼쪽으로 밀려 나간다 (TASK-96). 감싸는 자리가 레이아웃이
      아니라 **페이지**여야 나가는 동작(`exit`)이 일어난다 — 근거는 `PageTransition`.
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
            카드마다 `CARD_STAGGER` 만큼 늦게 시작한다. 머리 띠가 0 이고 카드가 그 뒤를
            따르므로 마지막 카드는 300ms 뒤다 — 390px 에서 접힌 자리 아래라 기다리는
            느낌이 나지 않는다. **모션 최소화에서는 이 지연이 통째로 0 이 된다**
            (`globals.css` 의 `prefers-reduced-motion` 블록이 `animation-delay` 도 지운다).
          */
          <li
            key={type}
            className="anim-card-rise"
            style={{ animationDelay: `${(index + 1) * CARD_STAGGER}ms` }}
          >
            <Link
              href={`/reading/${type}`}
              /*
                이 이동이 "앞으로" 임을 알린다 (TASK-96). 값이 없으면 방향이 정해지지
                않아 전환이 그냥 바뀌는 것으로 떨어진다. 문자열은 `PageTransition` 이
                들고 있다 — 여기에 직접 적으면 CSS 클래스 이름과 세 곳이 갈린다.
              */
              transitionTypes={[NAV_FORWARD]}
              className="relative flex min-h-40 flex-col overflow-hidden rounded-3xl bg-surface-muted p-5 transition hover:bg-brand-subtle"
            >
              {/*
                오른쪽 면을 채우고 글 쪽으로 흐려진다 (TASK-86). 장식이라 `alt=""` 다.
                **첫 장만 `priority`** — 그것이 이 화면의 LCP 요소다 (TASK-87 실측:
                LCP 1.02 → 0.72초). 다섯 장 전부에 주면 preload 가 서로를 밀어낸다.
              */}
              <ReadingCardPhoto readingType={type} priority={index < 3} />

              {/*
                글은 사진 위에 온다(`relative`). 폭을 사진과 겹치지 않게 잡아야 흐려지는
                구간에 글자가 얹히지 않는다 — 사진 색은 팔레트 검사 밖이라 그 위에 글자를
                올리면 대비를 보증할 수 없다.

                **폭은 `100% - 사진 42%` 다** (TASK-99). 예전 `62%` 는 합이 104% 라
                설계상 겹쳐 있었고, 설명 줄이 실제로 사진 위로 4~12px 넘어갔다
                (390 · 360 · 1280px 셋 다). 여기서 %는 카드 **콘텐츠 폭**(패딩 안쪽)
                기준이고 사진 %는 **카드 폭** 기준이라, 58% 로 두면 왼쪽 패딩 20px 과
                58% 의 차이만큼인 **3.2px 가 어느 폭에서나 일정하게** 남는다.
                **62% 로 되돌리지 말 것** — 카드가 넓어질수록 겹침이 커진다.
              */}
              <div className="relative w-[58%] break-keep">
                <span className="block text-xs font-bold text-brand-ink">
                  {READING_TYPE_QUESTION[type]}
                </span>
                <span className="title-sm title-bold mt-1.5 block">
                  {READING_TYPE_LABEL[type]}
                </span>
                {/*
                  좁은 폭에서 세 줄로 자른다 — **지우지 않는다** (TASK-64). 열이 넓어지면
                  자동으로 다 보인다. **`block` 을 함께 주지 말 것** — `line-clamp` 이
                  `display: -webkit-box` 를 걸어야 동작하는데 `block` 이 그걸 덮는다
                  (실측에서 네 줄이 카드 밖으로 잘려 나갔다).
                */}
                <span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-muted sm:line-clamp-none">
                  {READING_TYPE_DESCRIPTION[type]}
                </span>
              </div>

              {/*
                바닥 줄 — 왼쪽에 조회수, 오른쪽에 화살표. `mt-auto` 로 카드 바닥에 붙인다
                (설명 길이가 유형마다 달라 그냥 두면 카드마다 이 줄의 높이가 어긋난다).
              */}
              <div className="relative mt-auto flex items-end justify-between pt-3">
                {counts ? (
                  /* 숫자만 나열하면 무엇인지 알 수 없다. 단위 낱말을 붙여 읽히게 한다. */
                  <span className="text-xs text-ink-muted">
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
                  만들고 스크린리더에 이 글리프가 읽히면 안 된다. 면을 흰색으로 두는 이유는
                  사진 위에 걸쳐도 대비가 유지돼야 하기 때문이다.
                */}
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-soft shadow-sm"
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
