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

const CHART_SOURCES = [
  "components/charts/OhaengBars.tsx",
  "components/charts/OhaengCycle.tsx",
  "components/charts/ThermalScale.tsx",
  "components/charts/DaeunTimeline.tsx",
  "components/ReadingSections.tsx",
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

describe("스트리밍 중 등장이 다시 재생되지 않는다", () => {
  it("섹션 key 가 제목이 아니라 id 다", () => {
    /**
     * 계약에 없는 제목은 글자가 도착하는 대로 늘어난다. 제목을 key 로 쓰면 조각마다
     * remount 되고, CSS 애니메이션은 mount 마다 재생되므로 글이 떨린다.
     */
    expect(READING_SECTIONS).not.toContain("key={section.title}");
    expect(READING_SECTIONS).toMatch(/key=\{section\.id \?\?/);
  });

  it("등장 애니메이션을 JS 상태로 제어하지 않는다", () => {
    // "이미 재생했는가" 를 useState 로 들면 조각마다 다시 판단하게 되고 버그가 생긴다.
    // mount 시점에만 걸리는 CSS 애니메이션 하나로 끝내는 것이 이 설계의 요점이다.
    expect(READING_SECTIONS).toContain("anim-rise");
    expect(READING_SECTIONS).not.toMatch(/useState[^\n]*[Aa]nimat/);
  });
});
