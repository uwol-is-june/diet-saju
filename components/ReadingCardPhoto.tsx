import Image from "next/image";
import { READING_TYPE_PHOTO } from "@/lib/reading/type-photo";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * `/` 유형 리스트 카드의 사진. 오른쪽 면을 채우고 왼쪽 글 쪽으로 흐려지며 사라진다
 * (레퍼런스 `docs/ui_ref/list_reference.jpg`).
 *
 * **사진이 화면의 색을 정하지 않는다.** 래스터는 `tokens.test.ts` 검사 밖이므로 카드 면·
 * 글자·화살표는 전부 시맨틱 토큰이고 사진은 흐려지는 장식이다. 톤이 어긋나면 그건 색
 * 규칙이 아니라 **고르기**의 문제이고, `scripts/fetch-card-photos.mjs` 가 사람이 고르는
 * 단계를 둔다.
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
 * 슬롯 크기. `sizes` 를 주지 않으면 `next/image` 가 뷰포트 폭을 기준으로 큰 후보를
 * 내려받는다 — 카드 사진은 어느 폭에서도 열의 절반 이하라 실제 필요한 것보다 몇 배 크다.
 * 원본은 480×480 이고(`scripts/fetch-card-photos.mjs`) 여기서 한 번 더 줄여 내보낸다.
 */
const SLOT = 240;

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
      sizes="(max-width: 640px) 42vw, 240px"
      priority={priority}
      /*
        `card-photo` 가 왼쪽으로 흐려지는 마스크를 건다 (globals.css).
        **Tailwind 임의값으로 흩뿌리지 말 것** — 규칙이 한 곳에 있어야 카드가 늘 때 같은
        모양이 나온다.
      */
      className="card-photo pointer-events-none absolute inset-y-0 right-0 h-full w-[42%] object-cover"
    />
  );
}
