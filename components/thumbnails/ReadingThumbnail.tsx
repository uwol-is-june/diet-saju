import type { ReadingType } from "@/lib/saju/schema";

/**
 * 유형 선택 카드(`/`)의 썸네일 모티프 (TASK-50).
 *
 * ## 왜 사진이 아닌가
 *
 * 셋 다 이 크기에서 사진이 성립하지 않기 때문이다.
 *
 * 1. **크기가 안 맞는다.** 썸네일이 56×56px 다. 사진은 무엇을 찍었는지 알아볼 수 없는
 *    색 덩어리가 된다. 살리려면 카드를 배너형으로 키워야 하고, 그러면 모바일에서 선택지가
 *    한 화면에 안 들어와 `/` 의 성질이 바뀐다.
 * 2. **피사체가 이미 막아 둔 경계에 걸린다.** 사람 몸은 `내가 살이 찌는 이유` 옆에서 신체
 *    평가가 되고, 음식 사진은 `ELEMENT_FOOD` 닫힌 목록을 **판정 코드 밖에서** 우회하며,
 *    운동기구는 `MOVEMENT_PLAN` 이 막는 강도·처방으로 읽힌다. 남는 피사체는 추상 질감뿐인데
 *    그건 사진일 이유가 없다.
 * 3. **팔레트 검사 밖이다.** `tokens.test.ts` 가 컴포넌트의 raw 색을 막지만 래스터 이미지에는
 *    그 검사가 닿지 않는다.
 *
 * ## 렌더한 PNG 도 아니다
 *
 * `scripts/render-icons.mjs` 파이프라인이 있는 이유는 파비콘·og:image 가 **반드시 래스터
 * 파일이어야** 하기 때문이다(브라우저 탭·크롤러). 페이지 안의 장식에는 그 제약이 없다.
 * 인라인 SVG 면 요청이 늘지 않고, 어느 크기에서도 선명하며, 팔레트 검사가 계속 닿는다.
 *
 * ## 시각 언어를 `components/charts/` 와 잇는다
 *
 * 같은 도형 어휘를 쓰면 목록과 결과 화면이 한 서비스로 읽힌다.
 *
 * | 유형 | 모티프 | 어디서 온 어휘인가 |
 * | --- | --- | --- |
 * | `diet` | 오각형 | `OhaengCycle` 의 상생 오각형 (라벨 없이 축소) |
 * | `gain-cause` | 한쪽으로 치우친 막대 셋 | `OhaengBars` |
 * | `diet-method` | 계단 | 접근 순서 — 무엇을 먼저 고정하는가 |
 * | `diet-food` | 그릇에서 오르는 김 | 재료 범주 + 조리·온도 (`ELEMENT_FOOD`·`THERMAL_GUIDE`) |
 * | `exercise` | 오르는 화살 | 강도의 결 (`MOVEMENT_PLAN`) |
 * | `decade` | 열 칸 눈금 중 한 칸 | 대운 타임라인 (`DaeunTimeline`) |
 * | `general` | 오각형 + 중심점 | 목록에 안 나오지만 `Record` 라 값이 필요하다 |
 *
 * ## `Record` 여야 한다
 *
 * 예전 `THUMBNAIL_TONES` 는 배열이었고 그건 맞았다 — 명도 차이일 뿐 유형과 무관했으므로
 * 순서대로 돌려 쓰면 됐다. **모티프는 유형의 의미를 담으므로 배열이면 새 유형이 조용히 남의
 * 그림을 달고 나간다** (TASK-15 에서 공유 카드 칩이 그럴 뻔했던 것과 같은 함정).
 *
 * ## 장식이다
 *
 * `aria-hidden` 이고 `focusable="false"` 다. 링크의 접근 가능한 이름은 카드 제목이 만든다.
 * (`focusable` 은 일부 브라우저에서 SVG 가 탭 순서에 끼어드는 것을 막는다.)
 *
 * 애니메이션을 붙이지 않는다 — `/` 를 통째로 정적으로 두고, 붙일 거면 `globals.css` 의
 * `anim-*` 규칙(키프레임은 `from` 만)을 따라야 한다.
 */

/** 오각형 꼭짓점 — `OhaengCycle` 과 같은 계산(12시 방향에서 시계 방향). */
const PENTAGON = Array.from({ length: 5 }, (_, index) => {
  const angle = (index / 5) * Math.PI * 2 - Math.PI / 2;
  return `${(24 + Math.cos(angle) * 15).toFixed(2)},${(24 + Math.sin(angle) * 15).toFixed(2)}`;
}).join(" ");

