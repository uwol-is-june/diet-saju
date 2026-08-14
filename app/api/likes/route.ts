import { allowCounterRequest, readCounterRequest } from "@/lib/counter-request";
import { applyLike, readLikes } from "@/lib/counters";
import { READING_TYPES } from "@/lib/saju/schema";

/**
 * 좋아요 (TASK-51).
 *
 * ## 누가 눌렀는지 받지 않는다
 *
 * 몸통에 들어오는 것은 **유형 이름과 방향(+1 / -1)뿐**이다. 중복은 브라우저의
 * `localStorage` 플래그가 막는다 — 서버에 신원을 만들면 처리방침 3항("IP 주소: 최대
 * 1분")을 고쳐야 하는데, 좋아요는 정확한 수가 필요한 값이 아니라 그 값을 치를 이유가 없다.
 * 개발자 도구로 풀 수 있다는 것을 알고 고른 쪽이다.
 *
 * ## 취소를 허용한다 (2026-08-14 확정)
 *
 * 오눌림을 되돌릴 길이 없으면 아예 안 누르게 된다. 대신 브라우저 저장소를 지운 사람이
 * 취소만 누를 수 있으므로 **하한 0** 을 서버가 강제한다 (`applyLike`).
 *
 * ## 조회수와 달리 수를 돌려준다
 *
 * 누른 사람은 자기가 누른 결과를 바로 본다. 비콘과 달리 **응답이 화면에 쓰인다.**
 */
export const dynamic = "force-dynamic";

/** 버튼이 마운트될 때 현재 수를 읽어 간다. 저장소가 없으면 `null` 이고 버튼은 수를 감춘다. */
export async function GET(request: Request): Promise<Response> {
  const value = new URL(request.url).searchParams.get("type");
  const type = READING_TYPES.find((candidate) => candidate === value);
  if (!type) return Response.json({ count: null }, { status: 400 });
  return Response.json({ count: await readLikes(type) });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readCounterRequest(request);
  if (!parsed) return Response.json({ count: null }, { status: 400 });
  if (!allowCounterRequest(request)) return Response.json({ count: null }, { status: 429 });

  return Response.json({ count: await applyLike(parsed.type, parsed.delta) });
}
