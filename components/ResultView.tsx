"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import type { Pillar, SajuChart, TimeCorrectionInfo } from "@/lib/saju/schema";

const OHAENG_COLOR: Record<string, string> = {
  목: "bg-ohaeng-mok text-ohaeng-mok-ink",
  화: "bg-ohaeng-hwa text-ohaeng-hwa-ink",
  토: "bg-ohaeng-to text-ohaeng-to-ink",
  금: "bg-ohaeng-geum text-ohaeng-geum-ink",
  수: "bg-ohaeng-su text-ohaeng-su-ink",
};

/** 카드 공통 — 모바일에서는 안쪽 여백을 줄여 4기둥 칸이 눌리지 않게 한다. */
const CARD = "rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6";

/**
 * 원국은 코드가 즉시 계산하므로 먼저 그린다. 풀이는 스트리밍으로 채워진다.
 * `streaming` 이 true 면 아직 생성 중이라는 표시를 붙인다.
 */
export function ResultView({
  chart,
  reading,
  streaming = false,
}: {
  chart: SajuChart;
  reading: string;
  streaming?: boolean;
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

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(chart.ohaeng.count).map(([element, count]) => (
            // 계절 기세는 배지 안에 글자로 이미 있다. title 속성은 터치·키보드에서
            // 뜨지 않으므로 같은 내용을 중복해 넣지 않는다.
            <span
              key={element}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                OHAENG_COLOR[element] ?? "bg-surface-inset text-ink-soft"
              } ${count === 0 ? "opacity-40" : ""}`}
            >
              {element} {count}
              <span className="ml-1 opacity-60">
                {chart.ohaeng.seasonalState[element as keyof typeof chart.ohaeng.seasonalState]}
              </span>
            </span>
          ))}
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

        <CorrectionNote correction={chart.timeCorrection} />
      </section>

      {chart.daeun && <DaeunTable daeun={chart.daeun} seun={chart.seun} />}

      <section className={`reading ${CARD}`} aria-label="풀이" aria-busy={streaming}>
        {/*
          스트리밍 본문에 aria-live 를 걸면 글자가 늘어날 때마다 전체가 다시 읽혀 소음이 된다.
          본문은 일반 영역으로 두고, 상태 변화만 따로 알린다 (role="status" = polite).
        */}
        <p className="sr-only" role="status">
          {streaming
            ? "풀이를 생성하고 있습니다."
            : reading
              ? "풀이 생성이 끝났습니다."
              : ""}
        </p>

        {reading ? (
          <>
            <Markdown>{reading}</Markdown>
            {streaming && <StreamingCursor />}
          </>
        ) : (
          <p className="text-sm text-ink-muted">풀이를 쓰고 있습니다…</p>
        )}
      </section>

      <p className="text-center text-xs leading-relaxed text-ink-muted">
        이 풀이는 명리학 해석을 참고한 오락·참고용 콘텐츠이며, AI 가 작성했습니다.
        <br />
        의학적·법률적 조언이 아닙니다.{" "}
        <Link href="/disclaimer" className="underline hover:text-brand-ink">
          면책 고지
        </Link>
      </p>
    </div>
  );
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

  /**
   * 대운 8~10칸은 어떤 화면에서도 가로로 넘친다. 현재 대운이 뒤쪽이면 처음엔 보이지 않아
   * "지금 어디쯤인가"를 놓친다 → 열릴 때 현재 칸을 가운데로 당겨 둔다.
   *
   * scrollIntoView 를 쓰지 않는 이유: 세로 스크롤까지 움직여 폼에서 결과로 넘어오는
   * 자동 스크롤과 싸운다. 가로 위치만 직접 계산한다.
   */
  useEffect(() => {
    const scroller = scrollerRef.current;
    const current = currentRef.current;
    if (!scroller || !current) return;
    const offset =
      current.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    const centered = scroller.scrollLeft + offset - (scroller.clientWidth - current.clientWidth) / 2;
    scroller.scrollLeft = Math.max(0, centered);
  }, [daeun]);

  return (
    <section className={CARD}>
      <h2 className="mb-1 text-lg font-bold">대운 · 세운</h2>
      <p className="mb-4 text-sm text-ink-muted">
        {daeun.direction === "forward" ? "순행" : "역행"} · 첫 대운 {daeun.startAge}세부터
        <span className="text-ink-muted"> (절기까지 {daeun.daysToJeol}일 ÷ 3)</span>
      </p>

      {/*
        카드 여백만큼 밖으로 늘려 화면 끝까지 스크롤되게 한다 (모바일 p-5, 데스크톱 p-6).
        overscroll-x-contain: 끝까지 밀었을 때 iOS 의 뒤로가기 스와이프로 넘어가지 않게 막는다.
      */}
      <div
        ref={scrollerRef}
        className="-mx-5 overflow-x-auto overscroll-x-contain px-5 sm:-mx-6 sm:px-6"
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
    </section>
  );
}

/** 어떤 보정을 적용해 이 원국이 나왔는지 근거를 밝힌다. */
function CorrectionNote({ correction }: { correction: TimeCorrectionInfo }) {
  // 시각 미상이면 보정 자체를 하지 않으므로 알릴 것이 없다.
  if (correction.appliedTime === null) return null;

  const notes: string[] = [];

  if (correction.appliedTime && correction.correctionMinutes !== 0) {
    const sign = correction.correctionMinutes < 0 ? "−" : "+";
    notes.push(
      `출생시각 ${sign}${Math.abs(correction.correctionMinutes)}분 보정 → ${correction.appliedTime} 기준`,
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
