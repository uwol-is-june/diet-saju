"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  birthplaceApplies,
  birthplaceLongitude,
  canSubmit,
  missingForType,
  describeBirthInput,
  describeBirthplace,
  hasIncompleteTime,
  placesInSido,
  type BirthInput,
} from "@/lib/form/birth-input";
import { composeBirthTime, HOUR_OPTIONS, MINUTE_OPTIONS } from "@/lib/form/birth-time";
import { BIRTHPLACE_SIDO } from "@/lib/form/birthplaces";
import type { ReadingType, SajuChart, SajuStreamEvent } from "@/lib/saju/schema";
import { Button } from "./ui/Button";
import { ChoiceChips } from "./ui/ChoiceChips";
import { Field, LABEL_CLASS } from "./ui/FormField";
import { SelectShell } from "./ui/SelectShell";
import { FIELD_BASE } from "./ui/field";
import { useBirthInput } from "./BirthInputProvider";
import { OtherReadingLinks } from "./OtherReadingLinks";
import { ResultView } from "./ResultView";

/**
 * 입력 폼. **여기서 LLM 을 직접 호출하지 않는다** — 모든 호출은 `/api/saju` 경유다.
 *
 * `readingType` 은 **prop 으로만** 들어온다. **폼 안에 유형 선택 컨트롤을 두지 않는다** —
 * 두 곳에서 고를 수 있으면 어긋난다.
 *
 * 입력값은 로컬 `useState` 가 아니라 `useBirthInput()` 에 있다 (루트 레이아웃에 얹혀 있어
 * 유형을 옮겨도 값이 남는다). **저장소·URL 로 옮기지 말 것** — 이유는 프로바이더 주석에 있다.
 */
