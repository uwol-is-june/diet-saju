"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  birthplaceApplies,
  birthplaceLongitude,
  canSubmit,
  describeBirthInput,
  describeBirthplace,
  hasIncompleteTime,
  placesInSido,
  type BirthInput,
} from "@/lib/form/birth-input";
import { composeBirthTime, HOUR_OPTIONS, MINUTE_OPTIONS } from "@/lib/form/birth-time";
import { BIRTHPLACE_SIDO } from "@/lib/form/birthplaces";
import type { ReadingType, SajuChart, SajuStreamEvent } from "@/lib/saju/schema";
import { useBirthInput } from "./BirthInputProvider";
import { LikeButton } from "./LikeButton";
import { OtherReadingLinks } from "./OtherReadingLinks";
import { ResultView } from "./ResultView";

/**
 * 입력 폼. 여기서는 절대 LLM 을 직접 호출하지 않는다.
 * 모든 호출은 /api/saju 를 경유하며, API 키는 서버에만 존재한다.
 *
 * ## 유형은 라우트가 정한다 (TASK-30)
 *
 * `readingType` 은 **prop 으로만** 들어온다. 폼 안에 유형 선택 컨트롤을 두지 않는다 —
 * 두 곳에서 고를 수 있으면 반드시 어긋난다. 라우트가 유형을 정하므로 생성 중에 바뀔 수도
 * 없고, 그래서 `resultType`(요청 시점의 유형을 따로 붙들던 상태)도 필요 없다.
 *
 * ## 입력값은 프로바이더에 있다
 *
 * 로컬 `useState` 가 아니라 `useBirthInput()` 을 읽고 쓴다. 루트 레이아웃에 얹혀 있어
 * 유형을 옮겨도 값이 남는다. 저장소·URL 로 옮기면 안 되는 이유는 그쪽 주석에 있다.
 */
