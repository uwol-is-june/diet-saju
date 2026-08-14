"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { EMPTY_BIRTH_INPUT, type BirthInput } from "@/lib/form/birth-input";

/**
 * 폼 입력값을 **루트 레이아웃의 메모리에** 들고 있는 프로바이더 (TASK-30).
 *
 * ## 왜 여기에 두는가
 *
 * 유형을 먼저 고르는 두 단계 플로우(`/` → `/reading/[type]`)에서, 유형을 바꿀 때마다
 * 생년월일을 다시 넣게 하면 단계를 나눈 이득이 마찰로 상쇄된다. 그렇다고 저장하면
 * `app/privacy/page.tsx` 의 "저장하지 않습니다" 가 무너진다. **메모리에만 두면 둘 다 피한다.**
 *
 * Next 문서가 "layouts preserve state, remain interactive, and do not re-render on
 * navigation" 을 보장하므로(`node_modules/next/dist/docs/01-app/04-glossary.md`)
 * 루트 레이아웃의 React state 는 `/` ↔ `/reading/*` 이동에서 살아남는다.
 * **`app/reading/layout.tsx` 에 두면 안 된다** — `/`(유형 선택)를 거쳐 가면 언마운트되어
 * 값이 날아간다.
 *
 * ## 저장소·URL 로 옮기지 말 것
 *
 * `sessionStorage`·`localStorage`·쿼리스트링은 셋 다 생년월일을 프로세스 밖으로 내보낸다 —
 * 앞의 둘은 디스크에, 쿼리스트링은 방문 기록과 **Vercel 액세스 로그**에. 그 순간
 * 개인정보 처리방침을 같은 커밋에서 고쳐야 하는 쪽으로 넘어간다.
 *
 * 지금 상태는 새로고침·새 탭·탭 닫기로 사라진다 — **지금 폼이 이미 하는 것과 같은 범주**라
 * 처리방침을 손대지 않아도 된다. 이 조건을 벗어나면 고쳐야 한다는 뜻이기도 하다.
 *
 * ## 보존 대상은 입력값뿐이다
 *
 * 원국·풀이(`chart`·`reading`)는 유형마다 다르므로 들고 다니지 않는다. 유형을 옮기면
 * `SajuForm` 이 언마운트되면서 진행 중인 스트림도 함께 끊긴다.
 *
 * `children` 을 prop 으로 받으므로 이 컴포넌트가 클라이언트여도 **`/` 는 서버
 * 컴포넌트로 렌더된다.**
 */

interface BirthInputStore {
  input: BirthInput;
  update: (patch: Partial<BirthInput>) => void;
}

const BirthInputContext = createContext<BirthInputStore | null>(null);

export function BirthInputProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState<BirthInput>(EMPTY_BIRTH_INPUT);

  const update = useCallback((patch: Partial<BirthInput>) => {
    setInput((previous) => ({ ...previous, ...patch }));
  }, []);

  const value = useMemo(() => ({ input, update }), [input, update]);

  return <BirthInputContext.Provider value={value}>{children}</BirthInputContext.Provider>;
}

export function useBirthInput(): BirthInputStore {
  const store = useContext(BirthInputContext);
  if (!store) {
    throw new Error("useBirthInput 은 BirthInputProvider 안에서만 쓸 수 있습니다");
  }
  return store;
}