export function SajuForm({ readingType }: { readingType: ReadingType }) {
  const { input, update, cacheKey, recall, remember } = useBirthInput();

  /** 이미 받은 풀이. **렌더 중에 읽어도 되는 값이다** (ref 조회이고 부수효과가 없다). */
  const cached = recall(cacheKey(readingType));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<SajuChart | null>(() => cached?.chart ?? null);
  const [reading, setReading] = useState(() => cached?.reading ?? "");
  const [streaming, setStreaming] = useState(false);
  /** 응답으로 원국이 도착한 횟수. 자동 스크롤이 이 값에 걸린다 (아래 주석 참고). */
  const [arrivedCount, setArrivedCount] = useState(0);
  /**
   * 값이 있으면 폼을 접고 요약 한 줄만 보여준다. **접힌 상태에서 바로 제출할 수 있어야 한다**
   * (유형만 바꿔 다시 받는 것이 두 번 클릭이다).
   *
   * **제출할 수 없는 값이면 접지 않는다** — 접으면 왜 버튼이 꺼져 있는지 볼 수 없다.
   * **유형이 요구하는 것까지 본다** (성별이 빠진 채 들어오면 펼친 채여야 고를 수 있다).
   */
  const [editing, setEditing] = useState(() => !canSubmit(input, readingType));
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  /**
   * 유형이 바뀌었는데 이 컴포넌트가 살아 있으면 화면이 **옛 유형의 결과**를 들고 있게 된다.
   * 라우트 이동으로 언마운트되는 것에 정확성을 기대지 않는다.
   * **효과가 아니라 렌더 중 상태 조정이다** — 효과로 하면 옛 결과가 한 번 그려진 뒤 바뀐다.
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
  /** 유형이 요구하는 것이 빠졌을 때의 이유. 버튼만 꺼 두면 **왜 눌리지 않는지** 알 수 없다. */
  const missing = missingForType(input, readingType);
  const submittable = canSubmit(input, readingType);
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
   * 결과는 폼 아래에 그려지는데 모바일에서는 화면 밖이라, 그대로 두면 스트리밍이 시작돼도
   * "아무 일도 안 일어난" 것처럼 보인다.
   *
   * **`chart` 가 아니라 `arrivedCount` 에 건다.** 이 값은 응답으로 원국이 도착할 때만
   * 올라가므로 캐시 적중은 세지 않는다 — `chart` 로 되돌리면 링크를 눌러 막 들어온
   * 사람(이미 맨 위에 있다)의 화면이 튄다.
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
  /**
   * `event` 가 없는 호출은 결과 화면 `계산 기준` 카드의 **다시 보기**다.
   * **제출 경로는 이 함수 하나여야 한다** — 캐시·스크롤·중단 처리가 두 벌이 되지 않게.
   */
  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
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
       * **완료된 것만 담는다** — `done` 까지 왔고 `error` 이벤트가 없었으며 중단되지 않은
       * 경우. 중간까지 받은 글을 담으면 다음에 **완결된 풀이인 척** 나온다.
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

            {/*
              성별은 **칩 둘**이다 (TASK-85). 선택지가 사실상 둘인데 드롭다운이면 한 번 더
              눌러야 목록이 보인다. **`선택 안 함` 을 세 번째 칩으로 만들지 않는다** —
              둘 다 비선택인 것이 곧 `unspecified` 이고, `BirthInput["gender"]` 값 셋과
              `sajuInputSchema` 는 그대로다 (API 계약이다).
            */}
            <Field label="성별" labelId={fieldId("gender-label")}>
              <ChoiceChips
                labelledBy={fieldId("gender-label")}
                value={input.gender === "unspecified" ? null : input.gender}
                onChange={(gender) => set("gender")(gender)}
                options={GENDER_CHIPS}
              />
              {/*
                **미선택의 대가를 적던 줄은 지웠다** (TASK-98 이 TASK-85 를 되돌린다).
                성별을 안 고르면 `대운 · 세운` 근거 카드와 공유 카드 칩이 빠지는 것은
                그대로이고, 그 줄이 없어져도 **막아야 하는 자리는 그대로 막힌다** —
                `decade` 는 `missingForType` 이 버튼 위에 `role="alert"` 로 이유를 낸다.

                지운 이유는 폼 길이다. 보조 설명 셋(성별·시각·지역)이 컨트롤마다 한 줄씩
                붙어 있었고, 셋 다 **지금 당장 할 일을 말하지 않는 문장**이었다.
                되살리려면 그 값을 어떻게 치를지 먼저 답할 것.
              */}
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

            {/* 양력/음력도 선택지가 둘이라 같은 부품을 쓴다 (TASK-85). 부품을 만든 값이
                두 자리에 쓰이므로 같은 커밋에서 함께 바꾼다. 나머지 드롭다운(시각 보정 ·
                자시 기준)은 라벨이 길어서 칩으로 만들지 않는다. */}
            <Field label="양력 / 음력" labelId={fieldId("calendar-label")}>
              <ChoiceChips
                labelledBy={fieldId("calendar-label")}
                value={input.calendar}
                onChange={(calendar) => set("calendar")(calendar)}
                options={CALENDAR_CHIPS}
              />
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
              <legend className={LABEL_CLASS}>태어난 시각</legend>
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
              {/*
                **제출을 막는 문구만 남긴다** (TASK-98). `분까지 고를수록 정확합니다…`
                는 지웠다 — 분 드롭다운이 이미 1분 단위로 열려 있어 그 문장이 시키는
                일이 따로 없었다. 여기 남은 것은 **반쪽 입력을 막는 알림**이고,
                그쪽은 지우면 왜 버튼이 꺼져 있는지 알 수 없어진다.
              */}
              {timeIncomplete && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  시와 분을 모두 골라 주세요. 시각을 모르면 옆의 체크박스를 눌러 주세요.
                </p>
              )}
            </fieldset>

            {/* 출생지 (TASK-37). 시각 fieldset 과 같은 이유로 전체 폭 2열이다 —
                시/도와 시/군 드롭다운 폭이 바로 위 시·분과 맞는다.
                경도 보정이 쓰이지 않는 상태(시각 미상·보정 없음)에서는 잠근다.
                고를 수 있게 두면 반영되는 줄 안다. */}
            <fieldset className="min-w-0 sm:col-span-2" disabled={!placeApplies}>
              <legend className={LABEL_CLASS}>태어난 지역 (선택)</legend>
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
              {/*
                **컨트롤이 잠긴 이유만 남긴다** (TASK-98). `고르지 않으면 서울 기준으로
                계산합니다…` 는 조용히 적용되는 기본값을 글로 알리던 줄인데,
                `EMPTY_BIRTH_INPUT` 이 **서울로 열리면서** 화면이 그것을 직접 말한다.
                이쪽 가지는 다르다 — 왜 못 누르는지는 컨트롤을 봐서는 알 수 없다.
              */}
              {/*
                **컨트롤이 어디 있는지까지 말한다** (TASK-101). 시각 보정은 이제 이 폼이
                아니라 결과 화면 `계산 기준` 카드에 있어서, 잠긴 이유만 적으면 **어디서
                풀 수 있는지 알 수 없다.** 잠금 자체를 푸는 쪽은 택하지 않았다 —
                고를 수 있게 두면 반영되는 줄 안다 (TASK-37 의 판단).
              */}
              {!placeApplies && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  {input.timeUnknown
                    ? "출생시각을 모르면 보정할 시각이 없어 지역이 결과에 반영되지 않습니다."
                    : "결과 화면 아래 계산 기준에서 시각 보정을 껐기 때문에 지역이 결과에 반영되지 않습니다."}
                </p>
              )}
            </fieldset>
          </div>
        ) : (
          /*
            접힌 상태 — 요약 한 줄 + 연필 아이콘. 여기서 바로 제출할 수 있다.

            **`flex-wrap` 을 쓰지 않는다.** 요약이 줄바꿈해도 버튼은 같은 줄에 남아야
            한다(무엇에 걸린 버튼인지 읽혀야 한다): 글 쪽 `min-w-0` + 버튼 `shrink-0`.
            `min-w-0` 이 없으면 flex 항목의 최소 크기가 내용 폭이라 버튼을 밀어낸다.

            **이름은 `aria-label` 이 만든다** (아이콘은 `aria-hidden` 장식). `수정` 만으로는
            무엇을 수정하는지 알 수 없어 대상까지 적는다.

            `break-keep` 이 없으면 한글이 낱말 가운데서 끊겨 `성별 / 미지정` 이 된다.

            (좋아요 칩 이름을 여기 적지 말 것 — `counters.test.ts` 가 이 파일에서 그
            이름을 찾아 "폼에 좋아요가 되살아났다" 로 읽는다. 주석이라도 걸린다.)
          */
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 break-keep text-sm text-ink-soft">
              <span className="mr-2 text-xs text-ink-muted">입력한 정보</span>
              <strong className="font-medium">{describeBirthInput(input)}</strong>
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label="입력한 정보 수정"
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
            </Button>
          </div>
        )}


        {streaming ? (
          <Button type="button" variant="outline" className="w-full" onClick={stop}>
            생성 중단
          </Button>
        ) : (
          /* 모양·색·비활성 처리는 전부 `components/ui/Button.tsx` 가 정한다. */
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !submittable}
            aria-busy={loading}
          >
            {loading ? "사주를 계산하고 있습니다…" : "사주 풀이 받기"}
          </Button>
        )}

        {/*
          유형이 요구하는 것이 빠졌으면 그 이유를 버튼 바로 위에 둔다 (TASK-45).
          접힌 폼에서도 보이도록 `editing` 밖에 있다 — 접힌 채로 유형만 바꿔 들어오는 것이
          기본 동선이라, 접혀 있을 때 이유가 안 보이면 버튼이 그냥 고장 난 것처럼 읽힌다.
        */}
        {missing && (
          <p role="alert" className="text-center text-xs text-danger-ink">
            {missing}
          </p>
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
              /* 계산 기준 카드가 값을 바꾼 뒤 같은 제출 경로로 다시 요청한다 (TASK-101). */
              onReapply={() => void handleSubmit()}
              busy={loading}
            />
            {/*
                생성이 끝난 뒤에만 낸다 — 스트리밍 중에 다른 유형으로 유도하면 지금
                쓰이고 있는 글을 끊는다.

                **좋아요는 `ResultView` 로 옮겼다** (TASK-81). 방금 읽은 글에 대한 반응이라
                근거 카드 셋 뒤가 아니라 공유 바로 위가 제자리다. 여기 남은 것은 **다 본
                뒤에 다른 유형으로 보내는 동선**뿐이고, 그건 화면 맨 아래가 맞다.
            */}
            {!streaming && <OtherReadingLinks current={readingType} />}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 입력 규격은 **`components/ui/field.ts` 가 단일 소스**다. 높이·radius·여백을 여기 적으면
 * 버튼과 두 벌이 되어 폼 안에서 모서리가 어긋난다.
 */
const inputBaseClass = FIELD_BASE;

const inputClass = `${inputBaseClass} text-ink`;

/**
 * `type="date"` 는 iOS 기본 스타일이 폭을 줄이고 안쪽 여백을 제멋대로 넣는다.
 *
 * **글자색을 여기서 정하지 않는다.** native date 는 값이 없을 때 `연도-월-일` 을 본문 색으로
 * 그리므로 비어 있는 동안만 자리표시자 색으로 낮추는데, `text-ink` 를 미리 붙여 두면 두
 * 유틸리티가 같은 레이어에서 겹쳐 승자가 CSS 출력 순서에 달린다.
 */
const nativeDateClass = (value: string) =>
  `${inputBaseClass} appearance-none ${value ? "text-ink" : "text-ink-placeholder"}`;

/** 시·분 드롭다운. 아직 안 고른 상태의 `시 선택` 은 자리표시자 톤으로 낮춘다. */
const selectTimeClass = (value: string) =>
  `${inputBaseClass} ${value ? "text-ink" : "text-ink-placeholder"}` +
  " disabled:bg-surface-inset disabled:text-ink-muted";


/**
 * 칩 목록. **`선택 안 함` 이 없다** — 둘 다 비선택인 상태가 곧 `unspecified` 다.
 * 값은 `BirthInput` 의 것을 그대로 쓴다 (API 계약이라 바꾸지 않는다).
 */
const GENDER_CHIPS = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
] as const satisfies readonly { value: BirthInput["gender"]; label: string }[];

const CALENDAR_CHIPS = [
  { value: "solar", label: "양력" },
  { value: "lunar", label: "음력" },
] as const satisfies readonly { value: BirthInput["calendar"]; label: string }[];

/** 체크박스는 글상자보다 작아서, 라벨 전체를 44px 높이의 탭 영역으로 만든다. */
const checkboxLabelClass =
  "flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-soft";
const checkboxClass = "size-5 shrink-0 accent-brand-hover";


/**
 * 연필 아이콘. `aria-hidden` 장식이고 버튼 이름은 `aria-label` 이 만든다.
 * 색은 `currentColor` 다 — 값을 박으면 `tokens.test.ts` 가 원시 색상으로 잡는다.
 */
function PencilIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
