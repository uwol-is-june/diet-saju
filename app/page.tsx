import { readCounters } from "@/lib/counters";
import { PUBLIC_READING_TYPES } from "@/lib/saju/schema";
import { PageTransition } from "@/components/PageTransition";
import { ReadingTypeCard } from "@/components/ReadingTypeCard";

/**
 * 유형 선택 화면. **클라이언트 컴포넌트가 없다** — 이 페이지는 통째로 정적이다.
 * 카드는 버튼 + `router.push` 가 아니라 **`next/link`** 여야 새 탭·가운데 클릭·크롤러가 산다.
 *
 * **화면이 이미 말하는 것을 문장으로 되풀이하지 않는다** — 목록 위아래의 안내 줄은 카드가
 * 하는 일을 설명하던 것이라 없앴다.
 *
 * 리스트 카드다. 한 줄에 한 장씩 쌓고 **카드 자체는 `ReadingTypeCard` 가 그린다** (TASK-115) —
 * 결과 화면 맨 아래가 같은 부품을 쓰므로 여기서 다시 그리면 규격이 두 벌이 된다.
 *
 * - 이 페이지가 정하는 것은 **목록 구조와 등장 순서**뿐이다.
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
            {/*
              카드 규격은 **부품 하나**가 정한다 (TASK-115) — 결과 화면 맨 아래
              `OtherReadingLinks` 가 같은 부품을 쓴다. 여기서 다시 그리면 규격이 두 벌이 된다.

              **첫 세 장만 `priority`** — 그중 첫 장이 이 화면의 LCP 요소다 (TASK-87 실측:
              LCP 1.02 → 0.72초). 다섯 장 전부에 주면 preload 가 서로를 밀어낸다.
            */}
            <ReadingTypeCard
              type={type}
              priority={index < 3}
              counts={counts ? counts[type] : null}
            />
          </li>
        ))}
      </ul>
    </PageTransition>
  );
}
