import type { SajuChart } from "@/lib/saju/schema";

/**
 * 오행 상생·상극 관계도 (TASK-25).
 *
 * ## 여기는 SVG 다
 *
 * 좌표가 필요한 유일한 도식이다 — 오각형 꼭짓점 다섯 개와 그 사이 선 열 개. div 로는
 * 만들 수 없다. `viewBox` 를 두고 균일 배율로 늘리므로 글자도 함께 커져 비율이 유지되고,
 * 폭이 좁아지면 도식 전체가 작아질 뿐 잘리지 않는다.
 *
 * ## 상생은 둘레, 상극은 대각선
 *
 * 상생(목→화→토→금→수→목)은 이웃끼리라 오각형의 변이 되고, 상극(목→토→화→금→수→목의
 * 두 칸 건너뛰기)은 대각선이 되어 별 모양이 된다. 이 성질이 오각형 배치를 고른 이유다 —
 * 두 관계를 한 그림에 겹쳐도 선이 엉키지 않는다.
 * (`lib/saju/ganji.ts` 의 주석과 같은 순서다. 순서를 바꾸면 그림이 틀린다.)
 *
 * ## 색은 토큰만 쓴다
 *
 * `fill-ohaeng-*` 같은 유틸리티는 `--color-ohaeng-*` 토큰에서 생성된다. hex 를 박으면
 * `lib/design/tokens.test.ts` 가 잡는다.
 */

/** 상생 순환 순서. 시계 방향으로 놓는다. */
const CYCLE = ["목", "화", "토", "금", "수"] as const;

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 84;

/** 꼭짓점 좌표 — 12시 방향에서 시작해 시계 방향. */
const POINTS = CYCLE.map((element, index) => {
  const angle = (index / CYCLE.length) * Math.PI * 2 - Math.PI / 2;
  return {
    element,
    x: CENTER + Math.cos(angle) * RADIUS,
    y: CENTER + Math.sin(angle) * RADIUS,
  };
});

/** 상생 = 이웃(+1), 상극 = 두 칸 건너(+2). */
const SANGSAENG = POINTS.map((from, index) => [from, POINTS[(index + 1) % 5]!] as const);
const SANGGEUK = POINTS.map((from, index) => [from, POINTS[(index + 2) % 5]!] as const);

/**
 * 선 길이. `stroke-dashoffset` 로 그려지는 효과를 내려면 **`stroke-dasharray` 가 선 길이와
 * 같아야** 한다 — 짧으면 점선이 되고, 길면 다 그려지기 전에 애니메이션이 끝난다.
 * 눈대중 상수를 두지 않고 좌표에서 계산한다 (반지름을 바꿔도 따라온다).
 */
const lengthOf = ([from, to]: readonly [{ x: number; y: number }, { x: number; y: number }]) =>
  Math.hypot(to.x - from.x, to.y - from.y);

export function OhaengCycle({ ohaeng }: { ohaeng: SajuChart["ohaeng"] }) {
  const max = Math.max(...CYCLE.map((element) => ohaeng.score[element]), 1);

  return (
    <div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[260px]"
        role="img"
        aria-label={`오행 상생·상극 관계도. ${ohaeng.strongest} 기운이 가장 강합니다.`}
      >
        {/*
          상극(대각선)을 먼저 깔아 상생 선과 원이 위에 오게 한다.
          이 선들은 **점선 모양 자체가 의미**(누르는 방향)라 `stroke-dasharray` 를 그리는
          효과에 쓸 수 없다 — dashoffset 을 움직이면 점선이 미끄러진다. 그래서 서서히 나타난다.
        */}
        <g className="stroke-line-strong" strokeDasharray="3 4" strokeWidth={1}>
          {SANGGEUK.map(([from, to], index) => (
            <line
              key={`geuk-${from.element}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="anim-fade"
              style={{ animationDelay: `${260 + index * 50}ms` }}
            />
          ))}
        </g>

        <g className="stroke-brand-hover" strokeWidth={1.75} strokeLinecap="round">
          {SANGSAENG.map((edge, index) => {
            const [from, to] = edge;
            const length = lengthOf(edge);
            return (
              <line
                key={`saeng-${from.element}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeDasharray={length}
                className="anim-draw"
                style={
                  {
                    "--draw-length": `${length}`,
                    animationDelay: `${index * 70}ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </g>

        {POINTS.map(({ element, x, y }, index) => {
          // 반지름으로 세력을 보인다. 개수 0 이어도 원은 남긴다 — 관계도는 다섯 자리가
          // 다 있어야 상생·상극이 읽히고, "없음" 은 투명도로 말한다.
          const ratio = ohaeng.score[element] / max;
          const r = 15 + ratio * 11;
          const missing = ohaeng.count[element] === 0;
          return (
            <g
              key={element}
              className="anim-pop"
              style={{
                animationDelay: `${420 + index * 60}ms`,
                // 원 자리에서 커지게 한다. 기본값(0,0)이면 왼쪽 위에서 날아온다.
                transformOrigin: `${x}px ${y}px`,
                opacity: missing ? 0.45 : 1,
              }}
            >
              <circle cx={x} cy={y} r={r} className={`${TONE[element]} stroke-surface`} strokeWidth={2} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-[13px] font-bold ${INK[element]}`}
                fill="currentColor"
              >
                {element}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="mt-1 text-center text-xs text-ink-muted">
        <span className="font-medium text-brand-ink">실선</span> 상생(돕는 방향) ·{" "}
        <span className="font-medium text-ink-soft">점선</span> 상극(누르는 방향) · 원의 크기는
        세력
      </p>
    </div>
  );
}

const TONE = {
  목: "fill-ohaeng-mok",
  화: "fill-ohaeng-hwa",
  토: "fill-ohaeng-to",
  금: "fill-ohaeng-geum",
  수: "fill-ohaeng-su",
} as const;

const INK = {
  목: "text-ohaeng-mok-ink",
  화: "text-ohaeng-hwa-ink",
  토: "text-ohaeng-to-ink",
  금: "text-ohaeng-geum-ink",
  수: "text-ohaeng-su-ink",
} as const;
