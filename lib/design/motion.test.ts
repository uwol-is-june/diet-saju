import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 도식·등장 애니메이션 계약 (TASK-25).
 *
 * 애니메이션은 눈으로 봐야 알지만, **깨졌을 때 조용한 두 가지**는 테스트로 잡을 수 있다.
 *  1. 모션 최소화 설정에서 **숨은 상태에 갇히는 것** — 화면이 그냥 비어 보인다
 *  2. 스트리밍 중 **매 조각마다 재생되는 것** — 글이 떨린다
 *
 * 둘 다 원인이 구조에 있어서 소스를 읽어 확인한다.
 */

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const READING_SECTIONS = readFileSync(
  new URL("../../components/ReadingSections.tsx", import.meta.url),
  "utf8",
);

/** `anim-*` 을 쓰는 파일 전부. 도식에서 시작했지만 지금은 `/` 목록도 들어 있다. */
const CHART_SOURCES = [
  "components/charts/OhaengBars.tsx",
  "components/charts/OhaengCycle.tsx",
  "components/charts/ThermalScale.tsx",
  "components/charts/DaeunTimeline.tsx",
  "components/ReadingSections.tsx",
  "components/ScrollToTop.tsx",
  // `/` 도 `anim-*` 을 쓴다 (TASK-104). 목록에 없으면 이 화면만 오타·미사용 검사 밖이 된다.
  "app/page.tsx",
].map((path) => ({
  path,
  code: readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"),
}));

/** `@keyframes 이름 { … }` 블록을 이름 → 본문으로 읽는다. */
function readKeyframes(): Record<string, string> {
  const blocks: Record<string, string> = {};
  for (const match of CSS.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
    blocks[match[1]!] = match[2]!;
  }
  return blocks;
}

