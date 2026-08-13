"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  READING_TYPE_LABEL,
  READING_TYPES,
  type ReadingType,
  type SajuChart,
  type SajuStreamEvent,
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
  const [chart, setChart] = useState<SajuChart | null>(null);
  const [reading, setReading] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 입력마다 고유 id 를 만들어 label 과 명시적으로 연결한다.
  // (label 로 감싸는 방식은 윤달 체크박스처럼 안에 또 label 이 들어갈 때 무효 HTML 이 된다)
  const id = useId();
  const fieldId = (key: string) => `${id}-${key}`;

  /**
   * 원국은 폼 아래에 그려지는데, 폼이 길어 모바일에서는 화면 밖이다.
   * 그대로 두면 스트리밍이 시작돼도 "아무 일도 안 일어난" 것처럼 보인다.
   * chart 는 요청당 한 번만 바뀌므로 이 효과도 결과당 한 번만 돈다.
   */
  useEffect(() => {
    if (!chart) return;
    const target = resultRef.current;
    if (!target) return;
    // `behavior: "smooth"` 를 명시하면 CSS scroll-behavior 가 무시되므로 여기서 판단한다.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [chart]);

  function stop() {
    abortRef.current?.abort();
  }

  /**
   * 응답은 NDJSON 스트림이다. 원국(chart)이 먼저 오고 풀이가 조각(delta)으로 이어진다.
   * 스트림이 시작된 뒤의 실패는 error 이벤트로 오며, 그때까지 받은 풀이는 그대로 둔다.
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setChart(null);
    setReading("");
    setLoading(true);
    setStreaming(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/saju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
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

      // 스트림 시작 전 실패는 일반 JSON + 상태 코드로 온다.
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "요청에 실패했습니다.");
        return;
      }
      if (!response.body) {
        setError("응답을 읽을 수 없습니다.");
        return;
      }

      setStreaming(true);
      const decoder = new TextDecoder();
      const readerStream = response.body.getReader();
      let buffer = "";

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let event: SajuStreamEvent;
        try {
          event = JSON.parse(line) as SajuStreamEvent;
        } catch {
          return; // 잘린 줄은 버린다 (버퍼가 다음 조각에서 이어 붙는다)
        }
        switch (event.type) {
          case "chart":
            setChart(event.chart);
            setLoading(false);
            break;
          case "delta":
            setReading((previous) => previous + event.text);
            break;
          case "error":
            setError(event.error);
            break;
          case "done":
            break;
        }
      };

      while (true) {
        const { done, value } = await readerStream.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 마지막 조각은 아직 완성되지 않았을 수 있다
        for (const line of lines) handleLine(line);
      }
      if (buffer.trim()) handleLine(buffer);
    } catch (caught) {
      // 사용자가 중단한 경우는 오류가 아니다.
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError("네트워크 오류가 발생했습니다. 연결을 확인해 주세요.");
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이름 (선택)" htmlFor={fieldId("name")}>
            <input
              id={fieldId("name")}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="비워두면 '고객님'"
              className={inputClass}
            />
          </Field>

          <Field label="성별" htmlFor={fieldId("gender")}>
            <select
              id={fieldId("gender")}
              value={gender}
              onChange={(e) => setGender(e.target.value as typeof gender)}
              className={inputClass}
            >
              <option value="unspecified">선택 안 함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </Field>

          <Field label="생년월일" htmlFor={fieldId("birth-date")}>
            <input
              id={fieldId("birth-date")}
              type="date"
              required
              value={birthDate}
              min="1900-01-01"
              max="2100-12-31"
              onChange={(e) => setBirthDate(e.target.value)}
              className={dateInputClass}
            />
          </Field>

          <Field label="양력 / 음력" htmlFor={fieldId("calendar")}>
            <select
              id={fieldId("calendar")}
              value={calendar}
              onChange={(e) => setCalendar(e.target.value as typeof calendar)}
              className={inputClass}
            >
              <option value="solar">양력</option>
              <option value="lunar">음력</option>
            </select>
            {calendar === "lunar" && (
              <label className={`${checkboxLabelClass} mt-2`}>
                <input
                  type="checkbox"
                  checked={isLeapMonth}
                  onChange={(e) => setIsLeapMonth(e.target.checked)}
                  className={checkboxClass}
                />
                윤달입니다
              </label>
            )}
          </Field>

          <Field label="태어난 시각" htmlFor={fieldId("birth-time")}>
            <input
              id={fieldId("birth-time")}
              type="time"
              value={birthTime}
              disabled={timeUnknown}
              onChange={(e) => setBirthTime(e.target.value)}
              className={`${dateInputClass} disabled:bg-surface-inset disabled:text-ink-muted`}
            />
          </Field>

          {/* 데스크톱(2열)에서는 옆 칸 입력과 밑선을 맞추고, 모바일에서는 그냥 이어 붙인다. */}
          <div className="flex items-center sm:items-end">
            <label className={`${checkboxLabelClass} sm:pb-2.5`}>
              <input
                type="checkbox"
                checked={timeUnknown}
                onChange={(e) => setTimeUnknown(e.target.checked)}
                className={checkboxClass}
              />
              시각을 모릅니다 (시주 제외)
            </label>
          </div>
        </div>

        {/* 버튼 묶음은 label 로 감쌀 수 없다 (label 은 컨트롤 하나를 가리킨다) → fieldset/legend */}
        <fieldset>
          <legend className={labelClass}>풀이 유형</legend>
          <div className="flex flex-wrap gap-2">
            {READING_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={readingType === type}
                onClick={() => setReadingType(type)}
                className={`min-h-11 rounded-full border px-4 py-2 text-sm transition ${
                  readingType === type
                    ? "border-brand bg-brand-subtle font-medium text-brand-ink"
                    : "border-line-strong text-ink-soft hover:border-brand"
                }`}
              >
                {READING_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <details className="rounded-xl border border-line-strong bg-surface-muted px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">
            만세력 고급 설정
          </summary>
          <div className="mt-4 space-y-4">
            <Field label="출생시각 보정" htmlFor={fieldId("solar-time")}>
              <select
                id={fieldId("solar-time")}
                value={solarTimeMode}
                onChange={(e) => setSolarTimeMode(e.target.value as typeof solarTimeMode)}
                aria-describedby={fieldId("solar-time-hint")}
                className={inputClass}
              >
                <option value="longitude">경도 보정 (권장 · 한국 만세력 관행)</option>
                <option value="true">진태양시 (경도 + 균시차)</option>
                <option value="standard">보정 없음 (시계시 그대로)</option>
              </select>
              <p id={fieldId("solar-time-hint")} className="mt-1.5 text-xs text-ink-muted">
                한국 표준시는 동경 135° 기준이라 서울(127°)의 실제 태양시보다 약 32분 빠릅니다.
                서머타임·표준시 변경 시기는 자동으로 함께 보정됩니다.
              </p>
            </Field>

            <Field label="자시(子時) 기준" htmlFor={fieldId("day-boundary")}>
              <select
                id={fieldId("day-boundary")}
                value={dayBoundary}
                onChange={(e) => setDayBoundary(e.target.value as typeof dayBoundary)}
                aria-describedby={fieldId("day-boundary-hint")}
                className={inputClass}
              >
                <option value="yajasi">야자시·조자시 구분 (권장 · 자정에 날짜 변경)</option>
                <option value="jasi">자시파 (23시부터 다음날)</option>
              </select>
              <p id={fieldId("day-boundary-hint")} className="mt-1.5 text-xs text-ink-muted">
                23:00~23:59 출생자의 일주(日柱)를 어느 날로 볼지에 대한 학파 차이입니다.
                그 시간대가 아니면 결과가 같습니다.
              </p>
            </Field>
          </div>
        </details>

        {streaming ? (
          <button
            type="button"
            onClick={stop}
            className="w-full rounded-xl border border-line-strong px-4 py-3.5 font-semibold text-ink-soft transition hover:bg-surface-inset"
          >
            생성 중단
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !birthDate}
            aria-busy={loading}
            className="w-full rounded-xl bg-brand px-4 py-3.5 font-semibold text-on-brand transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-line-strong"
          >
            {loading ? "사주를 계산하고 있습니다…" : "사주 풀이 받기"}
          </button>
        )}

        <p className="text-center text-xs text-ink-muted">
          입력한 정보는 저장하지 않고, 풀이 생성에만 사용됩니다.
        </p>
      </form>

      {/* 자동 스크롤이 겨냥하는 지점. scroll-mt 만큼 위를 띄워 카드가 화면에 붙지 않게 한다. */}
      <div ref={resultRef} className="scroll-mt-4 space-y-8">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger-ink"
          >
            {error}
            {reading && (
              <p className="mt-1 text-xs text-danger-ink">
                아래 풀이는 중단 전까지 생성된 부분입니다.
              </p>
            )}
          </div>
        )}

        {chart && <ResultView chart={chart} reading={reading} streaming={streaming} />}
      </div>
    </div>
  );
}

/**
 * `text-base sm:text-sm` 인 이유: iOS Safari 는 글자 크기가 16px 미만인 입력에 포커스가
 * 가면 화면을 확대한다. 확대되면 되돌아오지 않아 이후 입력이 전부 불편해진다.
 * 데스크톱에서는 14px 로 되돌린다.
 *
 * `min-h-11`(44px)은 터치 타깃 최소 크기다. date/time 입력은 iOS 에서 기본 높이가
 * 제각각이라 이 값이 없으면 옆 칸(select)과 밑선이 어긋난다.
 */
const inputClass =
  "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-base text-ink transition placeholder:text-ink-placeholder focus:border-brand-hover sm:text-sm";

/** date/time 은 iOS 기본 스타일이 폭을 줄이고 안쪽 여백을 제멋대로 넣는다. */
const dateInputClass = `${inputClass} appearance-none`;

const labelClass = "mb-1.5 block text-sm font-medium text-ink-soft";

/** 체크박스는 글상자보다 작아서, 라벨 전체를 44px 높이의 탭 영역으로 만든다. */
const checkboxLabelClass =
  "flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft";
const checkboxClass = "size-5 shrink-0 accent-brand-hover";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}
