import type { SajuChart } from "@/lib/saju/schema";

/**
 * 오행 분포 (TASK-25).
 *
 * ## SVG 가 아니라 div 인 이유
 *
 * 가로 막대는 좌표를 계산할 일이 없다. div 로 두면 글자가 화면 폭에 맞춰 자연스럽게
 * 흐르고, SVG 처럼 뷰박스 비율에 눌려 라벨이 작아지지도 않는다. 좌표가 필요한 도식
 * (오각형 관계도)만 SVG 로 그린다. 차트 라이브러리는 쓰지 않는다.
 *
 * ## 막대 길이는 점수인데 숫자는 개수를 쓴다
 *
 * 막대 길이의 근거는 `score`(개수 × 계절 배수)다. 계절 기세를 반영해야 "겨울의 화 하나"
 * 와 "여름의 화 하나" 가 달라 보이기 때문이다. 그런데 그 배수는 **우리 관례**라 절대
 * 수치가 아니므로 — 프롬프트에서 숫자로 인용하지 말라고 지시하는 것과 같은 이유로 —
 * **점수를 숫자로 찍지 않고 길이(상대 비중)로만 쓴다.** 화면에 적는 숫자는 이견 없는
 * 사실인 `count` 다.
 */
export function OhaengBars({ ohaeng, balance }: {
  ohaeng: SajuChart["ohaeng"];
  balance: SajuChart["constitution"]["balance"];
}) {
  const elements = ["목", "화", "토", "금", "수"] as const;
  const max = Math.max(...elements.map((element) => ohaeng.score[element]), 1);

  return (
    <div>
      <ul className="space-y-1.5">
        {elements.map((element, index) => {
          const level = balance[element];
          const ratio = ohaeng.score[element] / max;
          return (
            <li key={element} className="flex items-center gap-2 text-xs">
              <span
                className={`w-6 shrink-0 rounded px-1 py-0.5 text-center font-medium ${TONE[element]}`}
              >
                {element}
              </span>

              <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-inset">
                {/*
                  길이는 인라인 style, 색은 토큰 클래스. 막대가 0 이면(개수 0) 아무것도
                  그리지 않는다 — 1px 짜리 조각이 남으면 "조금 있다" 로 읽힌다.
                  등장은 scaleX 라 레이아웃을 다시 계산하지 않는다.
                */}
                {ratio > 0 && (
                  <span
                    className={`anim-grow-x block h-full rounded-full ${FILL[element]}`}
                    style={{
                      width: `${ratio * 100}%`,
                      animationDelay: `${index * 60}ms`,
                    }}
                  />
                )}
              </span>

              <span className="w-24 shrink-0 text-right text-ink-muted">
                {ohaeng.count[element]}자 · {ohaeng.seasonalState[element]}
                {level !== "적정" && (
                  <strong className="ml-1 font-medium text-ink-soft">{level}</strong>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-ink-muted">
        막대 길이는 글자 수에 태어난 계절의 기세(왕상휴수사)를 반영한 상대 비중입니다.
      </p>
    </div>
  );
}

/** 배지 톤 — 배지·OG 카드와 같은 오행 토큰을 쓴다. */
const TONE = {
  목: "bg-ohaeng-mok text-ohaeng-mok-ink",
  화: "bg-ohaeng-hwa text-ohaeng-hwa-ink",
  토: "bg-ohaeng-to text-ohaeng-to-ink",
  금: "bg-ohaeng-geum text-ohaeng-geum-ink",
  수: "bg-ohaeng-su text-ohaeng-su-ink",
} as const;

/**
 * 막대 채움은 **잉크색**을 쓴다. 배지 배경(연한 톤)으로 채우면 트랙(`surface-inset`)과
 * 거의 같은 밝기라 막대가 보이지 않는다.
 */
const FILL = {
  목: "bg-ohaeng-mok-ink",
  화: "bg-ohaeng-hwa-ink",
  토: "bg-ohaeng-to-ink",
  금: "bg-ohaeng-geum-ink",
  수: "bg-ohaeng-su-ink",
} as const;
