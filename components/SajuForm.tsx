"use client";

import { useState } from "react";
import {
  READING_TYPE_LABEL,
  READING_TYPES,
  type ReadingType,
  type SajuReadingResponse,
} from "@/lib/saju/schema";
import { ResultView } from "./ResultView";

/**
 * 입력 폼. 여기서는 절대 LLM 을 직접 호출하지 않는다.
 * 모든 호출은 /api/saju 를 경유하며, API 키는 서버에만 존재한다.
 */
export function SajuForm() {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "unspecified">("unspecified");
  const [readingType, setReadingType] = useState<ReadingType>("general");
  const [solarTimeMode, setSolarTimeMode] = useState<"standard" | "longitude" | "true">(
    "longitude",
  );
  const [dayBoundary, setDayBoundary] = useState<"yajasi" | "jasi">("yajasi");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SajuReadingResponse | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/saju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          birthDate,
          birthTime: timeUnknown || !birthTime ? undefined : birthTime,
          calendar,
          isLeapMonth: calendar === "lunar" ? isLeapMonth : false,
          gender,
          readingType,
          solarTimeMode,
          dayBoundary,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "요청에 실패했습니다.");
        return;
      }
      setResult(data as SajuReadingResponse);
    } catch {
      setError("네트워크 오류가 발생했습니다. 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이름 (선택)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="비워두면 '고객님'"
              className={inputClass}
            />
          </Field>

          <Field label="성별">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className={inputClass}
            >
              <option value="unspecified">선택 안 함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </Field>

          <Field label="생년월일">
            <input
              type="date"
              required
              value={birthDate}
              min="1900-01-01"
              max="2100-12-31"
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="양력 / 음력">
            <select
              value={calendar}
              onChange={(e) => setCalendar(e.target.value as typeof calendar)}
              className={inputClass}
            >
              <option value="solar">양력</option>
              <option value="lunar">음력</option>
            </select>
            {calendar === "lunar" && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={isLeapMonth}
                  onChange={(e) => setIsLeapMonth(e.target.checked)}
                  className="size-4 accent-violet-600"
                />
                윤달입니다
              </label>
            )}
          </Field>

          <Field label="태어난 시각">
            <input
              type="time"
              value={birthTime}
              disabled={timeUnknown}
              onChange={(e) => setBirthTime(e.target.value)}
              className={`${inputClass} disabled:bg-stone-100 disabled:text-stone-400`}
            />
          </Field>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => setTimeUnknown(e.target.checked)}
                className="size-4 accent-violet-600"
              />
              시각을 모릅니다 (시주 제외)
            </label>
          </div>
        </div>

        <Field label="풀이 유형">
          <div className="flex flex-wrap gap-2">
            {READING_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReadingType(type)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  readingType === type
                    ? "border-violet-600 bg-violet-50 font-medium text-violet-700"
                    : "border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                {READING_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </Field>

        <details className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">
            만세력 고급 설정
          </summary>
          <div className="mt-4 space-y-4">
            <Field label="출생시각 보정">
              <select
                value={solarTimeMode}
                onChange={(e) => setSolarTimeMode(e.target.value as typeof solarTimeMode)}
                className={inputClass}
              >
                <option value="longitude">경도 보정 (권장 · 한국 만세력 관행)</option>
                <option value="true">진태양시 (경도 + 균시차)</option>
                <option value="standard">보정 없음 (시계시 그대로)</option>
              </select>
              <p className="mt-1.5 text-xs text-stone-500">
                한국 표준시는 동경 135° 기준이라 서울(127°)의 실제 태양시보다 약 32분 빠릅니다.
                서머타임·표준시 변경 시기는 자동으로 함께 보정됩니다.
              </p>
            </Field>

            <Field label="자시(子時) 기준">
              <select
                value={dayBoundary}
                onChange={(e) => setDayBoundary(e.target.value as typeof dayBoundary)}
                className={inputClass}
              >
                <option value="yajasi">야자시·조자시 구분 (권장 · 자정에 날짜 변경)</option>
                <option value="jasi">자시파 (23시부터 다음날)</option>
              </select>
              <p className="mt-1.5 text-xs text-stone-500">
                23:00~23:59 출생자의 일주(日柱)를 어느 날로 볼지에 대한 학파 차이입니다.
                그 시간대가 아니면 결과가 같습니다.
              </p>
            </Field>
          </div>
        </details>

        <button
          type="submit"
          disabled={loading || !birthDate}
          className="w-full rounded-xl bg-violet-600 px-4 py-3.5 font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {loading ? "사주를 읽고 있습니다…" : "사주 풀이 받기"}
        </button>

        <p className="text-center text-xs text-stone-400">
          입력한 정보는 저장하지 않고, 풀이 생성에만 사용됩니다.
        </p>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
