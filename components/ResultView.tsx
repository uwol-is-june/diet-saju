"use client";

import Markdown from "react-markdown";
import type { Pillar, SajuChart, TimeCorrectionInfo } from "@/lib/saju/schema";

const OHAENG_COLOR: Record<string, string> = {
  목: "bg-emerald-100 text-emerald-800",
  화: "bg-red-100 text-red-800",
  토: "bg-amber-100 text-amber-800",
  금: "bg-slate-200 text-slate-800",
  수: "bg-sky-100 text-sky-800",
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
      <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">사주 원국</h2>
        <p className="mb-4 text-sm text-stone-500">
          양력 {chart.solarDate} · 음력 {chart.lunarDate} · {chart.saencho}띠
        </p>

        <div className="grid grid-cols-4 gap-2">
          {pillars.map(({ label, pillar }) => (
            <div
              key={label}
              className="rounded-xl bg-stone-50 p-3 text-center"
            >
              <div className="mb-1 text-xs text-stone-400">{label}</div>
              {pillar ? (
                <>
                  <div className="text-xl font-bold tracking-tight">{pillar.ganji}</div>
                  <div className="mt-1 text-xs text-stone-500">{pillar.sipsin}</div>
                  <div className="text-xs text-stone-400">{pillar.jiSipsin}</div>
                </>
              ) : (
                <div className="py-2 text-xs text-stone-400">시각 미상</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(chart.ohaeng.count).map(([element, count]) => (
            <span
              key={element}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                OHAENG_COLOR[element] ?? "bg-stone-100 text-stone-700"
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

        <p className="mt-3 text-sm text-stone-600">
          {chart.ohaeng.season}에 태어나 <strong>{chart.ohaeng.strongest}</strong> 기운이 가장
          강하고, 신강·신약은 <strong>{chart.strength.verdict}</strong>입니다
          <span className="text-stone-400">
            {" "}
            (득령 {chart.strength.deukryeong ? "○" : "×"} · 득지{" "}
            {chart.strength.deukji ? "○" : "×"} · 득세 {chart.strength.deukse ? "○" : "×"})
          </span>
        </p>

        <CorrectionNote correction={chart.timeCorrection} />
      </section>

      {chart.daeun && <DaeunTable daeun={chart.daeun} seun={chart.seun} />}

      <section
        className="reading rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
        aria-busy={streaming}
        aria-live="polite"
      >
        {reading ? (
          <>
            <Markdown>{reading}</Markdown>
            {streaming && <StreamingCursor />}
          </>
        ) : (
          <p className="text-sm text-stone-400">풀이를 쓰고 있습니다…</p>
        )}
      </section>

      <p className="text-center text-xs text-stone-400">
        이 풀이는 명리학 해석을 참고한 콘텐츠입니다. 의학적·법률적 조언이 아닙니다.
      </p>
    </div>
  );
}

/** 생성 중임을 알리는 커서. 텍스트가 멈춰 있어도 살아 있다는 신호가 된다. */
function StreamingCursor() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-violet-500 align-middle"
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
    <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold">대운 · 세운</h2>
      <p className="mb-4 text-sm text-stone-500">
        {daeun.direction === "forward" ? "순행" : "역행"} · 첫 대운 {daeun.startAge}세부터
        <span className="text-stone-400"> (절기까지 {daeun.daysToJeol}일 ÷ 3)</span>
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
                  isCurrent ? "bg-violet-50 ring-1 ring-violet-300" : "bg-stone-50"
                }`}
              >
                <div className="text-xs text-stone-400">{period.startAge}세</div>
                <div className="text-base font-bold">{period.ganji}</div>
                <div className="mt-0.5 text-[11px] text-stone-500">{period.sipsin}</div>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-sm text-stone-600">
        {seun.map((year) => (
          <li key={year.year}>
            <span className="text-stone-400">{year.year}년 ({year.age}세)</span>{" "}
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
    <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
      {notes.map((note) => (
        <li key={note}>· {note}</li>
      ))}
    </ul>
  );
}
