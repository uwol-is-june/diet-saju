/**
 * 이미 받은 풀이를 다시 만들지 않기 위한 **캐시 키** (TASK-60).
 *
 * `OtherReadingLinks` 가 유형 사이를 오가라고 만든 동선이라 `diet` → `gain-cause` →
 * 다시 `diet` 는 예외가 아니라 기본 경로다. 그런데 유형을 옮기면 `SajuForm` 이
 * 언마운트되면서 `chart`·`reading` 이 날아가 **사용자가 이미 본 글을 다시 생성한다.**
 * 아까운 것은 토큰이 아니라 **요청 수**다 — 무료 등급의 병목은 500 RPD 다.
 *
 * ## 값은 여전히 메모리에만 있다
 *
 * 담는 곳은 `components/BirthInputProvider.tsx` 의 ref 이고, **저장소·URL 로 옮기지
 * 않는다.** 새로고침·새 탭·탭 닫기로 사라지므로 지금 입력값이 이미 하는 것과 같은
 * 범주이고, 그래서 `app/privacy/page.tsx` 를 고치지 않아도 된다.
 * **이 조건이 이 기능의 전제다** — 저장소로 옮기는 순간 처리방침을 같은 커밋에서 고쳐야 한다.
 * (서버 캐시는 또 다른 이야기다 — `CLAUDE.md` "보류한 작업 > 결과 캐싱".)
 *
 * ## 키를 여기서 순수 함수로 만드는 이유
 *
 * 키가 틀리면 **다른 사람의 풀이가 나온다.** 프로바이더 안에 두면 테스트할 수 없어서
 * 갈라 뒀다. `birth-input.test.ts` 가 "어느 필드가 달라져도 키가 달라지는지" 를
 * `BirthInput` 을 순회하며 검사한다.
 */
import type { ReadingType } from "../saju/schema";
import type { BirthInput } from "./birth-input";

/** 키에서 입력값 부분과 유형을 가르는 글자. `ReadingType` 에는 나오지 않는다. */
const SEPARATOR = "|";

/**
 * 입력값 전체를 한 줄로 만든다.
 *
 * **필드를 골라 담지 않는다.** `Object.keys` 로 훑고 정렬하므로 `BirthInput` 에 필드가
 * 늘면 자동으로 키에 들어간다 — 손으로 나열하면 새 필드가 생겼을 때 **조용히 옛 결과가
 * 나온다.** 이름도 들어간다: 호칭이 본문에 박히므로 이름만 바꿔도 다른 글이다.
 */
export function birthInputSignature(input: BirthInput): string {
  return (Object.keys(input) as (keyof BirthInput)[])
    .sort()
    .map((key) => `${key}=${JSON.stringify(input[key])}`)
    .join("&");
}

/** 캐시 키 — 입력 스냅샷 전체 + 유형. */
export function readingCacheKey(input: BirthInput, readingType: ReadingType): string {
  return `${birthInputSignature(input)}${SEPARATOR}${readingType}`;
}

/**
 * 그 키가 **지금 입력값**으로 만들어진 것인가.
 *
 * 스트리밍 중에 입력을 고치면 프로바이더가 캐시를 비우는데, 그 뒤에 도착한 완성본을
 * 그대로 담으면 **바뀐 입력의 키에 옛 입력의 글이 붙는다.** 요청 시점 키를 들고 있다가
 * 담기 직전에 이걸로 확인한다.
 */
export function keyMatchesInput(key: string, input: BirthInput): boolean {
  return key.startsWith(`${birthInputSignature(input)}${SEPARATOR}`);
}
