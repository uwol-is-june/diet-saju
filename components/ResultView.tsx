"use client";

import Markdown from "react-markdown";
import type { Pillar, SajuReadingResponse } from "@/lib/saju/schema";

const OHAENG_COLOR: Record<string, string> = {
  목: "bg-emerald-100 text-emerald-800",
  화: "bg-red-100 text-red-800",
  토: "bg-amber-100 text-amber-800",
  금: "bg-slate-200 text-slate-800",
  수: "bg-sky-100 text-sky-800",
};

export function ResultView({ result }: { result: SajuReadingResponse }) {
  const { chart, reading } = result;
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
                </>
              ) : (
                <div className="py-2 text-xs text-stone-400">시각 미상</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(chart.ohaengCount).map(([element, count]) => (
            <span
              key={element}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                OHAENG_COLOR[element] ?? "bg-stone-100 text-stone-700"
              } ${count === 0 ? "opacity-40" : ""}`}
            >
              {element} {count}
            </span>
          ))}
        </div>
      </section>

      <section className="reading rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <Markdown>{reading}</Markdown>
      </section>

      <p className="text-center text-xs text-stone-400">
        이 풀이는 명리학 해석을 참고한 콘텐츠입니다. 의학적·법률적 조언이 아닙니다.
      </p>
    </div>
  );
}
