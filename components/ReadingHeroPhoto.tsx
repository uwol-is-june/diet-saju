import Image from "next/image";
import { READING_TYPE_PHOTO } from "@/lib/reading/type-photo";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * `/reading/[type]` 상단 히어로 사진 (TASK-92).
 *
 * ## TASK-70 의 "화면 가운데 큰 캐릭터를 받는다" 를 뒤집었다
 *
 * 캐릭터(`ReadingCharacter.tsx`)는 지웠다. 되돌리는 것이니 왜인지를 남긴다.
 *
 * - **`/` 가 사진으로 바뀌면서(TASK-86) 두 화면의 그림 언어가 갈라졌다.** 카드에서 사진을
 *   누르면 손그림 캐릭터가 나왔다 — **눌린 카드가 무엇이었는지가 끊겼다.** 지금은 같은
 *   그림이 이어진다.
 * - **캐릭터는 유형마다 소재를 새로 그려야 했다.** 유형을 늘릴 때마다 손그림 한 점이
 *   딸려 오고, 그 그림의 소재가 피사체 경계(신체 평가·특정 식품)에 걸리는지를 매번
 *   판단해야 했다. 사진은 `scripts/fetch-card-photos.mjs` 가 이미 그 단계를 갖고 있다.
 * - **되붙이려면 위 둘을 어떻게 치를지 먼저 답할 것.** "손그림이 따뜻하다" 는 답이 아니다.
 *
 * ## 사진이 화면의 색을 정하지 않는다
 *
 * 사진 안의 색은 `tokens.test.ts` 가 닿지 않는 자리다(감수한 값 · TASK-86). 그래서
 * **글자를 사진 위에 얹지 않는다** — 제목(`h1`)·설명은 사진 **아래**에 있다. 대비를
 * 보증할 수 없는 면 위에 글을 올리는 것은 `/` 카드에서 이미 막아 둔 규칙이고, 사진이
 * 144px 원에서 열 폭짜리 띠로 커진 만큼 더 엄하게 지킨다.
 *
 * 풀려 들어가는 면은 콘텐츠 열의 `canvas` 이고, 마스크의 검정은 팔레트 값이 아니라
 * **알파 마스크**다 (`.card-photo` 와 같다).
 *
 * ## 열 폭까지 펼친다
 *
 * `-mx-5` 로 `main` 의 좌우 여백을 되돌려 **콘텐츠 열 끝까지** 닿게 한다 — 본문 폭에만
 * 걸치면 잘린 사각형으로 보인다 (`/` 머리 그라데이션 띠와 같은 판단).
 *
 * ## 장식이다
 *
 * `alt=""` · `aria-hidden` 이고 화면의 이름은 `h1` 이 만든다 (캐릭터가 `aria-hidden`
 * 이었던 이유가 그대로다). 출처 표기는 `public/cards/CREDITS.md` 에 있다.
 */

/**
 * 슬롯 높이. 390px 열에서 200px 이면 세로 비율이 약 1:2 이고, 정사각 원본
 * (480×480 · `scripts/fetch-card-photos.mjs` 의 `SIZE`)이 `object-cover` 로 위아래를
 * 버린다. 어디를 남기느냐는 `globals.css` 의 `.hero-photo` 가 한 값으로 정한다.
 * **`/` 카드의 `SLOT`(240)을 그대로 베끼면 안 된다** — 그쪽은 42% 폭 장식이다.
 *
 * ## 원본을 더 크게 받지 않았다 (실측 · 2026-08-20)
 *
 * 이 슬롯은 390px 열을 꽉 채우므로 DPR 2 에서 780 · DPR 3 에서 1,170 디바이스 픽셀이
 * 필요한데 원본은 480 이다. 눈으로 재보니 **DPR 2 는 멀쩡하고 DPR 3 에서 `diet-food`
 * (냄비의 꽃무늬)가 무르게 보인다.** 그래도 480 을 유지한다.
 *
 * - 800 으로 올리면 저장소가 484KB → 약 1.33MB 가 된다. **거의 전부 `diet-food` 몫이다** —
 *   그 원본만 Pexels 가 PNG 로 주므로 327KB → 945KB 다 (실측: 480/800/960 = 327/945/1383KB).
 * - **전송량도 함께 오른다.** 지금은 최적화기가 원본 폭(480)에서 멈추므로 사용자가 받는
 *   것이 작다. 원본을 키우면 DPR 2 요청이 800 폭 webp 를 받아 온다 — 이 화면에서 급한
 *   것은 사진이 아니라 **폼**이다.
 * - 이 사진은 **마스크로 사방이 풀리는 장식**이라 선명도가 정보를 나르지 않는다.
 *
 * **DPR 3 의 무름이 거슬린다는 말이 나오면 그때 `SIZE` 를 올린다** — 위 두 값을 함께
 * 치르는 결정이라는 것만 기억할 것.
 */
const HEIGHT = 200;

/**
 * `sizes` 는 **열 폭**이다. 콘텐츠 열이 `max-w-lg`(512px)이므로 그 위에서는 512px 에서
 * 멈춘다 — 뷰포트 폭으로 두면 데스크톱에서 쓰지 않을 큰 후보를 내려받는다.
 *
 * **`priority` 는 준다** (실측 · 2026-08-20). 이 사진이 이 화면의 **LCP 요소**다 — 열 폭을
 * 채우므로 화면에서 가장 큰 요소이고, `/` 첫 카드에서 같은 이유로 같은 결론이 나왔다
 * (TASK-87). 390px · 1.6Mbps · RTT 150ms 프로덕션 빌드에서 **LCP 1.40초 → 0.69초** 로
 * 710ms 줄었다 (3회 중앙값 · 조건과 재는 법은 `CLAUDE.md` "배포" 절).
 *
 * **`/` 와 달리 "첫 장만" 이라는 단서가 필요 없다** — 이 화면에는 사진이 하나뿐이라
 * preload 가 서로를 밀어낼 상대가 없다.
 */
export function ReadingHeroPhoto({ readingType }: { readingType: ReadingType }) {
  return (
    <div aria-hidden className="-mx-5 overflow-hidden" style={{ height: HEIGHT }}>
      <Image
        src={READING_TYPE_PHOTO[readingType]}
        alt=""
        width={512}
        height={HEIGHT}
        sizes="(max-width: 512px) 100vw, 512px"
        priority
        /*
          `hero-photo` 가 마스크와 **크롭 위치**를 함께 건다 (globals.css). `/` 의
          `.card-photo` 는 **왼쪽으로** 흐려지는 마스크라 이 자리에 쓸 수 없다.
          크롭 위치까지 거기 둔 것은 그 값이 다섯 유형을 눈으로 재서 고른 하나라서다 —
          Tailwind 임의값으로 두면 왜 80% 인지가 사라진다 (`.select-shell`·`.fold`·
          `.scroller-x` 와 같은 이유).
        */
        className="hero-photo pointer-events-none h-full w-full"
      />
    </div>
  );
}
