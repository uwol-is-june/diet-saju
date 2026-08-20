"use client";

import { createContext, useContext } from "react";
import Markdown from "react-markdown";
import { dropUnclosedEmphasis, emphasizeVerdictLabels } from "@/lib/reading/emphasis";
import { breakSentences } from "@/lib/reading/line-breaks";
import {
  SECTION_ICON,
  SECTION_SPECS,
  parseReadingSections,
  type ParsedSection,
  type ReadingSectionId,
} from "@/lib/reading/sections";
import type { ReadingType } from "@/lib/saju/schema";

/**
 * 풀이를 섹션별로 그린다. 계약(`lib/reading/sections.ts`)이 정한 `## 제목` 이 도착할 때마다
 * 그 앞 섹션을 완결로 보고 렌더한다.
 *
 * **아코디언을 쓰지 않는다** — 접혀 있으면 글이 써지는 것을 볼 수 없고 풀이는 통독하는
 * 글이다. 요약만 카드로 띄우고 나머지는 한 카드 안에서 구분선으로 나눈다.
 *
 * **폴백**: 아무 섹션도 못 잡히면(`recognized === false`) 원문 마크다운을 그대로 그린다.
 * 계약은 부탁이라 어길 수 있고, 그때 화면이 비면 형식 문제가 내용 손실로 번진다.
 */
/**
 * 굵게 만들 판정 라벨. **prop 으로 흘리지 않고 context 로 둔다** — `Prose` 호출부가
 * 셋(본문·프리앰블·**폴백**)이고 폴백은 평소에 안 보여서 빠뜨려도 눈에 띄지 않는다.
 */
const VerdictLabels = createContext<readonly string[]>([]);

/**
 * 섹션 제목 규격. **요약 카드와 아래 카드가 이 한 값을 함께 쓴다** (TASK-108) — 두 곳에
 * 손으로 적으면 한쪽만 바뀌어 위계가 다시 뒤집힌다(요약이 위에 있는데 제목이 더 작았다).
 *
 * **`tracking-wide` 를 붙이지 않는다.** `.title-sm` 이 `letter-spacing: -0.01em` 을 걸고
 * `tracking-wide` 는 `+0.025em` 이라 같은 유틸리티 레이어 안에서 서로 싸운다 — 어느 쪽이
 * 이기는지 선언 순서에 달려 있어 눈으로 확인해야 하는 값이 된다.
 */
const SECTION_TITLE = "title-sm title-bold mb-2";

export function ReadingSections({
  reading,
  readingType,
  streaming,
  verdictLabels = [],
}: {
  reading: string;
  readingType: ReadingType;
  streaming: boolean;
  /** `lib/reading/emphasis.ts` 의 `collectVerdictLabels` 결과. 비면 강조하지 않는다. */
  verdictLabels?: readonly string[];
}) {
  const parsed = parseReadingSections(reading, readingType, streaming);

  if (!parsed.recognized) {
    return (
      <VerdictLabels value={verdictLabels}>
        <section className="reading rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <ReadingStatus streaming={streaming} hasText={reading.length > 0} />
        {reading ? (
          <>
            <Prose>{reading}</Prose>
            {streaming && <StreamingCursor />}
          </>
        ) : (
            <p className="text-sm text-ink-muted">풀이를 쓰고 있습니다…</p>
          )}
        </section>
      </VerdictLabels>
    );
  }

  const summary = parsed.sections.find((section) => section.emphasis === "summary");
  const rest = parsed.sections.filter((section) => section !== summary);
  const lastIndex = parsed.sections.length - 1;
  const isLast = (section: ParsedSection) => parsed.sections[lastIndex] === section;

  return (
    <VerdictLabels value={verdictLabels}>
      <div className="space-y-4">
        <ReadingStatus streaming={streaming} hasText />

      {parsed.preamble && (
        <section className="reading rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <Prose>{parsed.preamble}</Prose>
        </section>
      )}

      {summary && (
        <section className="anim-rise rounded-2xl border border-brand-border bg-brand-subtle p-5 shadow-sm sm:p-6">
          {/*
            **아래 카드의 섹션 제목과 문자 그대로 같은 규격이다** (`SECTION_TITLE` · TASK-108).
            예전에는 여기가 `text-sm`(14px)이라 **위에 있는 카드의 제목이 그 밑 소제목보다
            작아 위계가 뒤집혀** 있었다. 색만 브랜드 잉크로 다르다.
          */}
          <h2 className={`${SECTION_TITLE} text-brand-ink`}>
            <SectionIcon id={summary.id} />
            {summary.title}
          </h2>
          <Body section={summary} showCursor={streaming && isLast(summary)} />
        </section>
      )}

      {rest.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="divide-y divide-line">
            {rest.map((section, index) => (
              /*
                key 는 **제목이 아니라 id** 다. 계약에 없는 제목은 도착하는 대로 글자가
                늘어나므로 제목을 key 로 쓰면 조각마다 remount 되어 등장 애니메이션이
                다시 재생되고 글이 떨린다.
              */
              <article
                /*
                  **id 뒤에 index 를 붙인다** — 모델이 같은 제목을 두 번 낼 때가 있어 id 만
                  쓰면 key 가 겹친다. index 는 스트리밍 중 앞쪽 섹션에서 바뀌지 않으므로
                  위 안정성은 그대로다.
                */
                key={section.id ? `${section.id}-${index}` : `unmatched-${index}`}
                className="anim-rise py-5 first:pt-0 last:pb-0"
              >
                {/*
                  규격은 `SECTION_TITLE` 하나이고 요약 카드가 같은 값을 쓴다 (TASK-108).

                  **`globals.css` 의 `.reading h2`(1.125rem)와 같은 크기다** (TASK-67).
                  예전에는 여기가 `text-base`(16px)라 본문과 같은 크기였고 굵기로만
                  구분됐다 — 계약이 깨져 원문 폴백으로 갈 때만 제목이 커지는 셈이라
                  두 경로가 어긋나 있었다.

                  **제목에 `.reading` 을 걸면 안 된다.** 그 규칙은 `@layer` 밖이라
                  Tailwind 유틸리티를 이기고, 여기 붙인 크기 클래스가 조용히 무시된다.
                */}
                <h2 className={SECTION_TITLE}>
                  <SectionIcon id={section.id} />
                  {section.title}
                </h2>
                <Body section={section} showCursor={streaming && isLast(section)} />
              </article>
            ))}
          </div>
        </section>
      )}

        <ProgressNote parsed={parsed} readingType={readingType} streaming={streaming} />
      </div>
    </VerdictLabels>
  );
}

