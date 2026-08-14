import { allowCounterRequest, readCounterRequest } from "@/lib/counter-request";
import { incrementView } from "@/lib/counters";

/**
 * 조회수 +1 (TASK-51).
 *
 * ## 왜 라우트가 필요한가 — 서버 렌더에서 세면 프리렌더가 죽는다
 *
 * `/reading/[type]` 은 `generateStaticParams` 로 네 유형이 전부 프리렌더돼 있다. 렌더
 * 경로에서 저장소를 건드리면 그 페이지가 통째로 동적이 되어 **모든 방문이 함수 실행**이
 * 된다 — 조회수 하나 세려고 페이지 성질을 바꾸는 셈이다. 그래서 브라우저가 마운트 뒤에
 * 이 라우트를 두드린다 (`components/ViewBeacon.tsx`).
 *
 * 부작용 하나가 이득이다: **크롤러는 JS 를 돌리지 않으므로 세어지지 않는다.** 서버에서
 * 셌다면 봇 트래픽이 그대로 숫자에 섞였을 것이다.
 *
 * ## 언제나 204 다
 *
 * 실패를 브라우저에 알릴 이유가 없다. 비콘은 화면을 이미 보여준 뒤에 나가고, 받는 쪽도
 * 응답을 보지 않는다. 레이트 리밋에 걸렸든 저장소가 죽었든 조용히 넘어간다 — 여기서
 * 4xx 를 돌려주면 콘솔만 벌겋게 만들고 사용자가 할 수 있는 일은 없다.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const parsed = await readCounterRequest(request);
  if (parsed && allowCounterRequest(request)) {
    await incrementView(parsed.type);
  }
  return new Response(null, { status: 204 });
}
