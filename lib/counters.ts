import "server-only";
import { getCounterStore, type CounterStoreConfig } from "./env";
import { READING_TYPES, type ReadingType } from "./saju/schema";

/**
 * 유형별 조회수·좋아요 카운터.
 *
 * **저장소가 필요하다.** 인메모리 `Map` 이면 인스턴스마다 다른 수가 화면에 찍히고, 필요한
 * 연산이 원자적 증가(`INCR`)라 읽기 캐시로 대체할 수 없다.
 *
 * **세는 단위는 유형뿐이다** — 키는 `views:<type>` · `likes:<type>` 가 전부다. 결과별로
 * 세려면 결과에 id 가 있어야 하고 그건 결과를 서버에 두는 것이라 "저장하지 않습니다" 가
 * 죽는다. **생년월일에서 파생된 어떤 값도 키에 넣지 않는다 — 해시도 안 된다**(입력 공간이
 * 작아 전수 대조가 된다).
 *
 * **누가 눌렀는지 서버에 남지 않는다.** 좋아요 중복은 브라우저 `localStorage` 플래그로만
 * 막는다 — 서버에 신원을 만들면 처리방침 3항을 고쳐야 하는데 좋아요는 정확한 수가 필요한
 * 값이 아니다.
 *
 * **이 모듈은 던지지 않는다.** 저장소가 없거나 응답하지 않으면 상태값으로 돌려주고 부르는
 * 쪽이 숫자 자리를 숨긴다 — 계측이 요청을 깨뜨리면 안 된다.
 */

export const COUNTER_KINDS = ["views", "likes"] as const;
export type CounterKind = (typeof COUNTER_KINDS)[number];

/** 유형 × 종류. `Record` 라서 유형이 늘면 빠뜨린 곳이 컴파일 오류로 잡힌다. */
export type CounterSnapshot = Record<ReadingType, Record<CounterKind, number>>;

export type CounterStatus =
  /** 환경변수가 없다 — 설정하지 않았을 뿐이므로 오류가 아니다. */
  | { readonly state: "unconfigured" }
  /**
   * 한쪽 변수만 있거나 형식이 틀리다. **`unconfigured` 와 반드시 구분해서 보여준다** —
   * 둘을 같은 문구로 뭉뚱그리면 "연결했는데 왜 안 되지" 의 답이 화면에 없다.
   */
  | { readonly state: "misconfigured"; readonly names: readonly string[] }
  | { readonly state: "ok"; readonly counts: CounterSnapshot; readonly elapsedMs: number }
  | { readonly state: "error"; readonly reason: string; readonly elapsedMs: number };

export function counterKey(kind: CounterKind, type: ReadingType): string {
  return `${kind}:${type}`;
}

/**
 * `MGET` 에 넘길 키 목록. **순서가 곧 응답 순서**라 한 곳에서 정하고 파싱도 같은 순서로
 * 되돌린다.
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
 * 값 하나를 세는 수로 바꾼다. 없는 키는 `null` 이고 값은 문자열로 온다.
 * 숫자가 아니거나 음수면 0 이다 — **여기서 던지면 화면 하나가 통째로 죽는다.**
 */
export function toCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** `MGET` 응답을 스냅샷으로 되돌린다. **순수 함수라 테스트가 직접 부른다.** */
export function snapshotFromMget(values: readonly unknown[]): CounterSnapshot {
  const snapshot = emptySnapshot();
  COUNTER_KEYS.forEach((key, index) => {
    const [kind, type] = key.split(":") as [CounterKind, ReadingType];
    snapshot[type][kind] = toCount(values[index]);
  });
  return snapshot;
}

/**
 * 저장소가 느릴 때 페이지 렌더가 같이 느려지면 안 된다. 카운터는 **없어도 되는 값**이라
 * 기다릴 이유가 없다.
 */
const TIMEOUT_MS = 2_000;

class HttpError extends Error {
  readonly name = "HttpError";
}

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

async function unwrap(response: Response): Promise<unknown> {
  if (!response.ok) {
    // 401 은 토큰, 404 는 URL 이 틀렸다는 뜻이라 구분해서 보여줄 값이 있다.
    throw new HttpError(
      response.status === 401
        ? "인증 실패 (401) — 토큰을 확인하세요"
        : `저장소가 ${response.status} 를 돌려줬습니다`,
    );
  }
  const body: unknown = await response.json();
  return (body as { result?: unknown })?.result;
}