export function SajuForm({ readingType }: { readingType: ReadingType }) {
  const { input, update, cacheKey, recall, remember } = useBirthInput();

  /**
   * 이미 받은 풀이 (TASK-60). **렌더 중에 읽어도 되는 값이다** — 프로바이더의 ref 를
   * 들여다보는 것뿐이고 부수효과가 없다.
   */
  const cached = recall(cacheKey(readingType));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<SajuChart | null>(() => cached?.chart ?? null);
  const [reading, setReading] = useState(() => cached?.reading ?? "");
  const [streaming, setStreaming] = useState(false);
  /** 응답으로 원국이 도착한 횟수. 자동 스크롤이 이 값에 걸린다 (아래 주석 참고). */
  const [arrivedCount, setArrivedCount] = useState(0);
  /**
   * 값이 이미 있으면 폼을 접고 요약 한 줄만 보여준다. 유형만 바꿔 다시 받는 것이
   * 두 번 클릭이어야 하므로 **접힌 상태에서 바로 제출할 수 있어야 한다.**
   * 첫 방문은 값이 없으므로 펼친 폼 그대로다.
   *
   * 제출할 수 없는 값이면 접지 않는다 — 접으면 왜 버튼이 꺼져 있는지 볼 수 없다.
   */
  const [editing, setEditing] = useState(() => !canSubmit(input));
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  /**
   * 유형이 바뀌었는데 이 컴포넌트가 살아 있으면 화면이 **옛 유형의 결과**를 들고 있게 된다.
   * 지금은 라우트가 바뀔 때 언마운트되지만, 그 사실에 정확성을 기대지 않는다.
   * 렌더 중 상태 조정은 React 가 권하는 "prop 이 바뀔 때 state 맞추기" 방식이다 —
   * 효과로 하면 옛 결과가 한 번 그려진 뒤에 바뀐다.
   */
  const [shownType, setShownType] = useState(readingType);
  if (shownType !== readingType) {
    setShownType(readingType);
    setChart(cached?.chart ?? null);
    setReading(cached?.reading ?? "");
    setError(null);
    setStreaming(false);
    setLoading(false);
  }

  // 입력마다 고유 id 를 만들어 label 과 명시적으로 연결한다.
  // (label 로 감싸는 방식은 윤달 체크박스처럼 안에 또 label 이 들어갈 때 무효 HTML 이 된다)
  const id = useId();
  const fieldId = (key: string) => `${id}-${key}`;

  function set<K extends keyof BirthInput>(key: K) {
    return (value: BirthInput[K]) => update({ [key]: value } as Partial<BirthInput>);
  }

  const timeIncomplete = hasIncompleteTime(input);
  const birthTime = composeBirthTime(input.birthHour, input.birthMinute);
  const submittable = canSubmit(input);
  const placeApplies = birthplaceApplies(input);
  const placesInChosenSido = placesInSido(input.birthplaceSido);

  /**
   * 시/도를 바꾸면 시/군을 비운다 — 그러지 않으면 `강원 + 기장군` 같은 조합이 남고
   * 표에 없는 조합이라 경도가 조용히 서울 기본값으로 돌아간다.
   * 시/군이 하나뿐인 광역시는 바로 채워 준다 (선택지가 하나인 드롭다운을 누르게 하지 않는다).
   */
  function chooseSido(sido: string) {
    const places = placesInSido(sido);
    update({
      birthplaceSido: sido,
      birthplaceName: places.length === 1 ? places[0]!.name : "",
    });
  }

  /**
   * 원국은 폼 아래에 그려지는데, 폼이 길어 모바일에서는 화면 밖이다.
   * 그대로 두면 스트리밍이 시작돼도 "아무 일도 안 일어난" 것처럼 보인다.
   *
   * **`chart` 가 아니라 `arrivedCount` 에 건다** (TASK-60). `chart` 에 걸면 캐시로 채운
   * 경우에도 돌아서, 링크를 눌러 막 들어온 사람(이미 맨 위에 있다)의 화면이 튄다.
   * 이 값은 **응답으로 원국이 도착할 때만** 올라가므로 캐시 적중은 세지 않는다.
   */
  useEffect(() => {
    if (arrivedCount === 0) return;
    const target = resultRef.current;
    if (!target) return;
    // `behavior: "smooth"` 를 명시하면 CSS scroll-behavior 가 무시되므로 여기서 판단한다.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [arrivedCount]);

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
    // 결과가 나오면 폼은 접어 둔다 — 다시 볼 것은 풀이이지 입력이 아니다.
    setEditing(false);

    const controller = new AbortController();
    abortRef.current = controller;

    /**
     * 캐시에 담을지 판단하려면 **스트림이 끝난 뒤에** 원국·풀이·완료 여부를 함께 봐야 하는데,
     * state 는 이 함수 안에서 최신값을 볼 수 없다. 그래서 지역 변수로 같이 모은다.
     * 키는 **요청 시점**의 것이다 — 도중에 입력이 바뀌면 프로바이더가 이 키를 버린다.
     */
    const requestKey = cacheKey(readingType);
    let receivedChart: SajuChart | null = null;
    let receivedReading = "";
    let finished = false;
    let failed = false;

    try {
      const response = await fetch("/api/saju", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: input.name.trim() || undefined,
          birthDate: input.birthDate,
          birthTime: input.timeUnknown || !birthTime ? undefined : birthTime,
          calendar: input.calendar,
          isLeapMonth: input.calendar === "lunar" ? input.isLeapMonth : false,
          gender: input.gender,
          readingType,
          solarTimeMode: input.solarTimeMode,
          dayBoundary: input.dayBoundary,
          // 쓰이지 않을 값은 보내지 않는다 (시각 미상·보정 없음이면 서버가 버린다).
          longitude: birthplaceLongitude(input),
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
            receivedChart = event.chart;
            setChart(event.chart);
            setArrivedCount((previous) => previous + 1);
            setLoading(false);
            break;
          case "delta":
            receivedReading += event.text;
            setReading((previous) => previous + event.text);
            break;
          case "error":
            failed = true;
            setError(event.error);
            break;
          case "done":
            finished = true;
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

      /**
       * **완료된 것만 담는다** (TASK-60) — `done` 까지 왔고 `error` 이벤트가 없었으며
       * 중단되지 않은 경우. 중간까지 받은 글을 담으면 다음에 **완결된 풀이인 척** 나온다.
       * (중단·네트워크 오류는 여기까지 오지 않고 아래 catch 로 빠진다.)
       */
      if (finished && !failed && receivedChart && receivedReading.length > 0) {
        remember(requestKey, { chart: receivedChart, reading: receivedReading });
      }
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
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="이름 (선택)" htmlFor={fieldId("name")}>
              <input
                id={fieldId("name")}
                type="text"
                value={input.name}
                onChange={(e) => set("name")(e.target.value)}
                maxLength={20}
                placeholder="비워두면 호칭 없이 씁니다"
                className={inputClass}
              />
            </Field>

            <Field label="성별" htmlFor={fieldId("gender")}>
              <SelectShell>
                <select
                  id={fieldId("gender")}
                  value={input.gender}
                  onChange={(e) => set("gender")(e.target.value as BirthInput["gender"])}
                  className={inputClass}
                >
                  <option value="unspecified">선택 안 함</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
              </SelectShell>
            </Field>

            <Field label="생년월일" htmlFor={fieldId("birth-date")}>
              <input
                id={fieldId("birth-date")}
                type="date"
                required
                value={input.birthDate}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => set("birthDate")(e.target.value)}
                className={nativeDateClass(input.birthDate)}
              />
            </Field>

            <Field label="양력 / 음력" htmlFor={fieldId("calendar")}>
              <SelectShell>
                <select
                  id={fieldId("calendar")}
                  value={input.calendar}
                  onChange={(e) => set("calendar")(e.target.value as BirthInput["calendar"])}
                  className={inputClass}
                >
                  <option value="solar">양력</option>
                  <option value="lunar">음력</option>
                </select>
              </SelectShell>
            </Field>

            {/* 윤달 체크박스는 **전체 폭 행**으로 내린다 (TASK-22).
                `양력/음력` 칸 안에 두면 그 행이 44px 높아지고, 짝인 `생년월일` 칸이 함께
                늘어나 입력 밑에 52px 빈칸이 생긴다 (그리드 행은 형제 칸까지 잡아당긴다).
                `sm:col-start-2` 로 오른쪽 열에만 두어도 왼쪽에 같은 크기의 공백이 남으므로
                보이는 결과가 같다 — 폭을 다 쓰는 것이 유일한 해법이다. */}
            {input.calendar === "lunar" && (
              <div className="sm:col-span-2">
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={input.isLeapMonth}
                    onChange={(e) => set("isLeapMonth")(e.target.checked)}
                    className={checkboxClass}
                  />
                  윤달입니다
                </label>
              </div>
            )}

            {/* 시각도 같은 이유로 전체 폭 행이다. `시각을 모릅니다` 를 짝 칸에 두면 그 칸에는
                라벨이 없어 오른쪽 위가 뚫려 보이고, 시각 칸 안에 넣으면 위와 같은 빈칸이
                생긴다. 안쪽 그리드가 바깥과 같은 `gap-4` 2열이라 시각 컨트롤의 폭·좌우
                위치가 바로 위 `생년월일` 과 정확히 맞는다.

                드롭다운 두 개는 각각 라벨이 필요하므로 `fieldset`/`legend` 로 묶는다
                (`legend` 하나가 두 컨트롤을 아우르고, 개별 구분은 `aria-label` 이 한다).
                `min-w-0` 은 fieldset 이 내용보다 좁아지지 못하는 기본 동작을 푼다. */}
            <fieldset className="min-w-0 sm:col-span-2">
              <legend className={labelClass}>태어난 시각</legend>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <SelectShell>
                    <select
                      id={fieldId("birth-hour")}
                      aria-label="태어난 시"
                      value={input.birthHour}
                      disabled={input.timeUnknown}
                      onChange={(e) => set("birthHour")(e.target.value)}
                      className={selectTimeClass(input.birthHour)}
                    >
                      <option value="">시 선택</option>
                      {HOUR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SelectShell>
                  <SelectShell>
                    <select
                      id={fieldId("birth-minute")}
                      aria-label="태어난 분"
                      value={input.birthMinute}
                      disabled={input.timeUnknown}
                      onChange={(e) => set("birthMinute")(e.target.value)}
                      className={selectTimeClass(input.birthMinute)}
                    >
                      <option value="">분 선택</option>
                      {MINUTE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SelectShell>
                </div>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={input.timeUnknown}
                    onChange={(e) => set("timeUnknown")(e.target.checked)}
                    className={checkboxClass}
                  />
                  시각을 모릅니다 (시주 제외)
                </label>
              </div>
              {timeIncomplete ? (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  시와 분을 모두 골라 주세요. 시각을 모르면 옆의 체크박스를 눌러 주세요.
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-ink-muted">
                  분까지 고를수록 정확합니다. 경도 보정(약 −32분) 때문에 시주(時柱) 경계가
                  정시가 아닌 시각에 놓입니다.
                </p>
              )}
            </fieldset>

            {/* 출생지 (TASK-37). 시각 fieldset 과 같은 이유로 전체 폭 2열이다 —
                시/도와 시/군 드롭다운 폭이 바로 위 시·분과 맞는다.
                경도 보정이 쓰이지 않는 상태(시각 미상·보정 없음)에서는 잠근다.
                고를 수 있게 두면 반영되는 줄 안다. */}
            <fieldset className="min-w-0 sm:col-span-2" disabled={!placeApplies}>
              <legend className={labelClass}>태어난 지역 (선택)</legend>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <SelectShell>
                  <select
                    id={fieldId("birthplace-sido")}
                    aria-label="태어난 시/도"
                    value={input.birthplaceSido}
                    onChange={(e) => chooseSido(e.target.value)}
                    className={selectTimeClass(input.birthplaceSido)}
                  >
                    <option value="">시/도 선택</option>
                    {BIRTHPLACE_SIDO.map((sido) => (
                      <option key={sido} value={sido}>
                        {sido}
                      </option>
                    ))}
                  </select>
                </SelectShell>
                {/*
                  고를 것이 둘 이상일 때만 낸다 (TASK-38). 시/도를 고르기 전이거나
                  시/군이 하나뿐인 시/도(서울·광주·대전·세종)에서는 `chooseSido` 가 이미
                  값을 채우므로, 누를 이유가 없는 컨트롤이 자리만 차지한다.
                  **하나뿐인 시/도 목록을 하드코딩하지 않는다** — 표는 자동 생성이라
                  다음 갱신에서 개수가 바뀔 수 있다. 파생값으로 판정한다.
                  남은 한 칸은 왼쪽에 그대로 둔다 — 전체 폭으로 늘리면 바로 위 시·분
                  드롭다운과 밑선이 어긋난다.
                */}
                {placesInChosenSido.length > 1 && (
                  <SelectShell>
                    <select
                      id={fieldId("birthplace-name")}
                      aria-label="태어난 시/군"
                      value={input.birthplaceName}
                      onChange={(e) => set("birthplaceName")(e.target.value)}
                      className={selectTimeClass(input.birthplaceName)}
                    >
                      <option value="">시/군 선택</option>
                      {placesInChosenSido.map((place) => (
                        <option key={place.name} value={place.name}>
                          {place.name}
                        </option>
                      ))}
                    </select>
                  </SelectShell>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                {!placeApplies
                  ? "출생시각을 모르거나 시각 보정을 끄면 지역이 결과에 반영되지 않습니다."
                  : "고르지 않으면 서울 기준으로 계산합니다. 서울에서 멀수록 시주(時柱)가 달라질 수 있습니다 (부산 약 8분 차이)."}
              </p>
            </fieldset>
          </div>
        ) : (
          /* 접힌 상태 — 요약 한 줄 + "수정". 여기서 바로 제출할 수 있다. */
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              <span className="mr-2 text-xs text-ink-muted">입력한 정보</span>
              <strong className="font-medium">{describeBirthInput(input)}</strong>
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-11 rounded-full border border-line-strong px-4 text-sm text-ink-soft transition hover:border-brand"
            >
              수정
            </button>
          </div>
        )}

        {editing && (
          <details className="rounded-xl border border-line-strong bg-surface-muted px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-soft">
              만세력 고급 설정
            </summary>
            <div className="mt-4 space-y-4">
              <Field label="출생시각 보정" htmlFor={fieldId("solar-time")}>
                <SelectShell>
                  <select
                    id={fieldId("solar-time")}
                    value={input.solarTimeMode}
                    onChange={(e) =>
                      set("solarTimeMode")(e.target.value as BirthInput["solarTimeMode"])
                    }
                    aria-describedby={fieldId("solar-time-hint")}
                    className={inputClass}
                  >
                    <option value="longitude">경도 보정 (권장 · 한국 만세력 관행)</option>
                    <option value="true">진태양시 (경도 + 균시차)</option>
                    <option value="standard">보정 없음 (시계시 그대로)</option>
                  </select>
                </SelectShell>
                <p id={fieldId("solar-time-hint")} className="mt-1.5 text-xs text-ink-muted">
                  한국 표준시는 동경 135° 기준이라 서울(127°)의 실제 태양시보다 약 32분
                  빠릅니다. 서머타임·표준시 변경 시기는 자동으로 함께 보정됩니다.
                </p>
              </Field>

              <Field label="자시(子時) 기준" htmlFor={fieldId("day-boundary")}>
                <SelectShell>
                  <select
                    id={fieldId("day-boundary")}
                    value={input.dayBoundary}
                    onChange={(e) => set("dayBoundary")(e.target.value as BirthInput["dayBoundary"])}
                    aria-describedby={fieldId("day-boundary-hint")}
                    className={inputClass}
                  >
                    <option value="yajasi">야자시·조자시 구분 (권장 · 자정에 날짜 변경)</option>
                    <option value="jasi">자시파 (23시부터 다음날)</option>
                  </select>
                </SelectShell>
                <p id={fieldId("day-boundary-hint")} className="mt-1.5 text-xs text-ink-muted">
                  23:00~23:59(오후 11시대) 출생자의 일주(日柱)를 어느 날로 볼지에 대한 학파
                  차이입니다. 그 시간대가 아니면 결과가 같습니다.
                </p>
              </Field>
            </div>
          </details>
        )}

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
            disabled={loading || !submittable}
            aria-busy={loading}
            className="w-full rounded-xl bg-brand-solid px-4 py-3.5 font-semibold text-on-brand-solid transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:bg-brand-solid-disabled disabled:text-on-brand-solid-disabled"
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

        {chart && (
          <>
            <ResultView
              chart={chart}
              reading={reading}
              readingType={readingType}
              streaming={streaming}
              /* 지역 **이름**은 서버로 보내지 않는다 — 계산에 필요한 것은 경도뿐이다.
                 화면 표시는 폼이 들고 있는 값으로 한다. */
              birthplace={placeApplies ? describeBirthplace(input) : null}
            />
            {/* 생성이 끝난 뒤에만 낸다 — 스트리밍 중에 다른 유형으로 유도하거나 평가를
                요구하면 지금 쓰이고 있는 글을 끊는다 (TASK-51 도 같은 이유로 여기 있다). */}
            {!streaming && (
              <>
                <LikeButton type={readingType} />
                <OtherReadingLinks current={readingType} />
              </>
            )}
          </>
        )}
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
const inputBaseClass =
  "min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-base transition placeholder:text-ink-placeholder focus:border-brand-hover sm:text-sm";

const inputClass = `${inputBaseClass} text-ink`;

/**
 * `type="date"` 는 iOS 기본 스타일이 폭을 줄이고 안쪽 여백을 제멋대로 넣는다.
 *
 * 글자색을 **여기서 정하지 않는** 이유: native date 는 값이 없을 때 `연도-월-일` 을
 * 본문 색으로 그려서, 옆 칸의 `placeholder:text-ink-placeholder` 와 톤이 어긋나
 * 미완성처럼 보인다 (TASK-22). 비어 있는 동안만 자리표시자 색으로 낮추는데,
 * `text-ink` 를 미리 붙여 두면 두 유틸리티가 같은 레이어에서 겹쳐 승자가 CSS 출력
 * 순서에 달리게 된다. 자리표시자 문자열 자체는 브라우저·로케일이 정하므로 못 바꾼다.
 */
const nativeDateClass = (value: string) =>
  `${inputBaseClass} appearance-none ${value ? "text-ink" : "text-ink-placeholder"}`;

/** 시·분 드롭다운. 아직 안 고른 상태의 `시 선택` 은 자리표시자 톤으로 낮춘다. */
const selectTimeClass = (value: string) =>
  `${inputBaseClass} ${value ? "text-ink" : "text-ink-placeholder"}` +
  " disabled:bg-surface-inset disabled:text-ink-muted";


/**
 * 드롭다운 화살표를 직접 그리기 위한 껍데기 (TASK-38).
 *
 * **`select` 에는 `::after` 를 붙일 수 없어서** 감싸는 요소가 필요하다. 모양과 색은
 * `globals.css` 의 `.select-shell` 이 정한다 — 색을 이 파일에 적으면
 * `lib/design/tokens.test.ts` 의 raw 색상 검사에 걸린다.
 *
 * **폼의 모든 `select` 가 이걸 쓴다.** 하나만 빠지면 그 칸만 브라우저 기본 화살표가 남아
 * 폼 안에 화살표가 두 종류가 된다 (실제로 넷만 감쌌을 때 그렇게 됐다).
 * `lib/form/birth-input.test.ts` 가 `<select` 개수와 껍데기 개수를 대조한다.
 */
function SelectShell({ children }: { children: React.ReactNode }) {
  return <span className="select-shell">{children}</span>;
}

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
