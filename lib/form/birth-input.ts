/**
 * 폼 입력값의 모양과 그 요약 (TASK-30).
 *
 * `components/BirthInputProvider.tsx` 가 이 타입을 담고, `SajuForm` 이 접힌 상태에서
 * `describeBirthInput` 한 줄을 보여준다. **클라이언트 안전 모듈**이라
 * `lib/form/birth-time.ts` 와 같은 이유로 `server-only` 를 붙이지 않는다.
 *
 * 값을 들고 있는 곳(프로바이더)과 값의 모양을 정하는 곳(여기)을 나눈 이유는
 * 요약 문구를 순수 함수로 검증하기 위해서다.
 */
import { READING_TYPE_NEEDS_GENDER, type ReadingType } from "../saju/schema";
import { BIRTHPLACES, type Birthplace } from "./birthplaces";
import { composeBirthTime } from "./birth-time";

export interface BirthInput {
  name: string;
  birthDate: string;
  /** 시·분은 따로 든다 (TASK-23). 제출할 때만 `HH:mm` 으로 조립한다. */
  birthHour: string;
  birthMinute: string;
  timeUnknown: boolean;
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  gender: "male" | "female" | "unspecified";
  /**
   * 출생지 (TASK-37). **시/도와 시/군 두 값으로 든다** — 이름만으로는 유일하지 않다
   * (`고성군` 이 강원과 경남에 하나씩 있다). 둘 다 빈 문자열이면 미선택이고,
   * 그때는 서버가 서울 기본값으로 계산한다.
   *
   * **폼의 기본값은 미선택이 아니라 서울이다** (TASK-98) — 아래 `EMPTY_BIRTH_INPUT`.
   * 미선택 상태 자체는 남는다(시/도를 도로 비울 수 있다).
   */
  birthplaceSido: string;
  birthplaceName: string;
  solarTimeMode: "standard" | "longitude" | "true";
  dayBoundary: "yajasi" | "jasi";
}

/**
 * 기본값은 `sajuInputSchema` 의 기본값과 같아야 한다 — 어긋나면 화면과 서버가
 * 다른 것을 본다. `schema.test.ts` 가 둘을 대조한다.
 *
 * ## 출생지는 미선택이 아니라 서울로 연다 (TASK-98)
 *
 * 예전에는 둘 다 빈 문자열이었고, 그래서 **"고르지 않으면 서울 기준으로 계산합니다"**
 * 라는 설명 줄이 드롭다운 아래에 필요했다. 조용히 적용되는 기본값을 글로 알리는 셈이라,
 * **기본값을 눈에 보이게 하고 그 줄을 지웠다** — 화면이 이미 말하는 것을 문장으로
 * 되풀이하지 않는다.
 *
 * - **경도는 같다.** 표의 서울(126.99)과 서버 기본값(`SEOUL_LONGITUDE` 126.9784)은
 *   분 단위로 반올림되는 보정에서 같은 −32분이 된다. 달라지는 것은 경도가 요청에
 *   **명시적으로 실린다**는 것뿐이고 원국은 그대로다 (`birth-input.test.ts` 가 잰다).
 * - **서울은 시/군이 하나뿐이라 두 번째 드롭다운이 뜨지 않는다.** `chooseSido` 가
 *   광역시에서 만드는 상태와 같은 모양을 처음부터 만드는 것이다 — 하나뿐인 시/도
 *   목록을 여기에 새로 적지 않는다.
 * - **접힌 요약과 결과 화면에 `서울` 이 늘 붙는다.** 계산에 실제로 쓰이는 값이라
 *   보이는 편이 맞다 (`describeBirthInput` 주석의 판단 그대로다).
 */
export const EMPTY_BIRTH_INPUT: BirthInput = {
  name: "",
  birthDate: "",
  birthHour: "",
  birthMinute: "",
  timeUnknown: false,
  calendar: "solar",
  isLeapMonth: false,
  gender: "unspecified",
  birthplaceSido: "서울",
  birthplaceName: "서울",
  solarTimeMode: "longitude",
  dayBoundary: "yajasi",
};

const GENDER_LABEL: Record<BirthInput["gender"], string> = {
  male: "남성",
  female: "여성",
  unspecified: "성별 미지정",
};

/**
 * 시·분 중 한쪽만 고른 상태 — **조용히 버리지 않는다.**
 *
 * 시만 골라도 통과시키면 분을 `00` 으로 채우는 셈이고, 경도 보정 때문에 시주 경계가
 * 정시가 아닌 시각에 놓이므로(예: 01:31 은 자시, 01:33 은 축시) 그 `00` 이 시주를
 * 바꿀 수 있다. 폼은 이 상태에서 제출을 막고 둘 다 고르라고 안내한다.
 */
export function hasIncompleteTime(input: BirthInput): boolean {
  return !input.timeUnknown && (input.birthHour === "") !== (input.birthMinute === "");
}

