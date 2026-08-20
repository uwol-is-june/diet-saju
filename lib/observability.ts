import "server-only";
import type { GeminiFailureKind } from "./gemini";
import type { ReadingType } from "./saju/schema";

/**
 * 요청 결과 계측.
 *
 * **상태 코드로 집계하지 말 것.** Gemini 실패는 200 본문 안의 `error` 이벤트로 나가므로
 * 상태 코드만 세면 쿼터 소진도 안전정책 차단도 전부 200 이 되어 "실패 0건" 이 된다.
 * 그래서 **`SajuOutcome` 으로** 센다 — `reading_failed` 가 그 200-속-실패다.
 *
 * **개인정보를 남기지 않는다.** 처리방침이 생년월일을 "로그에도 기록하지 않는다" 고
 * 약속한다. 여기 실리는 것은 전부 범주형 파생값이고 `METRIC_FIELDS` 허용 목록에 있는 키만
 * 직렬화된다(타입을 우회해도 버려진다 · `observability.test.ts` 가 검사한다).
 * 성별은 값이 아니라 **지정 여부**만 남긴다.
 *
 * **싱크는 stdout 하나뿐이다.** 외부 수집기도 방문자 분석 도구도 붙이지 않기로 확정했고,
 * 그래서 처리방침이 "방문자 분석 도구를 전혀 쓰지 않습니다" 를 약속할 수 있다.
 * 나중에 붙이면 **제3자가 늘어나므로** 처리방침 4·5항을 같은 커밋에서 고칠 것.
 */

export type SajuOutcome =
  /** 원국 + 풀이까지 완주 */
  | "ok"
  /** 우리 IP 레이트 리밋에 걸림 (429) */
  | "rate_limited"
  /** 입력 검증 실패 (400) */
  | "invalid_input"
  /** 사주 계산 실패 (400) */
  | "chart_failed"
  /** 서버 설정 오류 — 키 누락 등 (500) */
  | "config_error"
  /** 원국은 보냈지만 풀이 생성이 실패 — **200 안의 error 이벤트** */
  | "reading_failed";

export interface SajuRequestMetrics {
  outcome: SajuOutcome;
  /** HTTP 상태. 스트림을 열었으면 결과와 무관하게 200 이다. */
  status: number;
  readingType?: ReadingType;
  model?: string;
  /** 풀이 실패 종류. `reading_failed` 일 때만 있다. */
  failure?: GeminiFailureKind;
  /** 첫 글자까지 걸린 시간(ms). 체감 속도의 핵심 지표다. */
  ttfbMs?: number;
  /** 요청 전체 소요(ms) */
  durationMs?: number;
  /** 실패 시점까지 사용자에게 보낸 글자 수. 부분 결과가 남았는지 본다. */
  chars?: number;
  /** 출생시각 미상이었는지 (시주 제외 비율) */
  timeUnknown?: boolean;
  /** 성별을 지정했는지. **값은 남기지 않는다.** */
  genderKnown?: boolean;
}

/**
 * 직렬화 허용 키. 이 목록에 없는 키는 버린다.
 * 늘릴 때는 "이것이 개인을 식별할 수 있나" 를 먼저 답할 것.
 */
const METRIC_FIELDS = [
  "outcome",
  "status",
  "readingType",
  "model",
  "failure",
  "ttfbMs",
  "durationMs",
  "chars",
  "timeUnknown",
  "genderKnown",
] as const satisfies readonly (keyof SajuRequestMetrics)[];

/** Runtime Logs 에서 이 이름으로 필터한다. */
export const SAJU_REQUEST_EVENT = "saju_request";

export function recordSajuRequest(metrics: SajuRequestMetrics): void {
  emit(SAJU_REQUEST_EVENT, metrics);
}

/**
 * 한 줄에 JSON 하나. 여러 줄로 쪼개면 로그 수집기가 별개 항목으로 읽는다.
 *
 * 계측이 요청을 깨뜨리면 안 되므로 어떤 예외도 밖으로 내보내지 않는다.
 */
function emit(event: string, metrics: SajuRequestMetrics): void {
  try {
    const payload: Record<string, unknown> = { event };
    for (const field of METRIC_FIELDS) {
      const value = metrics[field];
      if (value !== undefined) payload[field] = value;
    }
    console.log(JSON.stringify(payload));
  } catch (error) {
    console.error("[observability] 계측 실패:", error);
  }
}

/** 소요 시간 측정. 테스트에서 시계를 고정할 수 있게 주입 가능하게 둔다. */
export function startTimer(now: () => number = Date.now): () => number {
  const started = now();
  return () => now() - started;
}
