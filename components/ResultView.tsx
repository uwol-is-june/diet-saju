"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { findCurrentDaeun } from "@/lib/saju/decade";
import type { Pillar, ReadingType, SajuChart, TimeCorrectionInfo } from "@/lib/saju/schema";
import { DaeunTimeline } from "./charts/DaeunTimeline";
import { OhaengBars } from "./charts/OhaengBars";
import { OhaengCycle } from "./charts/OhaengCycle";
import { ThermalScale } from "./charts/ThermalScale";
import { ReadingSections } from "./ReadingSections";
import { ShareActions } from "./ShareActions";
import { VerdictCallout } from "./VerdictCallout";

/* 오행 배지 톤 표는 `charts/OhaengBars.tsx` 로 옮겼다 (TASK-25에서 배지 줄을 막대로 교체). */

/** 카드 공통 — 모바일에서는 안쪽 여백을 줄여 4기둥 칸이 눌리지 않게 한다. */
const CARD = "rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6";

/**
 * 원국은 코드가 즉시 계산하므로 먼저 그린다. 풀이는 스트리밍으로 채워진다.
 * `streaming` 이 true 면 아직 생성 중이라는 표시를 붙인다.
 */
export function ResultView({
  chart,
  reading,
  readingType,
  streaming = false,
  birthplace = null,
}: {
  chart: SajuChart;
  reading: string;
  /** **요청할 때** 고른 유형. 폼의 현재 값이 아니다 — 섹션 계약이 유형별로 다르다. */
  readingType: ReadingType;
  streaming?: boolean;
  /**
   * 표시용 출생지 이름 (TASK-37). **`chart` 에 들어 있지 않다** — 계산에 필요한 것은
   * 경도뿐이라 지역 이름은 서버로 보내지 않고, 폼이 들고 있는 값을 그대로 받는다.
   */
  birthplace?: string | null;
}) {
  const pillars: { label: string; pillar: Pillar | null }[] = [
    { label: "연주", pillar: chart.year },
    { label: "월주", pillar: chart.month },
    { label: "일주", pillar: chart.day },
    { label: "시주", pillar: chart.hour },
  ];

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <h2 className="mb-1 text-lg font-bold">사주 원국</h2>
        <p className="mb-4 text-sm text-ink-muted">
          양력 {chart.solarDate} · 음력 {chart.lunarDate} · {chart.saencho}띠
        </p>

        <div className="grid grid-cols-4 gap-2">
          {pillars.map(({ label, pillar }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-inset p-2.5 text-center sm:p-3"
            >
              <div className="mb-1 text-xs text-ink-muted">{label}</div>
              {pillar ? (
                <>
                  <div className="text-xl font-bold tracking-tight">{pillar.ganji}</div>
                  <div className="mt-1 text-xs text-ink-muted">{pillar.sipsin}</div>
                  <div className="text-xs text-ink-muted">{pillar.jiSipsin}</div>
                </>
              ) : (
                <div className="py-2 text-xs text-ink-muted">시각 미상</div>
              )}
            </div>
          ))}
        </div>

        {/*
          배지 줄은 걷어냈다 — 막대 도식이 같은 것(오행·개수·계절 기세)을 더 잘 말한다.
          같은 사실을 두 번 그리면 화면만 길어지고, 어느 쪽을 봐야 하는지 헷갈린다.
        */}
        <div className="mt-4 border-t border-line pt-4">
          <OhaengBars ohaeng={chart.ohaeng} balance={chart.constitution.balance} />
        </div>

        <p className="mt-3 text-sm text-ink-soft">
          {chart.ohaeng.season}에 태어나 <strong>{chart.ohaeng.strongest}</strong> 기운이 가장
          강하고, 신강·신약은 <strong>{chart.strength.verdict}</strong>입니다
          <span className="text-ink-muted">
            {" "}
            (득령 {chart.strength.deukryeong ? "○" : "×"} · 득지{" "}
            {chart.strength.deukji ? "○" : "×"} · 득세 {chart.strength.deukse ? "○" : "×"})
          </span>
        </p>

        {/*
          득지·득세는 지장간까지 보므로, 위 표의 지지 십신(본기 기준)만으로는
          왜 ○ 인지 설명되지 않는 자리가 생긴다. 근거를 한 줄로 함께 보여준다.
        */}
        {chart.strength.rooted.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            뿌리(통근) — {chart.strength.rooted.join(" · ")}. 지지 속에 숨은 천간까지 보아 득지·득세를
            정합니다.
          </p>
        )}

        <CorrectionNote correction={chart.timeCorrection} birthplace={birthplace} />
      </section>

      <FoldCard title="기운의 관계" note={`상생·상극 · 한열 ${chart.constitution.thermal}`}>
        <p className="mb-4 text-sm text-ink-muted">
          오행은 서로 돕고(상생) 누르며(상극) 균형을 이룹니다.
        </p>
        <OhaengCycle ohaeng={chart.ohaeng} />

        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-bold">
            한열(조후) — <span className="text-brand-ink">{chart.constitution.thermal}</span>
          </h3>
          <ThermalScale constitution={chart.constitution} />
        </div>
      </FoldCard>

      {chart.daeun && <DaeunTable daeun={chart.daeun} seun={chart.seun} />}

      {/*
        판정 한 줄 콜아웃 (TASK-47). **풀이 바로 위**에 둔다 — 원국은 60~70ms 에 오고
        첫 글자는 1초 뒤라, 기다리는 동안 결론 한 줄이 먼저 뜬다.
        스트리밍 중에도 낸다. `OtherReadingLinks` 와 달리 **읽고 있는 글을 끊는 것이
        아니라 그 글의 결론**이라, 먼저 떠 있는 편이 오히려 읽는 데 도움이 된다.
      */}
      <VerdictCallout chart={chart} readingType={readingType} />

      <div aria-label="풀이" aria-busy={streaming} role="region">
        <ReadingSections reading={reading} readingType={readingType} streaming={streaming} />
      </div>

      {/* 생성이 끝난 뒤에 보여준다 — 쓰는 중에 공유 버튼을 내밀면 미완성 결과를 퍼뜨린다. */}
      {!streaming && <ShareActions chart={chart} readingType={readingType} />}

      {/*
        전문가 상담 권유가 **본문이 아니라 여기 있다** (TASK-57 · 2026-08-18).
        예전에는 `TYPE_RULES` 셋이 "마지막에 한 문장 덧붙이세요" 를 요구해서 모든 풀이가
        법적 고지로 끝났고, 읽고 나서 마지막에 남는 인상이 그것이었다. 화면으로 옮기니
        본문을 사람 말로 끝낼 수 있고 **약속은 오히려 더 확실해진다 — LLM 이 빠뜨릴 수 없다.**
        지우면 `app/disclaimer/page.tsx` 의 약속을 지키는 자리가 아무 데도 없어진다.
      */}
      <p className="text-center text-xs leading-relaxed text-ink-muted">
        이 풀이는 명리학 해석을 참고한 오락·참고용 콘텐츠이며, AI 가 작성했습니다.
        <br />
        의학적·법률적 조언이 아니니, 몸과 건강에 관한 판단은 전문가와 상의해 주세요.{" "}
        <Link href="/disclaimer" className="underline hover:text-brand-ink">
          면책 고지
        </Link>
      </p>
    </div>
  );
}

