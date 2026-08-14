"use client";

import { useEffect, useRef } from "react";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * 조회수 비콘 (TASK-51).
 *
 * **조회수는 `/reading/[type]` 을 연 횟수다** (2026-08-14 확정). 풀이를 생성했는지와는
 * 무관하다 — 열어 보고 그냥 나간 것도 조회다.
 *
 * ## 왜 브라우저가 세는가
 *
 * 이 페이지는 네 유형이 전부 프리렌더돼 있다. 서버 렌더 중에 저장소를 건드리면 페이지가
 * 통째로 동적이 되어 모든 방문이 함수 실행이 된다. 그래서 화면을 다 보여준 뒤에 브라우저가
 * 한 번 두드린다. `/` 는 이런 것조차 두지 않아 클라이언트 JS 가 0 인 채로 남는다.
 *
 * ## 마운트마다 한 번, 그러나 StrictMode 에서는 두 번이 아니다
 *
 * React StrictMode 는 개발에서 이펙트를 두 번 실행한다. 가드가 없으면 로컬에서만 2씩 올라
 * 프로덕션 값과 어긋난다. `useRef` 로 이미 보냈는지를 기억한다 — 상태로 두면 리렌더를
 * 부르고, 여기서 화면에 그릴 것은 아무것도 없다.
 *
 * 새로고침·재방문은 각각 1회로 센다(조회수의 통상적 뜻). 유형 사이를 옮겨 다니면
 * (`OtherReadingLinks`) 컴포넌트가 다시 마운트되므로 그것도 센다 — 실제로 그 유형을 연
 * 것이 맞다.
 *
 * ## 아무것도 그리지 않고, 실패해도 아무 일도 없다
 *
 * 응답을 보지 않는다. 레이트 리밋에 걸렸든 저장소가 죽었든 사용자가 할 수 있는 일이 없다.
 * `keepalive` 는 비콘이 나가기 전에 페이지를 떠나도 요청이 살아남게 한다.
 */
export function ViewBeacon({ type }: { type: ReadingType }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    void fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
      keepalive: true,
    }).catch(() => {});
  }, [type]);

  return null;
}
