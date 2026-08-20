import type { ReadingType } from "@/lib/saju/schema";

/**
 * 유형별 사진 경로 — **두 화면이 같은 그림을 쓴다** (TASK-92).
 *
 * `/` 리스트 카드(`components/ReadingCardPhoto.tsx`)와 `/reading/[type]` 상단 히어로
 * (`components/ReadingHeroPhoto.tsx`)가 이 표 하나를 읽는다. **목록을 복사하지 말 것** —
 * 두 벌이 되면 사진을 갈아끼울 때 한쪽만 바뀌고, `/` 에서 고른 카드와 들어간 화면의
 * 그림이 달라진다. 그 "이어짐" 이 히어로를 사진으로 바꾼 이유의 절반이다.
 *
 * ## `Record` 여야 한다
 *
 * 배열이면 새 유형이 조용히 남의 사진을 달고 나간다 (`ReadingThumbnail` 이 `Record` 였던
 * 이유가 그대로 적용된다). 유형을 늘리면 여기가 컴파일 오류로 잡히고,
 * `scripts/fetch-card-photos.mjs` 의 검색어 표에 한 줄을 더하면 된다.
 *
 * ## 피사체 규칙은 `ReadingCardPhoto` 에 있다
 *
 * 사람 없는 정물 · 특정 식품 금지(식사 도구까지) · 운동 기구는 허용. **히어로가 되면서
 * 그 경계가 더 중요해졌다** — 같은 그림이 144px 원에서 열 폭짜리 띠로 커졌다.
 *
 * ## 여기에 크기를 두지 않는다
 *
 * 슬롯 폭·`sizes`·`priority` 는 화면마다 다르다 (카드는 42% 폭 장식, 히어로는 열 폭).
 * 한 곳에 모으면 어느 화면 값인지 알 수 없어진다.
 */
export const READING_TYPE_PHOTO: Record<ReadingType, string> = {
  // 내부 유형(`/admin` 전용)도 값이 필요하다. 목록에 나오지 않으므로 체질과 같은 그림을 쓴다.
  general: "/cards/diet.jpg",
  diet: "/cards/diet.jpg",
  "gain-cause": "/cards/gain-cause.jpg",
  "diet-method": "/cards/diet-method.jpg",
  "diet-food": "/cards/diet-food.jpg",
  exercise: "/cards/exercise.jpg",
  decade: "/cards/diet-method.jpg",
};
