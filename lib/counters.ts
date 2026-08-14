import "server-only";
import { getCounterStore } from "./env";
import { READING_TYPES, type ReadingType } from "./saju/schema";

/**
 * 유형별 조회수·좋아요 카운터 (TASK-51).
 *
 * ## 왜 저장소가 필요한가
 *
 * `lib/rate-limit.ts` 처럼 인메모리 `Map` 으로 두면 인스턴스마다 다른 수가 보이고 콜드
 * 스타트마다 0 으로 돌아간다. 레이트 리밋은 느슨해도 티가 안 나지만 **조회수는 틀린 값이
 * 화면에 그대로 찍힌다.** 그리고 필요한 연산이 원자적 증가(`INCR`)라 읽기 캐시
 * (`unstable_cache` 등)로는 대체할 수 없다 — 두 요청이 같은 값을 읽으면 하나가 사라진다.
 *
 * ## 세는 단위는 유형뿐이다
 *
 * 키는 `views:<type>` · `likes:<type>` 가 전부다. 결과별로 세려면 결과에 id 가 있어야 하고
 * 그건 결과를 서버에 두는 것이라 개인정보 처리방침의 "저장하지 않습니다" 가 죽는다.
 * **생년월일에서 파생된 어떤 값도 키에 넣지 않는다** — 해시도 안 된다. 입력 공간이 작아
 * 전수 대조가 되므로 익명화가 아니라 가명화까지다.
 *
 * ## 실패해도 서비스는 죽지 않는다
 *
 * 이 모듈은 **던지지 않는다.** 저장소가 없거나 응답하지 않으면 그 사실을 상태값으로
 * 돌려주고, 부르는 쪽은 숫자 자리를 숨긴다. `lib/observability.ts` 의 `emit` 이 어떤
 * 예외도 밖으로 내보내지 않는 것과 같은 원칙이다 — 계측이 요청을 깨뜨리면 안 된다.
 */

export const COUNTER_KINDS = ["views", "likes"] as const;
export type CounterKind = (typeof COUNTER_KINDS)[number];

/** 유형 × 종류. `Record` 라서 유형이 늘면 빠뜨린 곳이 컴파일 오류로 잡힌다. */
export type CounterSnapshot = Record<ReadingType, Record<CounterKind, number>>;

export type CounterStatus =
  /** 환경변수가 없다 — 설정하지 않았을 뿐이므로 오류가 아니다. */
  | { readonly state: "unconfigured" }
  | { readonly state: "ok"; readonly counts: CounterSnapshot; readonly elapsedMs: number }
  | { readonly state: "error"; readonly reason: string; readonly elapsedMs: number };

export function counterKey(kind: CounterKind, type: ReadingType): string {
  return `${kind}:${type}`;
}

/**
 * `MGET` 에 넘길 키 목록. **순서가 곧 응답 순서**라 한 곳에서 정하고 파싱도 같은 순서로
 * 되돌린다. 종류별로 묶지 않고 유형 안에서 종류를 도는 것은 뜻이 있어서가 아니라
 * 한 곳에서만 정하면 되기 때문이다.
 */
export const COUNTER_KEYS: readonly string[] = READING_TYPES.flatMap((type) =>
  COUNTER_KINDS.map((kind) => counterKey(kind, type)),
);

function emptySnapshot(): CounterSnapshot {
  return Object.fromEntries(
    READING_TYPES.map((type) => [type, { views: 0, likes: 0 }]),
  ) as CounterSnapshot;
}

/**
 * `MGET` 응답을 스냅샷으로 되돌린다. **순수 함수라 테스트가 직접 부른다.**
 *
 * Redis 는 없는 키에 `null` 을 준다 — 아직 아무도 안 본 유형이라는 뜻이므로 0 이다.
 * 값은 문자열로 오고, 숫자가 아닌 것이 섞여 있으면(사람이 손으로 넣었거나 키가 겹쳤거나)
 * 0 으로 떨어뜨린다. 여기서 던지면 화면 하나가 통째로 죽는다.
 */
export function snapshotFromMget(values: readonly unknown[]): CounterSnapshot {
  const snapshot = emptySnapshot();
  COUNTER_KEYS.forEach((key, index) => {
    const [kind, type] = key.split(":") as [CounterKind, ReadingType];
    const parsed = Number(values[index]);
    snapshot[type][kind] = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  });
  return snapshot;
}

/**
 * 저장소가 느릴 때 페이지 렌더가 같이 느려지면 안 된다. 카운터는 **없어도 되는 값**이라
 * 기다릴 이유가 없다.
 */
const TIMEOUT_MS = 2_000;

/**
 * 토큰이 섞여 나갈 여지를 없앤다. 상태 코드와 예외 이름까지만 쓰고 응답 본문·URL·헤더는
 * 절대 싣지 않는다 (CLAUDE.md 보안 규칙 — 에러·로그에 키 원문을 넣지 않는다).
 */
function toSafeReason(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `응답 없음 (${TIMEOUT_MS}ms 초과)`;
  }
  if (error instanceof Error && error.name === "HttpError") return error.message;
  return "저장소에 연결하지 못했습니다";
}

class HttpError extends Error {
  readonly name = "HttpError";
}

/**
 * 모든 유형의 조회수·좋아요를 한 번에 읽는다 (`MGET` 한 번 = 명령 1회).
 *
 * Upstash REST 는 **명령 하나를 JSON 배열로 POST** 하면 `{ result: … }` 를 돌려준다.
 * 공식 SDK(`@upstash/redis`)를 넣지 않은 이유는 여기서 쓰는 것이 `MGET`·`INCR` 둘뿐이라
 * 의존성 하나를 더할 값이 없어서다.
 *
 * `no-store` 가 필요하다 — Next 의 fetch 캐시에 걸리면 숫자가 고정된다. `/` 의 숫자를
 * 늦추는 것은 그 페이지의 `revalidate` 가 할 일이지 이 함수가 할 일이 아니다.
 */
export async function readCounters(): Promise<CounterStatus> {
  const store = getCounterStore();
  if (!store) return { state: "unconfigured" };

  const started = Date.now();
  try {
    const response = await fetch(store.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${store.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["MGET", ...COUNTER_KEYS]),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // 401 은 토큰, 404 는 URL 이 틀렸다는 뜻이라 구분해서 보여줄 값이 있다.
      throw new HttpError(
        response.status === 401
          ? "인증 실패 (401) — 토큰을 확인하세요"
          : `저장소가 ${response.status} 를 돌려줬습니다`,
      );
    }

    const body: unknown = await response.json();
    const result = (body as { result?: unknown })?.result;
    if (!Array.isArray(result)) {
      throw new HttpError("응답 형식이 예상과 다릅니다");
    }

    return {
      state: "ok",
      counts: snapshotFromMget(result),
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    return { state: "error", reason: toSafeReason(error), elapsedMs: Date.now() - started };
  }
}
