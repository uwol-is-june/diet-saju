import type { Metadata } from "next";
import Link from "next/link";
import { readCounters } from "@/lib/counters";
import {
  INTERNAL_READING_TYPES,
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  READING_TYPE_VISIBILITY,
} from "@/lib/saju/schema";

/**
 * 내부 유형 입구 (TASK-41).
 *
 * ## 인증이 없다 — 숨김이지 보호가 아니다
 *
 * 이 주소를 아는 사람은 누구나 들어온다. 지금 목적은 **본인이 다른 사주 서비스와 결과를
 * 대조하는 것**이고, 여기 있는 것은 비밀이 아니라 "메인에서 내린 유형" 일 뿐이라 그것으로
 * 충분하다. **나중에 진짜 관리 기능(사용량 조회·설정 변경 등)을 붙이려면 그 전에 인증을
 * 먼저 넣어야 한다.** 지금 없다는 사실을 모르고 기능만 얹으면 그대로 공개된다.
 *
 * `noindex` 는 검색 유입만 막는다. 접근 제어가 아니다.
 *
 * ## 클라이언트 컴포넌트를 두지 않는다
 *
 * `/` 와 같은 이유다. 링크 목록과 숫자뿐이라 JS 가 필요 없다.
 *
 * ## 다만 정적이 아니다 (TASK-51)
 *
 * 카운터를 읽으므로 요청마다 렌더된다. **캐시된 카운터는 값이 없다** — 저장소가 지금
 * 붙어 있는지를 보러 오는 화면인데 답이 굳어 있으면 확인이 아니다. `/` 의 숫자는 반대로
 * `revalidate` 로 늦춰도 되는 값이라 그쪽은 정적인 채로 둔다.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내부 유형 | 다이어트 사주",
  /**
   * 메인에서 링크가 사라져도 이미 색인됐을 수 있고, 검색에서 들어오면 내린 의미가 없다.
   * `/reading/general` 쪽 `noindex` 는 `app/reading/[type]/page.tsx` 가 붙인다.
   */
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const counters = await readCounters();

  return (
    <>
      <header className="mb-8">
        <h1 className="title-lg title-extrabold mb-2">내부 유형</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          메인 유형 선택에서 내린 풀이입니다. 다른 사주 서비스와 결과를 대조하는 용도로만
          씁니다.
        </p>
      </header>

      <CounterPanel counters={counters} />

      {INTERNAL_READING_TYPES.length === 0 ? (
        <p className="text-sm text-ink-muted">내린 유형이 없습니다.</p>
      ) : (
        <ul aria-label="내부 풀이 유형" className="space-y-3">
          {INTERNAL_READING_TYPES.map((type) => (
            <li key={type}>
              <Link
                href={`/reading/${type}`}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand hover:bg-brand-subtle"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{READING_TYPE_LABEL[type]}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                    {READING_TYPE_DESCRIPTION[type]}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-ink-muted transition group-hover:text-brand-ink"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * 카운터 저장소 상태판 (TASK-51).
 *
 * 지금 단계에서는 **읽기만 한다.** 조회수를 올리는 비콘도, `/` 의 표시도 아직 없다.
 * 그래서 이 화면의 실제 쓸모는 숫자가 아니라 **연결 여부**다 — 값을 읽어 왔다는 것이
 * URL 과 토큰이 둘 다 맞다는 증거이고(틀리면 404·401 이 온다), 그걸 배포된 환경에서
 * 확인할 방법이 달리 없다.
 *
 * 그래서 숫자가 전부 0 인 것이 정상이라는 사실을 화면에 적어 둔다. 안 적으면 다음에 볼 때
 * "연결은 됐는데 왜 0 이지" 를 다시 조사하게 된다.
 */
function CounterPanel({ counters }: { counters: Awaited<ReturnType<typeof readCounters>> }) {
  return (
    <section className="mb-8 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="title-sm title-bold mb-3">카운터 저장소</h2>

      {counters.state === "unconfigured" && (
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-muted">
          연결되어 있지 않습니다. <code>UPSTASH_REDIS_REST_URL</code>·
          <code>UPSTASH_REDIS_REST_TOKEN</code> 또는 <code>KV_REST_API_URL</code>·
          <code>KV_REST_API_TOKEN</code> 중 한 쌍이 있어야 하며, 없으면 카운터는 꺼진 채로
          동작합니다.
        </p>
      )}

      {/* 한쪽만 들어온 경우다. `unconfigured` 와 같은 문구를 쓰면 원인을 못 찾는다. */}
      {counters.state === "misconfigured" && (
        <p className="rounded-xl bg-warning-subtle px-4 py-3 text-sm leading-relaxed text-warning-ink">
          설정이 반쪽입니다 — 들어온 변수: <code>{counters.names.join(", ")}</code>. URL 과
          토큰이 모두 있어야 켜집니다.
        </p>
      )}

      {counters.state === "error" && (
        <p className="rounded-xl bg-danger-subtle px-4 py-3 text-sm leading-relaxed text-danger-ink">
          연결하지 못했습니다 — {counters.reason} ({counters.elapsedMs}ms)
        </p>
      )}

      {counters.state === "ok" && (
        <>
          <p className="mb-4 rounded-xl bg-brand-subtle px-4 py-3 text-sm leading-relaxed text-brand-ink">
            연결됐습니다 ({counters.elapsedMs}ms). 아직 세는 곳이 없어 값은 모두 0 입니다 —
            조회 비콘과 좋아요 버튼은 다음 단계에서 붙습니다.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="pb-2 font-normal">유형</th>
                <th className="pb-2 text-right font-normal">조회</th>
                <th className="pb-2 text-right font-normal">좋아요</th>
              </tr>
            </thead>
            <tbody>
              {READING_TYPES.map((type) => (
                <tr key={type} className="border-b border-line last:border-0">
                  <td className="py-2">
                    {READING_TYPE_LABEL[type]}
                    {READING_TYPE_VISIBILITY[type] === "internal" && (
                      <span className="ml-2 text-xs text-ink-muted">내부</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{counters.counts[type].views}</td>
                  <td className="py-2 text-right tabular-nums">{counters.counts[type].likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
