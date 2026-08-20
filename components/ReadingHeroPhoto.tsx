import Image from "next/image";
import { READING_TYPE_PHOTO } from "@/lib/reading/type-photo";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * `/reading/[type]` 상단 히어로 사진. `/` 리스트 카드와 **같은 그림**을 쓴다
 * (`lib/reading/type-photo.ts` 가 경로 표의 단일 소스다) — 누른 카드가 무엇이었는지가
 * 이어져야 한다.
 *
 * **사진이 화면의 색을 정하지 않는다.** 사진 안의 색은 `tokens.test.ts` 가 닿지 않으므로
 * **글자를 사진 위에 얹지 않는다** — 제목(`h1`)·설명은 사진 **아래**다.
 *
 * **예외는 뒤로가기 버튼 하나다.** 사진이 열 맨 위를 덮으므로 그 버튼만 위에 얹히고,
 * 대신 `surface` variant 로 **자기 면을 들고 간다**(아이콘이 놓이는 면이 사진이 아니라
 * `canvas` 라 대비가 토큰으로 보증된다). **글자에는 이 예외를 넓히지 말 것.**
 *
 * **펼치는 것은 호출부가 한다.** `-mx-5 -mt-10` 은 `app/reading/[type]/page.tsx` 에 있다 —
 * 뒤로가기 버튼이 사진 위에 얹히려면 **위치 기준(`relative`)과 음수 여백이 같은 요소**에
 * 있어야 한다. **여기서 다시 펼치면 두 겹이 되어 사진이 열 밖으로 나간다.**
 *
 * `alt=""` · `aria-hidden` 인 장식이고 화면의 이름은 `h1` 이 만든다.
 * 출처 표기는 `public/cards/CREDITS.md`.
 */

/**
 * 슬롯 높이. 정사각 원본(480×480 · `fetch-card-photos.mjs` 의 `SIZE`)이 `object-cover` 로
 * 위아래를 버리고, 어디를 남기느냐는 `globals.css` 의 `.hero-photo` 가 한 값으로 정한다.
 * **`/` 카드의 `SLOT`(240)을 그대로 베끼지 말 것** — 그쪽은 42% 폭 장식이다.
 *
 * **원본을 더 크게 받지 않았다.** 이 슬롯은 열을 꽉 채워 DPR 3 에서 원본이 모자라지만,
 * 올리면 ① 저장소가 세 배 가까이 되고(PNG 원본 하나가 대부분) ② **전송량도 오른다**
 * (지금은 최적화기가 원본 폭에서 멈춘다). 마스크로 사방이 풀리는 장식이라 선명도가
 * 정보를 나르지 않는다.
 *
 * **높이와 마스크는 한 벌이다** (TASK-106). 200px 이던 것을 300px 로 늘린 이유는
 * 페이드 꼬리가 슬롯 안에서 0 에 닿아야 하기 때문이다 — 200px 에서는 알파가 남은 채로
 * 잘려 **제목 위에 가로 선**이 보였다. 아래 100px 은 글자가 앉는 빈 구간이고 제목이
 * 음수 여백으로 그 안으로 올라온다(`app/reading/[type]/page.tsx`).
 * **한쪽만 고치면 같은 경계가 아래로 옮겨 갈 뿐이다.**
 */
const HEIGHT = 300;

/**
 * `sizes` 는 **열 폭**이다 (뷰포트 폭으로 두면 데스크톱에서 쓰지 않을 큰 후보를 받는다).
 *
 * **`priority` 를 준다** — 이 사진이 이 화면의 **LCP 요소**다(열 폭을 채우므로 가장 큰
 * 요소). `/` 와 달리 "첫 장만" 이라는 단서가 필요 없다 — 사진이 하나뿐이라 preload 가
 * 서로를 밀어낼 상대가 없다.
 */
export function ReadingHeroPhoto({ readingType }: { readingType: ReadingType }) {
  return (
    <div aria-hidden className="overflow-hidden" style={{ height: HEIGHT }}>
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
          크롭 위치도 거기 둔다 — 다섯 유형을 눈으로 재서 고른 한 값이라 Tailwind
          임의값으로 흩뿌리면 근거가 사라진다.
        */
        className="hero-photo pointer-events-none h-full w-full"
      />
    </div>
  );
}
