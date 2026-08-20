"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { EMPTY_BIRTH_INPUT, type BirthInput } from "@/lib/form/birth-input";
import { keyMatchesInput, readingCacheKey } from "@/lib/form/reading-cache";
import type { ReadingType, SajuChart } from "@/lib/saju/schema";

/**
 * 폼 입력값을 **루트 레이아웃의 메모리에** 들고 있는 프로바이더.
 *
 * 유형을 바꿀 때마다 생년월일을 다시 넣게 하면 단계를 나눈 이득이 마찰로 상쇄되고,
 * 저장하면 "저장하지 않습니다" 가 무너진다 — **메모리에만 두면 둘 다 피한다.**
 * 레이아웃은 이동에서 언마운트되지 않으므로 값이 살아남는다.
 * **`app/reading/layout.tsx` 로 내리면 안 된다** — `/` 를 거쳐 가면 값이 날아간다.
 *
 * **저장소·URL 로 옮기지 말 것.** `sessionStorage`·`localStorage`·쿼리스트링은 셋 다
 * 생년월일을 프로세스 밖으로 내보낸다(디스크 · 방문 기록 · **Vercel 액세스 로그**).
 * 지금 상태는 새로고침·새 탭·탭 닫기로 사라져 폼이 원래 하던 것과 같은 범주라 처리방침을
 * 손대지 않아도 된다 — **이 조건을 벗어나면 고쳐야 한다는 뜻이기도 하다.**
 *
 * **입력값과 함께 완료된 풀이도 들고 다닌다.** 유형 사이를 오가는 동선이 기본 경로라
 * 예전에는 **이미 본 글을 다시 생성했다** — 아까운 것은 토큰이 아니라 **요청 수**다.
 * 키는 `lib/form/reading-cache.ts` 가 만들고 규칙은 셋이다.
 *
 * 1. **입력이 바뀌면 통째로 비운다** (그래서 상한·LRU 가 필요 없다).
 * 2. **완료된 것만 담는다** — 중간까지 받은 글을 담으면 완결된 풀이인 척 나온다.
 *    판단은 `SajuForm` 이 하고 여기는 담아 주기만 한다.
 * 3. **담기 직전에 키가 지금 입력값과 맞는지 확인한다** — 스트리밍 중에 입력을 고치면
 *    1번이 캐시를 비우는데, 그 뒤 도착한 완성본을 그냥 담으면 **바뀐 입력의 키에 옛
 *    입력의 글이 붙는다.**
 *
 * **캐시도 메모리에만 있다** (위 저장소·URL 금지가 그대로 적용된다).
 *
 * `children` 을 prop 으로 받으므로 이 컴포넌트가 클라이언트여도 **`/` 는 서버 컴포넌트로
 * 렌더된다.**
 */

/** 캐시에 담는 것 — 화면을 그대로 되살리는 데 필요한 둘. */
export interface CachedReading {
  chart: SajuChart;
  reading: string;
}

interface BirthInputStore {
  input: BirthInput;
  update: (patch: Partial<BirthInput>) => void;
  /** 지금 입력값 + 유형으로 만든 캐시 키. 요청 시작 시점에 받아 두었다가 `remember` 에 준다. */
  cacheKey: (readingType: ReadingType) => string;
  /** 그 키로 이미 받은 완성본이 있으면 돌려준다. */
  recall: (key: string) => CachedReading | null;
  /** **완료된** 결과만 넣을 것. 키가 지금 입력값과 어긋나면 조용히 버린다. */
  remember: (key: string, result: CachedReading) => void;
}

const BirthInputContext = createContext<BirthInputStore | null>(null);

export function BirthInputProvider({ children }: { children: React.ReactNode }) {
  const [input, setInput] = useState<BirthInput>(EMPTY_BIRTH_INPUT);

  /**
   * 캐시는 state 가 아니라 ref 다 — 담는다고 화면이 다시 그려질 이유가 없고,
   * `recall` 이 렌더 사이에 안정된 함수여야 `SajuForm` 의 효과가 한 번만 돈다.
   */
  const cacheRef = useRef<Map<string, CachedReading>>(new Map());

  const update = useCallback((patch: Partial<BirthInput>) => {
    // 입력이 바뀌면 통째로 비운다 — 옛 입력의 결과를 다시 볼 일이 없다.
    cacheRef.current.clear();
    setInput((previous) => ({ ...previous, ...patch }));
  }, []);

  /**
   * 키를 만드는 둘은 `input` 에 의존하므로 입력이 바뀌면 함수도 새로 만들어진다.
   * **ref 로 우회하지 않는다** — 렌더 중 ref 쓰기는 동시성 렌더에서 어긋날 수 있다.
   */
  const cacheKey = useCallback(
    (readingType: ReadingType) => readingCacheKey(input, readingType),
    [input],
  );

  const recall = useCallback((key: string) => cacheRef.current.get(key) ?? null, []);

  const remember = useCallback(
    (key: string, result: CachedReading) => {
      // 스트리밍 중에 입력을 고쳤다면 이 완성본은 지금 입력값의 것이 아니다.
      if (!keyMatchesInput(key, input)) return;
      cacheRef.current.set(key, result);
    },
    [input],
  );

  const value = useMemo(
    () => ({ input, update, cacheKey, recall, remember }),
    [input, update, cacheKey, recall, remember],
  );

  return <BirthInputContext.Provider value={value}>{children}</BirthInputContext.Provider>;
}

export function useBirthInput(): BirthInputStore {
  const store = useContext(BirthInputContext);
  if (!store) {
    throw new Error("useBirthInput 은 BirthInputProvider 안에서만 쓸 수 있습니다");
  }
  return store;
}
