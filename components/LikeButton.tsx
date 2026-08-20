"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { READING_TYPE_LABEL, type ReadingType } from "@/lib/saju/schema";

/**
 * 좋아요 버튼. 로그인이 없고 **중복은 브라우저가 막는다** — 서버에 신원을 만들면 처리방침
 * 3항을 고쳐야 하는데 좋아요는 정확한 수가 필요한 값이 아니다. 개발자 도구로 풀 수 있다는
 * 것을 알고 고른 쪽이다.
 *
 * 여기 쓰는 `localStorage` 는 `FirstVisitNotice` 와 같은 범주다 — **생년월일 입력 경로에는
 * 한 글자도 넣지 않는다.**
 *
 * **취소를 허용한다** (되돌릴 길이 없으면 아예 안 누르게 된다). 하한 0 은 서버가 강제한다.
 *
 * **저장소가 없으면 수를 감춘다** — "0" 은 아무도 안 눌렀다는 거짓말이 되는데 실제로는
 * 셀 수가 없는 상태다.
 *
 * 결과가 다 나온 뒤에만 붙는다 (`streaming` 중에는 가린다) — 쓰이고 있는 글을 끊지 않는다.
 */

/**
 * 누른 흔적은 **브라우저 저장소에 있는 외부 상태**다. `useEffect` + `setState` 로 읽으면
 * 하이드레이션 불일치를 만들어 `useSyncExternalStore` 로 간다.
 *
 * 서버 스냅샷은 "안 누름" 이다 — 이미 누른 사람에게 빈 하트가 한 틱 보이는 편이 반대보다 낫다.
 */
let listeners: (() => void)[] = [];

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  // 다른 탭에서 누른 것도 반영한다.
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
    window.removeEventListener("storage", listener);
  };
}

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    // 사파리 프라이빗 모드 등에서 던진다. 누른 적 없는 것으로 둔다.
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // 기록에 실패하면 다음 방문에 다시 누를 수 있게 된다 — 그 정도는 감수한다.
  }
  emit();
}

export function LikeButton({ type }: { type: ReadingType }) {
  const storageKey = `diet-saju:like:${type}`;
  const liked = useSyncExternalStore(
    subscribe,
    () => readFlag(storageKey),
    () => false,
  );
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/likes?type=${type}`)
      .then((response) => response.json())
      .then((body: { count?: number | null }) => {
        if (alive) setCount(typeof body.count === "number" ? body.count : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [type]);

  async function toggle() {
    if (busy) return;
    setBusy(true);

    const next = !liked;
    const delta = next ? 1 : -1;

    // 낙관적 갱신 — 누른 즉시 반응이 있어야 한다. 실패하면 아래에서 되돌린다.
    writeFlag(storageKey, next);
    setCount((current) => (current === null ? current : Math.max(0, current + delta)));

    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, delta }),
      });
      const body: { count?: number | null } = await response.json();
      if (typeof body.count === "number") setCount(body.count);
      else throw new Error("카운트 없음");
    } catch {
      // 서버가 못 받았으므로 화면도 되돌린다. 반영 안 된 것을 반영된 것처럼 두지 않는다.
      writeFlag(storageKey, !next);
      setCount((current) => (current === null ? current : Math.max(0, current - delta)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-center py-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={liked}
        /* 화면에는 "도움이 됐어요" 만 보이지만, 무엇에 대한 것인지가 이름에 있어야 한다. */
        aria-label={`${READING_TYPE_LABEL[type]} 풀이가 도움이 됐어요`}
        /*
          **`components/ui/Button` 을 쓰지 않는다.** 이건 버튼이 아니라 **켜짐/꺼짐이 있는
          칩**이라 눌린 상태를 면 색으로 보여야 하고 variant 축이 다르다(`aria-pressed`).
          부품에 네 번째 variant 를 만들면 그 축이 섞인다.
        */
        className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition ${
          liked
            ? "border-brand-border bg-brand-subtle text-brand-ink"
            : "border-line-strong bg-surface text-ink-soft hover:border-brand hover:bg-brand-subtle"
        }`}
      >
        {/* 하트는 장식이다 — 버튼 이름은 옆 글자가 만든다. */}
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        <span>{liked ? "좋아요 취소" : "도움이 됐어요"}</span>
        {count !== null && <span className="tabular-nums text-ink-muted">{count}</span>}
      </button>
    </div>
  );
}
