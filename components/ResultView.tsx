"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { collectVerdictLabels } from "@/lib/reading/emphasis";
import { findCurrentDaeun } from "@/lib/saju/decade";
import type { Pillar, ReadingType, SajuChart, TimeCorrectionInfo } from "@/lib/saju/schema";
import { DaeunTimeline } from "./charts/DaeunTimeline";
import { OhaengBars } from "./charts/OhaengBars";
import { OhaengCycle } from "./charts/OhaengCycle";
import { ThermalScale } from "./charts/ThermalScale";
import { LikeButton } from "./LikeButton";
import { ReadingSections } from "./ReadingSections";
import { ShareActions } from "./ShareActions";
import { VerdictCallout } from "./VerdictCallout";
import { CalculationBasis, describeCalculationBasis } from "./CalculationBasis";

/* 오행 배지 톤 표는 `charts/OhaengBars.tsx` 로 옮겼다 (TASK-25에서 배지 줄을 막대로 교체). */

/**
 * 결과 화면. **위에서부터 판정 한 줄 → 풀이 → 좋아요 → 공유 → 근거 도식 순이다.**
 * 사람들이 보러 온 것은 풀이이므로 그것이 맨 위에서 시작하고, 코드가 만든 도식은
 * "무엇으로 이 풀이가 나왔는가" 를 밝히는 근거로 뒤에 붙는다.
 *
 * 원국은 즉시 계산되지만 첫 글자는 1초 뒤에 오므로 그 사이를 판정 콜아웃이 채운다.
 */