describe("모션 최소화에서 최종 모습이 남는다", () => {
  const keyframes = readKeyframes();

  it("키프레임을 읽어 온다", () => {
    expect(Object.keys(keyframes).length).toBeGreaterThanOrEqual(4);
  });

  it("모든 키프레임이 `from` 만 쓴다", () => {
    /**
     * 여기가 핵심이다. `to`(또는 `100%`)로 최종값을 지정하면, 아래 모션 최소화 규칙이
     * 재생 시간을 0.01ms 로 줄이는 순간 요소가 **숨은 상태 그대로 남는다** — 막대가
     * 폭 0, 선이 안 그려진 상태로 멈춘다. 쉬는 상태가 최종 모습이어야 한다.
     */
    for (const [name, body] of Object.entries(keyframes)) {
      expect(body, `${name} 에 to/100% 가 있다`).not.toMatch(/(^|\s)(to|100%)\s*\{/);
      expect(body, `${name} 에 from 이 없다`).toMatch(/(^|\s)(from|0%)\s*\{/);
    }
  });

  it("모션 최소화 규칙이 재생 시간을 줄인다", () => {
    const block = CSS.slice(CSS.indexOf("prefers-reduced-motion"));
    expect(block).toContain("animation-duration: 0.01ms");
    expect(block).toContain("transition-duration: 0.01ms");
  });

  /**
   * **재생 시간만 줄이면 지연이 남는다** (TASK-104). `both` 라 지연 동안 `from`(투명)에
   * 갇히므로, 지연을 지우지 않으면 모션 최소화 설정에서도 `/` 카드 다섯이 **여전히
   * 시차를 두고 튀어나온다.** 이 규칙이 없으면 화면이 조용히 잘못 동작한다.
   */
  /**
   * **등장 애니메이션이 `opacity` 로 시작하면 LCP 가 무너진다** (TASK-104 실측).
   *
   * 크롬은 요소가 **처음 그려질 때** LCP 후보로 등록하는데, 그때 투명하면 그 요소는
   * 후보에서 빠지고 다시 들어오지 않는다. `/` 의 LCP 요소는 카드 사진이라, 카드에
   * `opacity: 0` 에서 출발하는 애니메이션을 걸면 다섯 장이 통째로 후보에서 빠지고
   * **LCP 가 웹폰트를 기다리는 `h1` 으로 떨어진다** — 0.72초 → **2.48초**로 쟀다.
   *
   * 그래서 이 키프레임은 **`transform` 만** 쓴다. 눈으로는 절대 안 잡히는 종류의 회귀다.
   */
  it("`/` 등장 키프레임이 opacity 를 건드리지 않는다", () => {
    const body = keyframes["card-rise"];
    expect(body, "card-rise 키프레임이 없다").toBeDefined();
    expect(body).toContain("transform");
    expect(body, "opacity 로 시작하면 카드 사진이 LCP 후보에서 빠진다").not.toContain(
      "opacity",
    );
  });

  it("모션 최소화 규칙이 지연도 지운다", () => {
    const start = CSS.indexOf("prefers-reduced-motion");
    // 첫 규칙(`*`)만 본다 — 뒤의 전환 겹장 규칙은 별개다.
    const starRule = CSS.slice(start, CSS.indexOf("}", CSS.indexOf("{", start) + 1));
    expect(starRule).toContain("animation-delay: 0s !important");
  });
});

describe("애니메이션 클래스가 정의돼 있다", () => {
  const defined = new Set(
    [...CSS.matchAll(/^\.(anim-[\w-]+)\s*\{/gm)].map((match) => match[1]!),
  );

  it("globals.css 에 anim-* 클래스가 있다", () => {
    expect(defined.size).toBeGreaterThanOrEqual(4);
  });

  it("컴포넌트가 쓰는 anim-* 이 전부 정의돼 있다", () => {
    // 오타 하나로 애니메이션이 조용히 사라지는 것을 막는다.
    for (const { path, code } of CHART_SOURCES) {
      for (const match of code.matchAll(/\banim-[\w-]+/g)) {
        expect(defined, `${path} 의 ${match[0]} 미정의`).toContain(match[0]);
      }
    }
  });

  it("정의한 anim-* 이 전부 쓰이고 있다", () => {
    const used = new Set(
      CHART_SOURCES.flatMap(({ code }) => [...code.matchAll(/\banim-[\w-]+/g)].map((m) => m[0])),
    );
    expect([...defined].filter((name) => !used.has(name))).toEqual([]);
  });

  it("`chart-draw` 를 쓰는 곳은 선 길이를 함께 넘긴다", () => {
    // dashoffset 애니메이션은 stroke-dasharray 가 선 길이와 같아야 그려지는 효과가 된다.
    const cycle = CHART_SOURCES.find(({ path }) => path.includes("OhaengCycle"))!.code;
    expect(cycle).toContain("--draw-length");
    expect(cycle).toContain("strokeDasharray={length}");
  });
});

/**
 * 접힌 카드의 도식은 **펼치는 순간 재생돼야 한다** (TASK-49).
 *
 * TASK-52 로 도식 셋이 `FoldCard` 안으로 들어가면서 등장 애니메이션이 보이는 순간이
 * 바뀌었다 — "스크롤해서 도착한다" 가 아니라 "이미 화면에 있는 카드를 펼친다" 다.
 * 그런데 `anim-*` 은 mount 시점에 재생되고 카드 내용은 접힌 채로 이미 mount 돼 있다.
 *
 * **`display: none` 의 애니메이션 취소·재시작 동작에 기대지 않는다.** key 를 올려
 * remount 하면 어느 브라우저에서든 같게 동작한다.
 */
describe("접힌 카드는 펼칠 때 재생된다 (TASK-49)", () => {
  const RESULT_VIEW = readFileSync(
    new URL("../../components/ResultView.tsx", import.meta.url),
    "utf8",
  );

  it("FoldCard 가 펼칠 때 내용을 remount 한다", () => {
    expect(RESULT_VIEW).toContain("key={openCount}");
    expect(RESULT_VIEW).toContain("setOpenCount((previous) => previous + 1)");
  });

  it("접을 때는 세지 않는다 — 접는 것으로 재생되지 않는다", () => {
    // `if (open)` 이 빠지면 접을 때도 key 가 올라가 보이지 않는 재생이 한 번 더 돈다.
    expect(RESULT_VIEW).toContain("if (open) setOpenCount");
  });

  /**
   * **`animation-timeline: view()` 는 쓰지 않는다** (TASK-49 결론).
   *
   * 그것은 "스크롤해서 지나가는 동안 재생" 을 푸는 도구인데, 지금 도식이 드러나는 순간은
   * **이미 화면 안에 있는 카드를 펼치는 것**이다. 그 자리에서 `view()` 는 진행도가
   * 100%(=최종 모습)라 아무 재생도 하지 않는다 — 지금 동작보다 나빠진다.
   */
  it("도식 클래스에 스크롤 타임라인을 걸지 않는다", () => {
    expect(CSS).not.toContain("animation-timeline");
  });
});

describe("스트리밍 중 등장이 다시 재생되지 않는다", () => {
  it("섹션 key 가 제목이 아니라 id 다", () => {
    /**
     * 계약에 없는 제목은 글자가 도착하는 대로 늘어난다. 제목을 key 로 쓰면 조각마다
     * remount 되고, CSS 애니메이션은 mount 마다 재생되므로 글이 떨린다.
     */
    expect(READING_SECTIONS).not.toContain("key={section.title}");
    expect(READING_SECTIONS).toContain("${section.id}-${index}");
  });

  it("같은 제목이 두 번 와도 key 가 겹치지 않는다", () => {
    /**
     * 모델이 같은 제목을 두 번 내는 일이 실제로 있다 (표본 4건 중 1건에서
     * `## 어디서부터 붙는가` 가 두 번 왔다). id 만 key 로 쓰면 그때 겹친다.
     * index 는 스트리밍 중에도 앞쪽 섹션에서 바뀌지 않으므로 위 안정성은 그대로다 —
     * 제목을 key 로 쓸 때와 달리 조각마다 remount 되지 않는다.
     */
    expect(READING_SECTIONS).toContain("section.id ? `${section.id}-${index}`");
  });

  it("등장 애니메이션을 JS 상태로 제어하지 않는다", () => {
    // "이미 재생했는가" 를 useState 로 들면 조각마다 다시 판단하게 되고 버그가 생긴다.
    // mount 시점에만 걸리는 CSS 애니메이션 하나로 끝내는 것이 이 설계의 요점이다.
    expect(READING_SECTIONS).toContain("anim-rise");
    expect(READING_SECTIONS).not.toMatch(/useState[^\n]*[Aa]nimat/);
  });
});

/**
 * 화면 사이 좌우 밀림 전환 (TASK-96).
 *
 * 이 전환은 **세 곳이 같은 문자열을 써야** 산다 — 링크의 `transitionTypes`,
 * `PageTransition` 의 유형 표, `globals.css` 의 `::view-transition-*(.…)` 선택자.
 * 한쪽만 고치면 오류가 나지 않고 **그냥 아무 일도 일어나지 않는다.** 눈으로 잡기도
 * 어렵다 — 전환은 이동하는 찰나에만 보이고 스크린샷에 남지 않는다.
 */
describe("화면 전환 (TASK-96)", () => {
  const read = (path: string) =>
    readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

  const PAGE_TRANSITION = read("components/PageTransition.tsx");
  const HOME = read("app/page.tsx");
  const READING = read("app/reading/[type]/page.tsx");
  const BACK_LINK = read("components/BackLink.tsx");

  /** `PageTransition` 이 내보내는 전환 유형 문자열. 여기가 단일 소스다. */
  const types = [...PAGE_TRANSITION.matchAll(/export const NAV_\w+ = "([\w-]+)"/g)].map(
    (match) => match[1]!,
  );

  /**
   * `::view-transition-old(.nav-back)` 같은 규칙에서 미는 거리를 읽는다.
   * 선택자에 괄호·점이 섞여 있어 정규식으로 찾으면 이스케이프가 두 겹이 된다 —
   * 문자열로 찾고 다음 닫는 중괄호까지 자른다.
   */
  function slideOffset(pseudo: "old" | "new", type: string): number {
    const selector = `::view-transition-${pseudo}(.${type})`;
    const start = CSS.indexOf(selector);
    expect(start, `${selector} 규칙이 없다`).toBeGreaterThan(-1);
    const rule = CSS.slice(start, CSS.indexOf("}", start));
    const value = rule.match(/--vt-slide:\s*(-?\d+)px/);
    expect(value, `${selector} 에 --vt-slide 가 없다`).not.toBeNull();
    return Number(value![1]);
  }

  it("전환 유형 둘이 CSS 규칙을 가지고 있다", () => {
    expect(types).toEqual(["nav-forward", "nav-back"]);
    // 규칙 자체가 사라지면 위 헬퍼가 -1 에서 걸린다.
    for (const type of types) {
      expect(slideOffset("old", type)).not.toBe(0);
      expect(slideOffset("new", type)).not.toBe(0);
    }
  });

  it("앞뒤가 서로 반대 방향이다", () => {
    // 같은 방향이면 전환이 앞뒤를 구분해 주지 못한다 — 이 태스크의 핵심 요구다.
    expect(Math.sign(slideOffset("old", "nav-forward"))).toBe(
      -Math.sign(slideOffset("old", "nav-back")),
    );
    expect(Math.sign(slideOffset("new", "nav-forward"))).toBe(
      -Math.sign(slideOffset("new", "nav-back")),
    );
    // 나가는 쪽과 들어오는 쪽은 같은 방향으로 흘러야 한 덩어리로 읽힌다.
    expect(Math.sign(slideOffset("old", "nav-forward"))).toBe(
      -Math.sign(slideOffset("new", "nav-forward")),
    );
  });

  it("참여하는 두 페이지가 모두 감싸여 있다", () => {
    // 한쪽만 감싸면 나가거나 들어오는 것 중 하나만 움직이는 절반짜리 전환이 된다.
    for (const [path, code] of [
      ["app/page.tsx", HOME],
      ["app/reading/[type]/page.tsx", READING],
    ] as const) {
      expect(code, path).toContain("<PageTransition>");
      expect(code, path).toContain("</PageTransition>");
    }
  });

  it("링크가 전환 유형 문자열을 직접 적지 않는다", () => {
    // 문자열을 베끼면 CSS 클래스와 갈린 것을 아무도 모른다.
    expect(HOME).toContain("transitionTypes={[NAV_FORWARD]}");
    expect(BACK_LINK).toContain("transitionTypes={[NAV_BACK]}");
    for (const code of [HOME, BACK_LINK]) {
      expect(code).not.toMatch(/transitionTypes=\{\["/);
    }
  });

  it("전환을 넣느라 `/` 가 클라이언트 컴포넌트가 되지 않았다", () => {
    // 라우터 전환에 JS 상태를 들면 `/` 가 동적이 되어 통째로 정적인 성질이 깨진다.
    for (const [path, code] of [
      ["app/page.tsx", HOME],
      ["components/PageTransition.tsx", PAGE_TRANSITION],
    ] as const) {
      expect(code, path).not.toContain("use client");
      expect(code, path).not.toContain("useState");
      expect(code, path).not.toContain("useRouter");
    }
  });

  it("모션 최소화 규칙이 전환 겹장까지 덮는다", () => {
    /**
     * `::view-transition-*` 는 문서 안의 요소가 아니라 브라우저가 전환 중에만 만드는
     * 가짜 요소다 — 위쪽 `*` 규칙에 잡히지 않으므로 따로 적어야 한다. 화면을 가로지르는
     * 미끄러짐은 모션 민감성에서 가장 흔한 방아쇠라 빠뜨리면 안 된다.
     */
    const block = CSS.slice(CSS.indexOf("prefers-reduced-motion"));
    expect(block).toContain("::view-transition-old(*)");
    expect(block).toContain("::view-transition-new(*)");
    expect(block).toContain("::view-transition-group(*)");
    expect(block).toContain("animation-delay: 0s");
  });

  it("셸은 전환에서 움직이지 않는다", () => {
    // 이름 없는 것은 전부 `root` 한 장으로 찍힌다. 그것까지 크로스페이드하면 화면
    // 전체가 흔들려 무엇이 움직였는지 읽히지 않는다.
    expect(CSS).toMatch(/::view-transition-group\(root\)\s*\{\s*animation: none;/);
  });
});
