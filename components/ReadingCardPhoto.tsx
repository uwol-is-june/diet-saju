import Image from "next/image";
import { READING_TYPE_PHOTO } from "@/lib/reading/type-photo";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * `/` 유형 리스트 카드의 사진. **카드를 통째로 덮고 그 위에 어둠이 깔린다** (TASK-110) —
 * 형식·크롭·스크림은 `globals.css` 의 `.card-cover`·`.card-photo` 가 정한다.
 * 판정 콜아웃(`VerdictPhoto`)과 같은 꼴이고, 예전의 오른쪽 42% + 왼쪽으로 흐려지는
 * 마스크는 글 폭과 사진 폭을 서로 묶어 두어야 했다.
 *
 * **사진이 화면의 색을 정하지 않는다.** 래스터는 `tokens.test.ts` 검사 밖이므로 글자·
 * 화살표는 전부 시맨틱 토큰(`on-photo*`)이고 **대비를 보증하는 것은 사진이 아니라
 * 스크림의 알파**다. 톤이 어긋나면 그건 색 규칙이 아니라 **고르기**의 문제이고,
 * `scripts/fetch-card-photos.mjs` 가 사람이 고르는 단계를 둔다.
 *
 * **피사체는 사람 없는 정물이다.**
 *
 * - **사람 몸을 찍지 않는다** — `내가 살이 찌는 이유` 옆에서 신체 평가가 된다.
 * - **특정 음식 한 접시를 찍지 않는다** — `ELEMENT_FOOD` 닫힌 목록을 판정 코드 밖에서
 *   우회하는 셈이 된다. **식사 도구까지가 경계다**(그릇·냄비).
 * - **운동 기구는 쓴다** — 대표 종목을 콕 집어 권하는 유형이 있으므로 그림이 본문보다
 *   더 말하는 상황이 아니다.
 *
 * **`alt=""` 인 장식이다** — 링크 이름은 카드 제목이 만든다. 출처 표기는
 * `public/cards/CREDITS.md`.
 *
 * **자산은 우리 도메인에서 서빙한다** (Pexels URL 을 직접 물면 방문자가 제3자에 요청을
 * 보내고 처리방침 4·5항이 흔들린다). 파일은 커밋한다.
 *
 * **경로 표는 이 파일에 없다** — `lib/reading/type-photo.ts` 를 읽는다. 히어로가 같은
 * 그림을 쓰므로 두 벌로 두면 카드와 들어간 화면의 그림이 달라진다.
 */

/**
 * 원본 크기. 정사각 480×480 이고 `scripts/fetch-card-photos.mjs` 의 `SIZE` 가 단일 소스다.
 *
 * **전면 깔기라 원본이 카드 폭보다 작다** (390px 화면에서 카드가 350px 이므로 DPR 2 에서
 * 모자란다). 판정 콜아웃·히어로에서 한 판단과 같다 — 스크림 아래에 깔리는 장식이라
 * 선명도가 정보를 나르지 않고, 원본을 키우면 저장소와 전송량이 함께 오른다.
 * **올릴 때는 `fetch-card-photos.mjs` 의 `SIZE` 와 함께 올린다** (한쪽만 고치면 그 값이
 * 실제 파일보다 커져 `next/image` 가 없는 해상도를 요청한다).
 */
const SLOT = 480;

/**
 * `priority` 는 **첫 카드만** 받는다 — 이 사진이 `/` 의 LCP 요소다(카드 오른쪽 면을 채우므로
 * 화면에서 가장 큰 요소).
 *
 * **전부에 주지 말 것.** preload 는 우선순위를 나눠 갖는 자리라 다 주면 서로를 밀어내고
 * 첫 장이 오히려 늦어진다. 나머지는 `next/image` 기본값(지연 로드)이다.
 */

export function ReadingCardPhoto({
  readingType,
  priority,
}: {
  readingType: ReadingType;
  priority?: boolean;
}) {
  return (
    <Image
      src={READING_TYPE_PHOTO[readingType]}
      alt=""
      width={SLOT}
      height={SLOT}
      sizes="(max-width: 640px) 100vw, 512px"
      priority={priority}
      /*
        `card-photo` 가 크롭 위치를 정하고 어둠은 카드 쪽(`.card-cover::after`)이 얹는다.
        **Tailwind 임의값으로 흩뿌리지 말 것** — 규칙이 한 곳에 있어야 카드가 늘 때 같은
        모양이 나온다. `absolute` 라 사진이 늦게 와도 글의 자리가 밀리지 않는다.
      */
      className="card-photo pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
