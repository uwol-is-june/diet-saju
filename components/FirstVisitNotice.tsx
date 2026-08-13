"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "diet-saju:notice-dismissed";

/**
 * 안내를 닫았는지 여부는 **브라우저 저장소**에 있는 외부 상태다.
 * `useEffect` + `setState` 로 읽으면 하이드레이션 불일치와 lint 경고를 함께 만든다.
 * 외부 상태를 구독하는 용도로 만들어진 `useSyncExternalStore` 를 쓴다.
 *
 * 서버 스냅샷은 "닫힘"으로 둔다. 서버는 저장소를 볼 수 없으므로, 안내를 이미 닫은
 * 사용자에게 배너가 한 번 번쩍이는 것보다 처음 방문자에게 한 틱 늦게 보이는 편이 낫다.
 */
let listeners: (() => void)[] = [];

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  // 다른 탭에서 닫았을 때도 반영한다.
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
    window.removeEventListener("storage", listener);
  };
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // 시크릿 모드 등에서 접근이 막히면 안내를 보여준다.
    return false;
  }
}

function isDismissedOnServer(): boolean {
  return true;
}

function dismiss() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // 기록에 실패해도 아래 emit 으로 이번 세션에서는 닫힌 것처럼 보인다.
  }
  emit();
}

export function FirstVisitNotice() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, isDismissedOnServer);

  if (dismissed) return null;

  return (
    <aside className="mb-6 rounded-2xl border border-brand-border bg-brand-subtle p-5">
      <h2 className="mb-2 text-sm font-bold text-brand-ink">시작하기 전에</h2>
      <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
        <li>· 이 풀이는 오락·참고 목적입니다. 의학적·법률적 조언이 아닙니다.</li>
        <li>· 입력한 생년월일은 저장하지 않습니다.</li>
        <li>
          · 해석문 생성을 위해 입력 내용이 Google 로 전송되며, 무료 등급 이용 중이라 Google 이
          제품 개선에 사용할 수 있습니다. 이름은 비워 두셔도 됩니다.
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition hover:bg-brand-hover"
        >
          확인했습니다
        </button>
        <Link href="/privacy" className="text-xs text-ink-muted underline hover:text-brand-ink">
          개인정보 처리방침
        </Link>
        <Link href="/disclaimer" className="text-xs text-ink-muted underline hover:text-brand-ink">
          면책 고지
        </Link>
      </div>
    </aside>
  );
}
