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
  solarTimeMode: "standard" | "longitude" | "true";
  dayBoundary: "yajasi" | "jasi";
}

/**
 * 기본값은 `sajuInputSchema` 의 기본값과 같아야 한다 — 어긋나면 화면과 서버가
 * 다른 것을 본다. `schema.test.ts` 가 둘을 대조한다.
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
 * 제출할 수 있는 값인가 — 생년월일이 있고 시각이 반쪽이 아니면 된다.
 *
 * 시각 미입력 자체는 막지 않는다. 시각 미상도 유효한 입력이고 시주를 빼고 해석한다.
 * 폼이 접힐지 말지도 이 값으로 정한다 — 제출할 수 없는 값을 접으면 왜 버튼이 꺼져
 * 있는지 볼 수 없다.
 */
export function canSubmit(input: BirthInput): boolean {
  return input.birthDate !== "" && !hasIncompleteTime(input);
}

/**
 * 접힌 폼에 보여줄 한 줄 — 예: `1999-12-09 · 22:12 · 여성`.
 *
 * **이름은 넣지 않는다.** 화면에 남아 있을 필요가 없는 값이고, 옆에 사람이 있을 때
 * 생년월일 옆에 이름이 붙어 있으면 그 자체로 신원이 된다.
 * 음력이면 그 사실을 앞에 붙인다 — 양력으로 착각하면 원국이 통째로 달라진다.
 */
export function describeBirthInput(input: BirthInput): string {
  const time = input.timeUnknown
    ? "시각 미상"
    : (composeBirthTime(input.birthHour, input.birthMinute) || "시각 미상");

  const calendar = input.calendar === "lunar" ? (input.isLeapMonth ? "음력 윤달" : "음력") : null;

  return [calendar, input.birthDate, time, GENDER_LABEL[input.gender]]
    .filter(Boolean)
    .join(" · ");
}
