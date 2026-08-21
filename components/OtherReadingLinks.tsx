import { PUBLIC_READING_TYPES, type ReadingType } from "@/lib/saju/schema";
import { ReadingTypeCard } from "./ReadingTypeCard";

/**
 * 결과 아래에 두는 "다른 유형으로도 보기" (TASK-31 · 115).
 *
 * **`/` 와 같은 부품으로 그린다** (`ReadingTypeCard`). 둘 다 "다음에 무엇을 볼까" 를 고르는
 * 자리인데 예전에는 여기만 회색 상자 안의 글자 줄이었다 — 같은 일을 하는 자리가 두 모습이면
 * 규격도 두 벌이 된다.
 *
 * **평범한 라우트 이동이다.** `router.replace` 로 URL 과 화면을 따로 맞추는 편법을 쓰지
 * 않는다 — `BirthInputProvider` 가 입력을 들고 있으므로 옮겨 간 화면은 값이 채워진 채
 * 접혀 있고, 제출 한 번이면 그 유형의 풀이가 나온다. URL 과 보이는 결과가 항상 일치하는
 * 쪽을 택한 것이다.
 *
 * **조회수를 여기서 띄우지 않는다** (`counts` 를 넘기지 않는다). `/` 는 서버에서 한 번 읽어
 * 정적으로 굽지만 여기는 클라이언트 트리라 그 값이 없고, **클라이언트에서 fetch 하면 풀이
 * 한 번에 요청이 유형 수만큼 더 붙는다.** `priority` 도 주지 않는다 — 스크롤 아래라 LCP 가
 * 아니다.
 *
 * 현재 유형은 빼고 나머지만 낸다. `PUBLIC_READING_TYPES` 를 순회하므로 유형이 늘면 자동이고,
 * 내부 유형(TASK-41)은 여기 나오지 않는다.
 *
 * **남는 유형이 없으면 아무것도 내지 않는다.** 공개 유형이 하나뿐이면 제목만 남은 빈 상자가
 * 되는데, 그건 "다른 것도 있다" 고 말해 놓고 아무것도 주지 않는 화면이다.
 * 유형이 늘면 저절로 다시 나타난다.
 */
export function OtherReadingLinks({ current }: { current: ReadingType }) {
  const others = PUBLIC_READING_TYPES.filter((type) => type !== current);
  if (others.length === 0) return null;

  return (
    <section>
      {/* 상자를 두르지 않는다 — 카드 넷이 이미 한 덩어리로 읽힌다 (`/` 목록과 같다). */}
      <h2 className="mb-4 text-base font-bold">다른 유형으로도 보기</h2>
      <ul className="flex flex-col gap-3">
        {others.map((type) => (
          <li key={type}>
            <ReadingTypeCard type={type} />
          </li>
        ))}
      </ul>
    </section>
  );
}