function DaeunTable({
  daeun,
  seun,
}: {
  daeun: NonNullable<SajuChart["daeun"]>;
  seun: SajuChart["seun"];
}) {
  const currentAge = seun[0]?.age;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  /** 접힌 동안은 내용이 `display: none` 이라 폭을 잴 수 없다 — 펼친 뒤에 가운데를 잡는다. */
  const [open, setOpen] = useState(false);

  // 현재 대운을 찾는 규칙은 `lib/saju/decade.ts` 한 곳에 있다 (TASK-45).
  const currentPeriod = findCurrentDaeun(daeun, currentAge);

  /**
   * 대운 8~10칸은 어떤 화면에서도 가로로 넘친다. 현재 대운이 뒤쪽이면 처음엔 보이지 않아
   * "지금 어디쯤인가"를 놓친다 → 열릴 때 현재 칸을 가운데로 당겨 둔다.
   *
   * scrollIntoView 를 쓰지 않는 이유: 세로 스크롤까지 움직여 폼에서 결과로 넘어오는
   * 자동 스크롤과 싸운다. 가로 위치만 직접 계산한다.
   *
   * **`open` 이 의존성에 있어야 한다** (TASK-52). 접힌 `<details>` 안에서는 모든 칸의
   * `getBoundingClientRect()` 가 0 이라, 마운트 때 한 번만 계산하면 결과가 전부 0 이 되어
   * 펼쳤을 때 맨 왼쪽에 머문다.
   */
  useEffect(() => {
    if (!open) return;
    const scroller = scrollerRef.current;
    const current = currentRef.current;
    if (!scroller || !current) return;
    const offset =
      current.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    const centered = scroller.scrollLeft + offset - (scroller.clientWidth - current.clientWidth) / 2;
    scroller.scrollLeft = Math.max(0, centered);
  }, [daeun, open]);

  return (
    <FoldCard
      title="대운 · 세운"
      note={
        currentPeriod
          ? `지금 ${currentPeriod.ganji} 대운 · ${currentPeriod.sipsin}`
          : `${daeun.direction === "forward" ? "순행" : "역행"} · 첫 대운 ${daeun.startAge}세부터`
      }
      onToggle={setOpen}
    >
      <p className="mb-4 text-sm text-ink-muted">
        {daeun.direction === "forward" ? "순행" : "역행"} · 첫 대운 {daeun.startAge}세부터
        <span className="text-ink-muted"> (절기까지 {daeun.daysToJeol}일 ÷ 3)</span>
      </p>

      {/* 스크롤 없이 "지금 어디쯤인가" 부터 보여 준다. 아래 카드가 세부를 맡는다. */}
      <div className="mb-4">
        <DaeunTimeline daeun={daeun} currentAge={currentAge} />
      </div>

      {/*
        카드 여백만큼 밖으로 늘려 화면 끝까지 스크롤되게 한다 (모바일 p-5, 데스크톱 p-6).
        overscroll-x-contain: 끝까지 밀었을 때 iOS 의 뒤로가기 스와이프로 넘어가지 않게 막는다.
        scroller-x: 스크롤바 두께·색과 카드와의 간격 (globals.css · TASK-43).
      */}
      <div
        ref={scrollerRef}
        className="scroller-x -mx-5 overflow-x-auto overscroll-x-contain px-5 sm:-mx-6 sm:px-6"
      >
        <div className="flex min-w-max gap-2">
          {daeun.periods.map((period) => {
            const isCurrent =
              currentAge !== undefined &&
              currentAge >= period.startAge &&
              currentAge <= period.endAge;
            return (
              <div
                key={period.startAge}
                ref={isCurrent ? currentRef : undefined}
                className={`w-20 shrink-0 rounded-xl p-3 text-center ${
                  isCurrent ? "bg-brand-subtle ring-1 ring-brand" : "bg-surface-inset"
                }`}
              >
                <div className="text-xs text-ink-muted">{period.startAge}세</div>
                <div className="text-base font-bold">{period.ganji}</div>
                <div className="mt-0.5 text-[11px] text-ink-muted">{period.sipsin}</div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        가로로 밀어 전체 대운을 볼 수 있습니다
        {currentAge !== undefined && " · 강조된 칸이 현재 대운입니다"}
      </p>

      <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm text-ink-soft">
        {seun.map((year) => (
          <li key={year.year}>
            <span className="text-ink-muted">{year.year}년 ({year.age}세)</span>{" "}
            <strong>{year.ganji}</strong> · {year.sipsin}/{year.jiSipsin}
          </li>
        ))}
      </ul>
    </FoldCard>
  );
}

/**
 * 접어 둔 근거 카드 (TASK-52).
 *
 * 도식은 코드가 만든 **근거**이고 사람들이 보러 온 것은 풀이 본문이다. 도식 카드 셋을
 * 다 펼쳐 두면 본문이 화면 두 개쯤 아래로 밀린다. 그래서 원국(4기둥 표)만 펼쳐 두고
 * 나머지는 접는다 — 원국은 "무엇으로 이 풀이가 나왔는가" 를 한눈에 보여주는 카드라
 * 접으면 결과가 어디서 왔는지 알 수 없다.
 *
 * **풀이 섹션에 아코디언을 쓰지 않는 것과 모순이 아니다** (`ReadingSections.tsx`).
 * 그쪽은 지금 써지고 있는 글이라 접으면 스트리밍이 보이지 않는다. 도식은 요청 즉시
 * 확정되고 그 뒤로 변하지 않으므로 접어 둬도 놓치는 순간이 없다.
 *
 * `note` 는 **펴지 않아도 알 수 있어야 하는 한 줄**이다. 제목만 있는 접힌 줄은 무엇이
 * 들었는지 알려주지 않아 결국 전부 펴 보게 만든다. 모양·화살표는 `globals.css` 의
 * `.fold` 가 정한다.
 */
function FoldCard({
  title,
  note,
  onToggle,
  children,
}: {
  title: string;
  note: string;
  /** 접힌 동안 잴 수 없는 것(대운 가로 위치)이 있는 카드가 쓴다. */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="fold rounded-2xl border border-line bg-surface shadow-sm"
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      {/* 제목을 `h2` 로 두어 원국·풀이와 같은 단계로 읽히게 한다 (제목 탐색이 살아 있다). */}
      <summary className="flex items-center gap-x-3 gap-y-1 p-5 sm:p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="min-w-0 truncate text-sm text-ink-muted">{note}</span>
      </summary>
      <div className="border-t border-line p-5 sm:p-6">{children}</div>
    </details>
  );
}

/** 어떤 보정을 적용해 이 원국이 나왔는지 근거를 밝힌다. */
function CorrectionNote({
  correction,
  birthplace,
}: {
  correction: TimeCorrectionInfo;
  birthplace: string | null;
}) {
  // 시각 미상이면 보정 자체를 하지 않으므로 알릴 것이 없다.
  if (correction.appliedTime === null) return null;

  const notes: string[] = [];

  if (correction.appliedTime && correction.correctionMinutes !== 0) {
    const sign = correction.correctionMinutes < 0 ? "−" : "+";
    // 보정량의 근거가 출생지이므로 함께 적는다. 안 고르면 서울 기준임을 밝힌다.
    const basis = birthplace ? `${birthplace} 기준` : "서울 기준(지역 미선택)";
    notes.push(
      `${basis} 출생시각 ${sign}${Math.abs(correction.correctionMinutes)}분 보정 → ${correction.appliedTime}`,
    );
  }
  if (correction.dstMinutes > 0) {
    notes.push("서머타임 시행 구간 (1시간 앞당겨진 시계시 보정)");
  }
  if (correction.standardOffsetMinutes === 510) {
    notes.push("당시 표준시는 동경 127.5°(UTC+8:30)");
  }
  if (correction.appliedDateShifted) {
    notes.push("보정으로 날짜가 넘어가 전날 일주로 판정");
  }
  if (correction.dayBoundary === "jasi") {
    notes.push("자시파 기준 (23시부터 다음날 일주)");
  }

  if (notes.length === 0) return null;

  return (
    <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-ink-muted">
      {notes.map((note) => (
        <li key={note}>· {note}</li>
      ))}
    </ul>
  );
}