/**
 * 유형이 요구하는 것이 빠졌는가 — 빠졌으면 그 이유를 한 줄로 돌려준다 (TASK-45).
 *
 * **성별을 요구하는 유형이 생겼다.** 대운 순행/역행이 성별로 정해지므로 미지정이면
 * `chart.daeun` 이 null 이고 그 유형은 성립하지 않는다. 임의로 순행을 정하지 않는다.
 *
 * 이유를 문자열로 돌려주는 이유: 버튼만 꺼 두면 **왜 눌리지 않는지** 알 수 없다.
 * 서버도 같은 규칙으로 다시 막는다 (`sajuInputSchema` 의 refine) — 클라이언트 검증은
 * UX 용이고 신뢰 대상이 아니다.
 */
export function missingForType(input: BirthInput, readingType: ReadingType): string | null {
  if (READING_TYPE_NEEDS_GENDER[readingType] && input.gender === "unspecified") {
    return "이 풀이는 10년 단위 흐름(대운)을 쓰는데, 그 방향이 성별로 정해집니다. 성별을 골라 주세요.";
  }
  return null;
}

/**
 * 제출할 수 있는 값인가 — 생년월일이 있고 시각이 반쪽이 아니면 된다.
 *
 * 시각 미입력 자체는 막지 않는다. 시각 미상도 유효한 입력이고 시주를 빼고 해석한다.
 * 폼이 접힐지 말지도 이 값으로 정한다 — 제출할 수 없는 값을 접으면 왜 버튼이 꺼져
 * 있는지 볼 수 없다.
 *
 * **유형을 주면 그 유형이 요구하는 것까지 본다** (TASK-45). 주지 않으면 유형과 무관한
 * 조건만 본다 — 유형을 모르는 자리(값의 모양만 보는 곳)에서도 쓸 수 있어야 한다.
 */
export function canSubmit(input: BirthInput, readingType?: ReadingType): boolean {
  if (input.birthDate === "" || hasIncompleteTime(input)) return false;
  return readingType === undefined || missingForType(input, readingType) === null;
}

// ── 출생지 (TASK-37) ────────────────────────────────────────────────────────
/** 한 시/도에 속한 시/군 목록. 표는 이미 시/도 순 → 이름 순으로 정렬돼 있다. */
export function placesInSido(sido: string): Birthplace[] {
  return BIRTHPLACES.filter((place) => place.sido === sido);
}

/** 고른 출생지. 미선택이거나 표에 없는 조합이면 `null` 이다. */
export function findBirthplace(input: BirthInput): Birthplace | null {
  if (!input.birthplaceSido || !input.birthplaceName) return null;
  return (
    BIRTHPLACES.find(
      (place) => place.sido === input.birthplaceSido && place.name === input.birthplaceName,
    ) ?? null
  );
}

/**
 * 출생지 경도가 **실제로 결과를 바꾸는 상태인가.**
 *
 * 시각을 모르면 `pillars.ts` 가 보정을 강제로 끄고(`solarTimeMode = timeUnknown ?
 * "standard" : …`), 보정 없음을 고른 경우도 경도를 쓰지 않는다. 두 경우에 경도를 보내면
 * 서버가 조용히 버리므로, **쓰이지 않을 값은 아예 보내지 않는다.**
 * 폼도 같은 조건으로 선택을 막는다 — 고를 수 있게 두면 반영되는 줄 안다.
 */
export function birthplaceApplies(input: BirthInput): boolean {
  return !input.timeUnknown && input.solarTimeMode !== "standard";
}

/** 요청에 실어 보낼 경도. 미선택이거나 쓰이지 않는 상태면 `undefined` (서울 기본값). */
export function birthplaceLongitude(input: BirthInput): number | undefined {
  if (!birthplaceApplies(input)) return undefined;
  return findBirthplace(input)?.longitude;
}

/**
 * 화면에 보여줄 출생지 이름 — `부산` · `강원 고성군`.
 * 시/군 이름이 시/도와 같으면(광역시) 한 번만 쓰고, 다르면 시/도를 앞에 붙여
 * `고성군` 같은 동명이 어디인지 알 수 있게 한다.
 */
export function describeBirthplace(input: BirthInput): string | null {
  const place = findBirthplace(input);
  if (!place) return null;
  return place.name === place.sido ? place.name : `${place.sido} ${place.name}`;
}

/**
 * 접힌 폼에 보여줄 한 줄 — 예: `1999-12-09 · 22:12 · 여성 · 부산`.
 *
 * **이름은 넣지 않는다.** 화면에 남아 있을 필요가 없는 값이고, 옆에 사람이 있을 때
 * 생년월일 옆에 이름이 붙어 있으면 그 자체로 신원이 된다.
 * **출생지는 넣는다** — 이름과 달리 계산에 실제로 쓰여서, 잘못 골랐으면 확인이 필요하다.
 * 음력이면 그 사실을 앞에 붙인다 — 양력으로 착각하면 원국이 통째로 달라진다.
 */
export function describeBirthInput(input: BirthInput): string {
  const time = input.timeUnknown
    ? "시각 미상"
    : (composeBirthTime(input.birthHour, input.birthMinute) || "시각 미상");

  const calendar = input.calendar === "lunar" ? (input.isLeapMonth ? "음력 윤달" : "음력") : null;
  // 쓰이지 않는 상태면 요약에도 적지 않는다 — 반영된 줄 알게 된다.
  const place = birthplaceApplies(input) ? describeBirthplace(input) : null;

  return [calendar, input.birthDate, time, GENDER_LABEL[input.gender], place]
    .filter(Boolean)
    .join(" · ");
}