/**
 * 모티프 본문. `viewBox="0 0 48 48"` 안에서 그린다 — 바깥 `<svg>` 가 공통이므로
 * 각 항목은 도형만 돌려준다.
 */
const MOTIF: Record<ReadingType, React.ReactNode> = {
  // 오각형 + 중심점. 내부 유형이라 목록에 나오지 않지만 `/admin` 이 쓸 수 있다.
  general: (
    <>
      <polygon points={PENTAGON} className="fill-none stroke-on-brand" strokeWidth={2} />
      <circle cx={24} cy={24} r={3} className="fill-on-brand" />
    </>
  ),
  // 상생 오각형 — 결과 화면의 `OhaengCycle` 을 라벨 없이 축소한 모양.
  diet: <polygon points={PENTAGON} className="fill-none stroke-on-brand" strokeWidth={2} />,
  // 한쪽으로 치우친 막대 셋 — `OhaengBars` 의 어휘. 치우침이 이 유형의 주제다.
  "gain-cause": (
    <>
      <rect x={10} y={14} width={12} height={6} rx={3} className="fill-on-brand" />
      <rect x={10} y={23} width={28} height={6} rx={3} className="fill-on-brand" />
      <rect x={10} y={32} width={8} height={6} rx={3} className="fill-on-brand" />
    </>
  ),
  // 계단 — 무엇을 먼저 고정하고 무엇을 나중에 하는가(접근 순서).
  "diet-method": (
    <>
      <rect x={9} y={30} width={9} height={9} className="fill-on-brand" />
      <rect x={20} y={23} width={9} height={16} className="fill-on-brand" />
      <rect x={31} y={16} width={9} height={23} className="fill-on-brand" />
    </>
  ),
  /**
   * 그릇에서 김이 오르는 모양 (TASK-63).
   *
   * **특정 식품을 그리지 않는다** — 그러면 `ELEMENT_FOOD` 닫힌 목록을 그림으로 우회하는
   * 셈이 된다(TASK-50 이 음식 사진을 뺀 이유). 그릇은 식사 도구라 그 경계 밖이고,
   * 김은 이 유형의 다른 축(조리 방식·음식 온도 = `THERMAL_GUIDE`)을 함께 말한다.
   *
   * **두 번 고쳐 그렸다.** 처음에는 반원 그릇 위에 점 셋, 다음에는 반원 그릇 위에 김 두
   * 줄기였는데 **둘 다 56px 에서 웃는 얼굴로 읽혔다** — 넓은 아래 호가 입이 되고 그 위의
   * 대칭 도형 둘이 눈이 된다. 지금은 **사다리꼴 그릇 + 김 한 줄기**다. 아래를 직선으로
   * 끊고 위 도형을 하나만 비대칭으로 두면 얼굴로 보이지 않는다.
   * **작은 크기에서 대칭은 얼굴을 만든다** — 모티프를 더할 때 이걸 먼저 의심할 것.
   */
  "diet-food": (
    <>
      <path
        d="M28 18c-3-3.5 3-5 0-8.5"
        className="fill-none stroke-on-brand"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M12 22h24l-3.5 15h-17z"
        className="fill-none stroke-on-brand"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </>
  ),
  // 오르는 화살 — 강도의 결. 수치가 아니라 방향만 말한다.
  exercise: (
    <>
      <polyline
        points="10,34 19,26 26,31 38,17"
        className="fill-none stroke-on-brand"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="31,16 39,16 39,24"
        className="fill-none stroke-on-brand"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  /*
    눈금 위의 현재 위치 — `DaeunTimeline` 의 "지금 어디쯤인가".

    처음에는 다섯 칸을 테두리 사각형으로 그렸는데 **56px 에서 바코드처럼 읽혔다**
    (1.5 굵기 테두리 × 4.5 폭). 선 하나 + 눈금 + 채운 점으로 바꾸니 형태가 남는다.
    작은 크기에서는 도형 수를 줄이고 굵기를 키우는 쪽이 이긴다.
  */
  decade: (
    <>
      <line x1={10} y1={24} x2={38} y2={24} className="stroke-on-brand" strokeWidth={2} />
      {[10, 17, 31, 38].map((x) => (
        <line
          key={x}
          x1={x}
          y1={20}
          x2={x}
          y2={28}
          className="stroke-on-brand"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      <circle cx={24} cy={24} r={5} className="fill-on-brand" />
    </>
  ),
};

export function ReadingThumbnail({ readingType }: { readingType: ReadingType }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
      className="size-14 shrink-0 rounded-xl bg-brand"
    >
      {MOTIF[readingType]}
    </svg>
  );
}
