/**
 * 태어난 시각 드롭다운의 선택지 (TASK-23).
 *
 * `components/SajuForm.tsx` 가 import 하므로 **클라이언트 안전** 모듈이다 —
 * `lib/reading/sections.ts` 와 같은 이유로 `server-only` 를 붙이지 않는다.
 *
 * 여기서 조립한 `HH:mm` 이 그대로 `sajuInputSchema.birthTime` 으로 나간다.
 * 서버 계약은 손대지 않는다 — 바꾸면 만세력 테스트가 전부 영향을 받는다.
 */

export interface TimeOption {
  /** `HH` 또는 `mm` (2자리 0 채움) */
  value: string;
  label: string;
}

/**
 * 시(時) 선택지. **값은 24시간(`00`~`23`)이고 라벨은 생활 표기**다.
 *
 * `14시` 만 보여주면 오후 2시로 착각하기 쉽고, 순수 12시간제로만 두면 `계산 기준` 카드의
 * 자시 학파 설명(23:00~23:59)과 대응이 끊긴다. 그래서 값과 표기를 갈랐다.
 * 0 시·12 시는 `오전 0시`·`오후 0시` 가 되지 않도록 따로 적는다.
 */
export const HOUR_OPTIONS: readonly TimeOption[] = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour).padStart(2, "0"),
  label:
    hour === 0
      ? "밤 12시"
      : hour === 12
        ? "낮 12시"
        : hour < 12
          ? `오전 ${hour}시`
          : `오후 ${hour - 12}시`,
}));

/**
 * 분(分) 선택지는 **1분 단위**다. 5·10분 단위로 줄이면 안 된다.
 *
 * 경도 보정(서울 약 −32분) 때문에 시지(時支) 경계가 정시가 아닌 시각에 놓인다 —
 * 예를 들어 시계시 01:31 과 01:33 은 보정 후 서로 다른 시진이 된다. 5의 배수로만
 * 고르게 하면 그 경계 양쪽을 표현할 수 없어 시주가 틀어진다.
 *
 * 12지시(자시~해시)만 고르게 하는 안을 쓰지 않은 것도 같은 이유다 — 그러려면 시진의
 * 대표 시각을 우리가 정해 채워야 하는데, 그것은 "임의 시각을 채워 넣지 않는다"는
 * 시각 미상 처리 원칙과 충돌한다. 모르면 채우지 말고 시주를 제외한다.
 */
export const MINUTE_OPTIONS: readonly TimeOption[] = Array.from({ length: 60 }, (_, minute) => {
  const value = String(minute).padStart(2, "0");
  return { value, label: `${value}분` };
});

/**
 * 고른 시·분을 서버 계약의 `HH:mm` 으로 조립한다.
 *
 * **한쪽만 고른 상태는 빈 문자열이다.** 시만 골랐을 때 분을 `00` 으로 채우면 사용자가
 * 지정하지 않은 값이 시주 판정에 들어가고, 위 경계 문제 때문에 그 `00` 이 시주를
 * 바꿀 수 있다. 폼은 이 상태에서 제출을 막고 둘 다 고르라고 안내한다.
 */
export function composeBirthTime(hour: string, minute: string): string {
  return hour && minute ? `${hour}:${minute}` : "";
}