/**
 * 제목 앞 아이콘. **계약에 있는 섹션에만 붙는다** — 계약에 없는 제목은 어느 절인지 모른다.
 * `aria-hidden` 이다 (스크린리더가 "나뭇잎 오행으로 본 체질" 로 읽으면 안 된다).
 */
function SectionIcon({ id }: { id: ReadingSectionId | null }) {
  if (!id) return null;
  return (
    <span aria-hidden className="mr-1.5 select-none">
      {SECTION_ICON[id]}
    </span>
  );
}

/**
 * `.reading` 은 **본문에만** 두고 섹션 제목에는 두지 않는다. `globals.css` 의 `.reading h2`
 * 는 `@layer` 밖이라 Tailwind 유틸리티를 이긴다 — 제목에 걸면 컴포넌트가 붙인 클래스가
 * 조용히 무시된다.
 */
function Body({ section, showCursor }: { section: ParsedSection; showCursor: boolean }) {
  // 제목만 도착하고 본문이 아직 없는 순간 — 커서만 보여 준다.
  if (!section.body) return showCursor ? <StreamingCursor /> : null;
  return (
    <div className="reading">
      <Prose>{section.body}</Prose>
      {showCursor && <StreamingCursor />}
    </div>
  );
}

/**
 * 스트리밍 본문에 aria-live 를 걸면 글자가 늘 때마다 전체가 다시 읽혀 소음이 된다.
 * 본문은 일반 영역으로 두고 상태 변화만 알린다 (role="status" = polite).
 */
function ReadingStatus({ streaming, hasText }: { streaming: boolean; hasText: boolean }) {
  return (
    <p className="sr-only" role="status">
      {streaming ? "풀이를 생성하고 있습니다." : hasText ? "풀이 생성이 끝났습니다." : ""}
    </p>
  );
}

/** 몇 개 중 몇 번째 절을 쓰고 있는지. 남은 분량을 알면 기다리는 체감이 달라진다. */
function ProgressNote({
  parsed,
  readingType,
  streaming,
}: {
  parsed: ReturnType<typeof parseReadingSections>;
  readingType: ReadingType;
  streaming: boolean;
}) {
  if (!streaming) return null;

  // 선택 섹션(대운 없을 때 생략되는 절)은 안 와도 정상이므로 분모에서 뺀다.
  const expected = SECTION_SPECS[readingType].filter((spec) => !spec.optional).length;
  const done = parsed.sections.filter((section) => section.complete && section.id).length;

  return (
    <p aria-hidden className="text-center text-xs text-ink-muted">
      풀이를 쓰고 있습니다… {Math.min(done, expected)}/{expected}
    </p>
  );
}

/**
 * 마크다운을 그리는 **유일한 통로.** `react-markdown` 을 직접 부르지 말 것 — 줄바꿈 변환이
 * 렌더 직전이라 호출부마다 붙이면 한 곳(특히 **폴백 경로**)을 빠뜨리게 되고 화면이 경로에
 * 따라 다르게 보인다.
 */
function Prose({ children }: { children: string }) {
  const labels = useContext(VerdictLabels);
  /*
    **순서가 중요하다.**
    ① 닫히지 않은 `**` 를 먼저 지운다 — 그래야 강조 삽입이 "`**` 는 짝수" 가정 위에서 돈다.
       스트리밍 중에는 `**식욕형` 까지만 도착한 순간이 반드시 있다.
    ② 판정 라벨의 첫 등장을 굵게 (`lib/reading/emphasis.ts`).
    ③ 마지막에 문장 단위로 문단을 가른다.
  */
  const emphasized = emphasizeVerdictLabels(dropUnclosedEmphasis(children), labels);
  return <Markdown>{breakSentences(emphasized)}</Markdown>;
}

/** 생성 중임을 알리는 커서. 텍스트가 멈춰 있어도 살아 있다는 신호가 된다. */
function StreamingCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand align-middle"
    />
  );
}