export function ResultView({
  chart,
  reading,
  readingType,
  streaming = false,
  birthplace = null,
  onReapply,
  busy = false,
}: {
  chart: SajuChart;
  reading: string;
  /** **요청할 때** 고른 유형. 폼의 현재 값이 아니다 — 섹션 계약이 유형별로 다르다. */
  readingType: ReadingType;
  streaming?: boolean;
  /**
   * 표시용 출생지 이름. **`chart` 에 들어 있지 않다** — 지역 이름은 서버로 보내지 않으므로
   * (가는 것은 경도뿐) 폼이 들고 있는 값을 그대로 받는다.
   */
  birthplace?: string | null;
  /**
   * `계산 기준` 카드에서 값을 바꾼 뒤 다시 요청하는 길. 제출은 `SajuForm` 이 들고 있으므로
   * 여기서는 부르기만 한다. **없으면 그 카드를 내지 않는다** (다시 볼 수 없는 카드가 된다).
   */
  onReapply?: () => void;
  /** 요청이 나가 있는 동안(원국을 기다리는 중) 다시 보기 버튼을 잠근다. */
  busy?: boolean;
}) {
  const pillars: { label: string; pillar: Pillar | null }[] = [
    { label: "연주", pillar: chart.year },
    { label: "월주", pillar: chart.month },
    { label: "일주", pillar: chart.day },
    { label: "시주", pillar: chart.hour },
  ];

  return (
    <div className="space-y-6">

      {/*
        판정 한 줄 콜아웃 (TASK-47). **결과 화면의 첫 요소다** (TASK-61) — 원국은 60~70ms 에
        오고 첫 글자는 1초 뒤라, 기다리는 동안 결론 한 줄이 먼저 뜬다.
        스트리밍 중에도 낸다. `OtherReadingLinks` 와 달리 **읽고 있는 글을 끊는 것이
        아니라 그 글의 결론**이라, 먼저 떠 있는 편이 오히려 읽는 데 도움이 된다.
      */}
      <VerdictCallout chart={chart} readingType={readingType} />

      <div aria-label="풀이" aria-busy={streaming} role="region">
        <ReadingSections
          reading={reading}
          readingType={readingType}
          streaming={streaming}
          /* 판정 라벨은 코드가 정한 값이라 매번 같은 자리에서 굵어진다 (TASK-65). */
          verdictLabels={collectVerdictLabels(chart)}
        />
      </div>

      {/*
        생성이 끝난 뒤에 보여준다 — 쓰는 중에 평가를 요구하거나 공유 버튼을 내밀면
        지금 쓰이고 있는 글을 끊고 미완성 결과를 퍼뜨린다 (TASK-51 의 이유 그대로).

        **좋아요가 공유보다 먼저다** (TASK-81). `도움이 됐어요` 는 방금 읽은 글에 대한
        반응인데 예전에는 **근거 카드 셋 뒤**에 있어서 다 지나친 다음에야 나왔다. 읽고 →
        반응하고 → 공유하는 순서로 둔다. **`OtherReadingLinks` 는 여기 오지 않는다** —
        그건 이 화면을 다 본 뒤에 다른 유형으로 보내는 동선이라 맨 아래(`SajuForm`)에 있다.

        둘을 한 묶음(`space-y-2`)으로 감싼다. 바깥 `space-y-6` 에 나란히 두면 칩의
        `py-2` 가 더해져 사이가 32px 로 벌어지고 **한 덩어리로 읽히지 않는다.**
      */}
      {!streaming && (
        <div className="space-y-2">
          <LikeButton type={readingType} />
          <ShareActions chart={chart} readingType={readingType} />
        </div>
      )}

      {/*
        근거 묶음 (TASK-61 · 82). **풀이 아래에 둔다** — 사람들이 보러 온 것은 풀이이고
        도식은 그것이 무엇에서 나왔는지 보여주는 근거다. 접는 것만으로는 부족했다(TASK-52): 접힌
        제목 줄 셋과 펼쳐진 원국 카드가 여전히 본문보다 위에 있어서 글이 아래에서 시작했다.

        제목 줄을 **카드로 감싸지 않는다** — 카드 안에 카드가 되어 여백이 두 겹이 된다.
        묶음에 이름이 있어야 이 카드들이 왜 뒤에 붙어 있는지 읽힌다.
        TASK-73 에서 원국까지 접어 **셋이 같은 모양**이 됐다.
      */}
      <div className="pt-2">
        <h2 className="title-md title-bold">내 사주</h2>
        {/*
          **제목이 하던 일을 한 줄로 옮겼다** (TASK-82). 옛 제목 `이 풀이의 근거` 는
          설명문처럼 읽혔지만 "이 카드들이 왜 본문 뒤에 붙어 있는가" 를 혼자 설명하고
          있었다(TASK-61). 이름을 `내 사주` 로 바꾸면 그 일을 아무도 하지 않으므로
          바로 아래 한 줄이 대신 한다. **둘 중 하나만 두지 말 것.**
        */}
        <p className="mt-1 text-sm text-ink-muted">이 풀이는 아래 값에서 나왔습니다.</p>
      </div>

      {/*
        원국 카드도 접는다 (TASK-73). 이 묶음은 이름 그대로 **본문을 읽고 난 뒤에
        확인하는 자리**인데, 접힌 제목 줄 둘 옆에서 이 카드만 화면 한 뭉치를 차지했다.

        `note` 가 **양력 날짜와 띠**다 — 펴지 않고 알아야 하는 것은 "내가 넣은 값으로
        계산된 것이 맞는가" 이고, 그 확인이 이 카드가 근거로서 하는 일이다.
      */}
      <FoldCard title="사주 원국" note={`양력 ${chart.solarDate} · ${chart.saencho}띠`}>
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
      </FoldCard>

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
        네 번째 근거 카드 — 계산 기준 (TASK-101). 폼에 있던 `만세력 고급 설정` 을 여기로
        내렸다. **앞의 셋과 같은 `FoldCard` 모양이어야 한다** (TASK-73 이 셋을 모두 접어
        맞춰 둔 값이다). `note` 는 고른 값이 아니라 **실제로 적용된 보정량**이다 —
        폼에서는 계산 전이라 보여줄 수 없던 것이고, 이 카드를 열 이유가 있는지를
        펴지 않고 판단하게 해 준다.

        **접는 판단 기준에도 맞는다** — 접지 않는 것은 스트리밍으로 채워지는 것뿐이고
        (`ReadingSections`), 이 값은 요청 시점에 확정돼 그 뒤로 변하지 않는다.
      */}
      {onReapply && (
        <FoldCard title="계산 기준" note={describeCalculationBasis(chart.timeCorrection)}>
          <CalculationBasis
            correction={chart.timeCorrection}
            timeUnknown={chart.timeUnknown}
            onReapply={onReapply}
            busy={streaming || busy}
          />
        </FoldCard>
      )}

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
   * 대운 8~10칸은 어떤 화면에서도 가로로 넘친다 → 열릴 때 현재 칸을 가운데로 당겨 둔다.
   *
   * **`scrollIntoView` 를 쓰지 않는다** — 세로 스크롤까지 움직여 폼에서 결과로 넘어오는
   * 자동 스크롤과 싸운다. 가로 위치만 직접 계산한다.
   *
   * **`open` 이 의존성에 있어야 한다.** 접힌 `<details>` 안은 `display: none` 이라 모든 칸의
   * `getBoundingClientRect()` 가 0 이고, 마운트 때 한 번만 계산하면 맨 왼쪽에 머문다.
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
 * 접어 둔 근거 카드. 도식은 코드가 만든 **근거**이고 사람들이 보러 온 것은 본문이다 —
 * 펼쳐 두면 본문이 화면 두 개쯤 아래로 밀린다. **근거 카드 넷이 다 같은 모양이다.**
 *
 * **풀이 섹션에 아코디언을 쓰지 않는 것과 모순이 아니다.** 그쪽은 지금 써지고 있는 글이라
 * 접으면 스트리밍이 보이지 않는다. 도식은 요청 즉시 확정되므로 놓치는 순간이 없다.
 *
 * `note` 는 **펴지 않아도 알 수 있어야 하는 한 줄**이다 — 제목만 있으면 무엇이 들었는지
 * 몰라 결국 전부 펴 본다. `summary` 가 한 줄이라 390px 에서 잘리지 않는 길이여야 한다.
 * 모양·화살표는 `globals.css` 의 `.fold` 가 정한다.
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
  /**
   * **펼칠 때마다 내용을 remount 한다.** `anim-*` 은 mount 시점에 재생되는데 이 내용은
   * 카드가 접힌 채(`display: none`) 이미 mount 돼 있다. `display: none` 이 애니메이션을
   * 취소하고 다시 보일 때 재생하는지는 **브라우저 구현에 기대지 않는다** — key 를 올리면
   * 어디서든 "펼치는 순간 재생" 이 된다. 도식은 순수 표현이라 remount 가 싸다.
   */
  const [openCount, setOpenCount] = useState(0);

  return (
    <details
      className="fold rounded-2xl border border-line bg-surface shadow-sm"
      onToggle={(event) => {
        const open = event.currentTarget.open;
        if (open) setOpenCount((previous) => previous + 1);
        onToggle?.(open);
      }}
    >
      {/*
        제목을 `h3` 로 두어 **`내 사주` 묶음(h2) 아래 단계**로 읽히게 한다 (TASK-61 · 82).
        원국 카드와 같은 단계여야 제목 탐색으로 근거 카드 셋을 훑을 수 있다.
      */}
      <summary className="flex items-center gap-x-3 gap-y-1 p-5 sm:p-6">
        <h3 className="title-sm title-bold">{title}</h3>
        <span className="min-w-0 truncate text-sm text-ink-muted">{note}</span>
      </summary>
      <div key={openCount} className="border-t border-line p-5 sm:p-6">
        {children}
      </div>
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
