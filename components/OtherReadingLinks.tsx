import Link from "next/link";
import {
  PUBLIC_READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  type ReadingType,
} from "@/lib/saju/schema";

/**
 * 결과 아래에 두는 "다른 유형도 보기" (TASK-31).
 *
 * **평범한 라우트 이동이다.** `router.replace` 로 URL 과 화면을 따로 맞추는 편법을 쓰지
 * 않는다 — `BirthInputProvider` 가 입력을 들고 있으므로 옮겨 간 화면은 값이 채워진 채
 * 접혀 있고, 제출 한 번이면 그 유형의 풀이가 나온다. URL 과 보이는 결과가 항상 일치하는
 * 쪽을 택한 것이다.
 *
 * 현재 유형은 빼고 나머지만 낸다. `PUBLIC_READING_TYPES` 를 순회하므로 유형이 늘면 자동이고,
 * 내부 유형(TASK-41)은 여기 나오지 않는다.
 *
 * **남는 유형이 없으면 아무것도 내지 않는다.** 공개 유형이 하나뿐이면 제목만 남은 빈 상자가
 * 되는데, 그건 "다른 것도 있다" 고 말해 놓고 아무것도 주지 않는 화면이다.
 * 유형이 늘면 저절로 다시 나타난다.
 */
export function OtherReadingLinks({ current }: { current: ReadingType }) {
  const others = PUBLIC_READING_TYPES.filter((type) => type !== current);
  if (others.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface-muted p-5 sm:p-6">
      {/*
        제목 아래 여백은 **제목이 직접 든다** (TASK-114). 안내 한 줄을 지웠으므로
        `mb-1`(제목) + `mb-4`(안내) 한 벌이 제목의 `mb-4` 하나로 합쳐진다 — 그냥 지우면
        제목과 첫 링크가 4px 로 붙는다.
      */}
      <h2 className="mb-4 text-base font-bold">다른 유형으로도 보기</h2>
      <ul className="space-y-2">
        {others.map((type) => (
          <li key={type}>
            <Link
              href={`/reading/${type}`}
              className="group flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 transition hover:border-brand hover:bg-brand-subtle"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{READING_TYPE_LABEL[type]}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
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
    </section>
  );
}
