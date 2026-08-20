import Image from "next/image";
import { READING_TYPE_PHOTO } from "@/lib/reading/type-photo";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * `/` 유형 리스트 카드의 사진 (TASK-86).
 *
 * 레퍼런스(`docs/ui_ref/list_reference.jpg`)의 카드는 **오른쪽 절반을 그림이 채우고**
 * 왼쪽 글 쪽으로 흐려지며 사라진다. 그 자리를 사진으로 채운다 (2026-08-19 사용자 확정).
 *
 * ## 사진을 뺐던 이유 셋 중 하나만 사라졌다 (TASK-50 을 뒤집는다)
 *
 * | 옛 근거 | 지금 |
 * | --- | --- |
 * | 56px 썸네일에서 사진은 알아볼 수 없는 색 덩어리다 | **사라졌다** — 카드가 리스트로 바뀌어 슬롯이 150px 다 |
 * | 피사체가 이미 막아 둔 경계에 걸린다 | **그대로 남는다** → 아래 피사체 규칙 |
 * | 래스터는 `tokens.test.ts` 검사 밖이다 | **그대로 남는다** → 값으로 치른다 |
 *
 * 세 번째는 감수한 것이다. 사진 안의 색은 팔레트 검사가 닿지 않으므로 **사진이 화면의
 * 색을 정하지 않게** 둔다 — 카드 면·글자·화살표는 전부 시맨틱 토큰이고 사진은 오른쪽
 * 끝에서 흐려지는 장식이다. 톤이 어긋나는 사진이 들어오면 그건 색 규칙이 아니라
 * **고르기**의 문제이고, `scripts/fetch-card-photos.mjs` 가 사람이 고르는 단계를 둔다.
 *
 * ## 피사체 규칙 — 사람 없는 정물
 *
 * - **사람 몸을 찍지 않는다.** `내가 살이 찌는 이유` 옆에서 신체 평가가 된다.
 * - **특정 음식 한 접시를 찍지 않는다.** `ELEMENT_FOOD` 닫힌 목록을 판정 코드 밖에서
 *   우회하는 셈이 된다. **식사 도구까지가 경계다** (그릇·냄비 · TASK-70 과 같은 선).
 * - **운동 기구는 쓴다.** TASK-50 은 "처방으로 읽힌다" 로 뺐지만 TASK-48 이 대표 종목을
 *   콕 집어 권하는 유형을 열었다 — 그림이 본문보다 더 말하는 상황이 아니다 (TASK-70 이
 *   아령을 받은 것과 같은 판단).
 *
 * ## 장식이므로 `alt=""` 다
 *
 * 링크의 접근 가능한 이름은 카드 제목이 만든다. 사진에 설명을 달면 스크린리더가 카드마다
 * "실내 화분 사진" 을 먼저 읽는다 — 고를 때 필요한 정보가 아니다. 그래서 출처 표기도
 * 화면에 넣지 않고 `public/cards/CREDITS.md` 에 둔다.
 *
 * ## 자산은 우리 도메인에서 서빙한다
 *
 * Pexels URL 을 직접 물지 않는다. 방문자 브라우저가 제3자에 요청을 보내면
 * `app/privacy/page.tsx` 4·5항("외부 방문자 분석 도구를 전혀 쓰지 않습니다")과 같은
 * 약속이 흔들린다 (`public/dasii/` QR 두 개와 같은 판단). 파일은 저장소에 커밋한다.
 *
 * ## 경로 표는 이 파일에 없다
 *
 * `lib/reading/type-photo.ts` 의 `READING_TYPE_PHOTO` 를 읽는다 — `/reading/[type]` 상단
 * 히어로(`ReadingHeroPhoto`)가 **같은 그림**을 쓰기 때문이다 (TASK-92). 목록을 두 벌로
 * 두면 사진을 갈아끼울 때 `/` 에서 고른 카드와 들어간 화면의 그림이 달라진다.
 */

/**
 * 슬롯 크기. `sizes` 를 주지 않으면 `next/image` 가 뷰포트 폭을 기준으로 큰 후보를
 * 내려받는다 — 카드 사진은 어느 폭에서도 열의 절반 이하라 실제 필요한 것보다 몇 배 크다.
 * 원본은 480×480 이고(`scripts/fetch-card-photos.mjs`) 여기서 한 번 더 줄여 내보낸다.
 */
const SLOT = 240;

/**
 * `priority` 는 **첫 카드만** 받는다 (TASK-87).
 *
 * 이 사진이 `/` 의 LCP 요소다(카드 오른쪽 면을 채우므로 화면에서 가장 큰 요소). 390px ·
 * 1.6Mbps · RTT 150ms 실측에서 **LCP 1.02초 → 0.72초**(DPR 2), 1.16 → 0.69초(DPR 3)로
 * 줄었다. 조건과 재는 법은 `CLAUDE.md` "배포" 절.
 *
 * **다섯 장 전부에 주지 말 것.** preload 는 우선순위를 나눠 갖는 자리라 다 주면 서로를
 * 밀어내고 첫 장이 오히려 늦어진다. 나머지 넷은 `next/image` 기본값(지연 로드)이다.
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
        `card-photo` 가 왼쪽으로 흐려지는 마스크를 건다 (globals.css). Tailwind 임의값으로
        흩뿌리지 않는 이유는 `.select-shell`·`.fold`·`.scroller-x` 와 같다 — 규칙이
        한 곳에 있어야 카드가 늘 때 같은 모양이 나온다.
      */
      className="card-photo pointer-events-none absolute inset-y-0 right-0 h-full w-[42%] object-cover"
    />
  );
}
