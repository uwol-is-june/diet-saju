"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import type { Pillar, SajuChart, TimeCorrectionInfo } from "@/lib/saju/schema";

const OHAENG_COLOR: Record<string, string> = {
  목: "bg-ohaeng-mok text-ohaeng-mok-ink",
  화: "bg-ohaeng-hwa text-ohaeng-hwa-ink",
  토: "bg-ohaeng-to text-ohaeng-to-ink",
  금: "bg-ohaeng-geum text-ohaeng-geum-ink",
  수: "bg-ohaeng-su text-ohaeng-su-ink",
};

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
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">사주 원국</h2>
        <p className="mb-4 text-sm text-ink-muted">
          양력 {chart.solarDate} · 음력 {chart.lunarDate} · {chart.saencho}띠
        </p>

        <div className="grid grid-cols-4 gap-2">
          {pillars.map(({ label, pillar }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-inset p-3 text-center"
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
            <span
              key={element}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                OHAENG_COLOR[element] ?? "bg-surface-inset text-ink-soft"
              } ${count === 0 ? "opacity-40" : ""}`}
              title={`계절 기세: ${chart.ohaeng.seasonalState[element as keyof typeof chart.ohaeng.seasonalState]}`}
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

      <section
        className="reading rounded-2xl border border-line bg-surface p-6 shadow-sm"
        aria-busy={streaming}
        aria-live="polite"
      >
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

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold">대운 · 세운</h2>
      <p className="mb-4 text-sm text-ink-muted">
        {daeun.direction === "forward" ? "순행" : "역행"} · 첫 대운 {daeun.startAge}세부터
        <span className="text-ink-muted"> (절기까지 {daeun.daysToJeol}일 ÷ 3)</span>
      </p>

      <div className="-mx-6 overflow-x-auto px-6">
        <div className="flex min-w-max gap-2">
          {daeun.periods.map((period) => {
            const isCurrent =
              currentAge !== undefined &&
              currentAge >= period.startAge &&
              currentAge <= period.endAge;
            return (
              <div
                key={period.startAge}
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
