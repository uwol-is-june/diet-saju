import "server-only";
import { checkRateLimit, getClientIdentifier } from "./rate-limit";
import { READING_TYPES, type ReadingType } from "./saju/schema";

/**
 * `/api/views` 와 `/api/likes` 가 함께 쓰는 앞단 (TASK-51).
 *
 * 두 라우트를 하나로 합치지 않은 이유는 하는 일이 다르기 때문이다 — 조회는 마운트마다
 * 자동으로 일어나고 좋아요는 사람이 누른다. 대신 **몸통에 들어올 수 있는 것**과
 * **남용을 막는 방식**은 같아야 하므로 여기서 한 번만 정한다.
 */

/**
 * **유형 이름과 방향 말고는 아무것도 받지 않는다.** 생년월일·입력값은 한 글자도 실리지
 * 않으며, 실린다 해도 여기서 버려진다 — 몸통에서 꺼내는 필드가 이 둘뿐이다.
 * `/api/*` 응답은 `next.config.ts` 가 `no-store` 로 덮는다.
 *
 * **방향은 +1 과 -1 뿐이다.** 몸통의 숫자를 그대로 더하면 한 번에 수를 마음대로 올릴 수
 * 있다. 조회수 쪽은 방향을 쓰지 않는다.
 */
export async function readCounterRequest(
  request: Request,
): Promise<{ type: ReadingType; delta: 1 | -1 } | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const parsed = body as { type?: unknown; delta?: unknown };
  const type = READING_TYPES.find((candidate) => candidate === parsed?.type);
  if (!type) return null;
  return { type, delta: parsed?.delta === -1 ? -1 : 1 };
}

/**
 * 카운터용 분당 한도.
 *
 * 풀이 생성의 5회/분과 **버킷도 한도도 분리한다.** 조회 비콘은 유형을 하나 열 때마다
 * 한 번이고 좋아요는 그보다 잦을 수 있어서, 생성 기준을 그대로 쓰면 카드 몇 개를 눌러
 * 본 사람이 막힌다. 반대로 아예 안 걸면 스크립트가 숫자를 마음대로 올린다.
 *
 * 60 은 "사람이 1초에 한 번씩 계속 눌러야 닿는 수" 다. 정상 사용에는 닿지 않고 자동화는
 * 걸린다.
 */
const COUNTER_LIMIT_PER_MINUTE = 60;

/** 남용을 막되 실패해도 조용히 넘어간다 — 숫자 하나 때문에 화면이 깨지면 안 된다. */
export function allowCounterRequest(request: Request): boolean {
  const identifier = `counter:${getClientIdentifier(request.headers)}`;
  return checkRateLimit(identifier, COUNTER_LIMIT_PER_MINUTE).allowed;
}