/**
 * 쓰기 명령. **POST 로 보낸다** — Upstash 는 GET 경로 형태도 받지만, 상태를 바꾸는 요청을
 * GET 으로 두면 중간 캐시나 프리페치가 값을 올릴 수 있다.
 */
async function write(store: CounterStoreConfig, command: readonly string[]): Promise<unknown> {
  const response = await fetch(store.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return unwrap(response);
}

/**
 * 모든 유형의 조회수·좋아요를 한 번에 읽는다 (`MGET` 한 번 = 명령 1회).
 *
 * **읽기만 GET 경로 형태를 쓴다.** Next 의 Data Cache 는 GET 만 캐시하므로 POST 로 보내면
 * `/` 가 요청마다 저장소를 두드리게 되고 **동적이 된다.**
 *
 * @param revalidateSeconds 없으면 `no-store`(항상 최신). `/admin` 은 지금 붙어 있는지를
 *   보는 화면이라 캐시하면 안 되고, `/` 의 숫자는 반대로 실시간일 이유가 없다.
 */
export async function readCounters(revalidateSeconds?: number): Promise<CounterStatus> {
  const lookup = getCounterStore();
  if (lookup.state === "unset") return { state: "unconfigured" };
  if (lookup.state === "invalid") return { state: "misconfigured", names: lookup.names };
  const store = lookup.config;

  const started = Date.now();
  try {
    const path = COUNTER_KEYS.map((key) => encodeURIComponent(key)).join("/");
    const response = await fetch(`${store.url}/mget/${path}`, {
      headers: { Authorization: `Bearer ${store.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(revalidateSeconds === undefined
        ? { cache: "no-store" as const }
        : { next: { revalidate: revalidateSeconds } }),
    });

    const result = await unwrap(response);
    if (!Array.isArray(result)) throw new HttpError("응답 형식이 예상과 다릅니다");

    return { state: "ok", counts: snapshotFromMget(result), elapsedMs: Date.now() - started };
  } catch (error) {
    return { state: "error", reason: toSafeReason(error), elapsedMs: Date.now() - started };
  }
}

/**
 * 조회수 +1. 실패해도 조용히 넘어간다 — 이걸 부르는 쪽은 이미 화면을 보여준 뒤다.
 *
 * 돌려주는 값은 증가 후의 수이며, 저장소가 없거나 실패하면 `null` 이다.
 */
export async function incrementView(type: ReadingType): Promise<number | null> {
  const lookup = getCounterStore();
  if (lookup.state !== "configured") return null;
  try {
    return toCount(await write(lookup.config, ["INCR", counterKey("views", type)]));
  } catch {
    return null;
  }
}

/**
 * 좋아요 +1 / -1. 취소를 허용하므로 감소 경로가 있다.
 *
 * **하한이 0 이다.** 좋아요 여부가 브라우저에만 있어서 저장소를 지운 사람이 취소만 누르면
 * `DECR` 이 음수로 내려간다. "0 밑으로 안 내려가는 감소" 가 없으므로 내려간 뒤에 되돌린다.
 */
export async function applyLike(type: ReadingType, delta: 1 | -1): Promise<number | null> {
  const lookup = getCounterStore();
  if (lookup.state !== "configured") return null;
  const key = counterKey("likes", type);
  try {
    const next = Number(await write(lookup.config, ["INCRBY", key, String(delta)]));
    if (next < 0) {
      await write(lookup.config, ["SET", key, "0"]);
      return 0;
    }
    return toCount(next);
  } catch {
    return null;
  }
}

/** 좋아요 버튼이 자기 수를 읽을 때 쓴다. 한 유형뿐이라 `MGET` 을 쓰지 않는다. */
export async function readLikes(type: ReadingType): Promise<number | null> {
  const lookup = getCounterStore();
  if (lookup.state !== "configured") return null;
  try {
    const store = lookup.config;
    const response = await fetch(`${store.url}/get/${encodeURIComponent(counterKey("likes", type))}`, {
      headers: { Authorization: `Bearer ${store.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return toCount(await unwrap(response));
  } catch {
    return null;
  }
}
