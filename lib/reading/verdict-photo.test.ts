import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { READING_TYPES } from "../saju/schema";

/**
 * 판정 콜아웃 사진의 슬러그가 **세 곳에서 어긋나지 않는지** 본다 (TASK-90).
 *
 * | 어디 | 무엇 |
 * | --- | --- |
 * | `components/VerdictCallout.tsx` | 판정 축 값 → 슬러그 (화면이 무엇을 부르는가) |
 * | `scripts/fetch-verdict-photos.mjs` | 슬러그 → 검색어 (무엇을 받아 오는가) |
 * | `public/verdict/` | 실제 파일 (무엇이 있는가) |
 *
 * 셋 중 하나만 어긋나면 **그 판정이 나온 사람의 화면에서만** 사진이 깨진다. 21종 중
 * 한 칸이라 개발 중에 눈에 띄지 않고, 판정을 그 칸으로 미는 생일을 일부러 넣어야 보인다.
 * 그래서 사람 눈이 아니라 테스트가 본다.
 *
 * 컴포넌트 쪽은 `Record<축, …>` 라 **값이 빠지면 컴파일이 막지만**, 슬러그 문자열의
 * 오타(`element-su` → `element-so`)는 타입이 잡지 못한다. 그 자리를 이 검사가 메운다.
 */

const ROOT = new URL("../../", import.meta.url);

/**
 * 소스를 **주석을 걷어내고** 읽는다 (`birth-input.test.ts` 와 같은 이유). 아래 검사는
 * "코드가 무엇을 하는가" 를 보는데, 주석은 대개 "무엇을 하지 않기로 했는가" 를 설명하느라
 * 같은 낱말을 쓴다 — 실제로 `priority` 를 주지 않는 이유를 적은 주석이 그 검사에 걸렸다.
 */
function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, ROOT), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * 슬러그는 `<축 접두사>-<이름>` 꼴이다. 접두사를 못 박아 두면 컴포넌트 안의 다른 문자열
 * (`card-photo` 같은 클래스 이름)이 섞이지 않는다.
 *
 * **유형 id 는 뺀다** — `"gain-cause"` 가 같은 꼴이라 `CALLOUT` 의 키가 슬러그로 잡힌다.
 * 목록을 베끼지 않고 `READING_TYPES` 에서 걸러내므로 유형이 늘어도 따라온다.
 */
const SLUG = /"((?:metabolism|gain|approach|element|movement)-[a-z]+)"/g;
const READING_TYPE_IDS = new Set<string>(READING_TYPES);

function slugsIn(source: string): Set<string> {
  return new Set(
    Array.from(source.matchAll(SLUG), (m) => m[1]!).filter((slug) => !READING_TYPE_IDS.has(slug)),
  );
}

const componentSlugs = slugsIn(read("components/VerdictCallout.tsx"));
const scriptSlugs = slugsIn(read("scripts/fetch-verdict-photos.mjs"));

describe("판정 사진 슬러그", () => {
  it("공개 다섯 유형의 판정 칸 수만큼 있다", () => {
    // 대사 기조 2 · 살 붙는 패턴 5 · 접근 순서 4 · 곁들일 계열 6 · 대표 종목 4
    expect(componentSlugs.size).toBe(21);
  });

  it("컴포넌트와 받아 오는 스크립트가 같은 슬러그를 쓴다", () => {
    expect([...componentSlugs].sort()).toEqual([...scriptSlugs].sort());
  });

  it("슬러그마다 `public/verdict/` 에 파일이 있다", () => {
    const missing = [...componentSlugs].filter(
      (slug) => !existsSync(new URL(`public/verdict/${slug}.jpg`, ROOT)),
    );
    expect(missing).toEqual([]);
  });

  it("쓰이지 않는 사진이 남아 있지 않다", () => {
    /* 검색어를 다듬다 슬러그 이름을 바꾸면 옛 파일이 그대로 남는다. 커밋되는 자산이라 잡는다. */
    const files = readdirSync(new URL("public/verdict/", ROOT))
      .filter((name) => name.endsWith(".jpg"))
      .map((name) => name.replace(/\.jpg$/, ""));
    expect(files.filter((slug) => !componentSlugs.has(slug))).toEqual([]);
  });
});

describe("판정 사진 규칙", () => {
  const component = read("components/VerdictCallout.tsx");

  it("장식이므로 alt 이 비어 있다", () => {
    expect(component).toMatch(/alt=""/);
  });

  it("`priority` 를 주지 않는다", () => {
    /*
     * 어느 장이 필요한지는 `chart` 가 와야 안다 — 제출 전에는 preload 할 대상이 없다.
     * 주면 `/reading/*` 첫 화면에서 쓰지도 않을 preload 힌트가 나간다.
     */
    expect(component).not.toMatch(/priority/);
  });

  it("마스크는 globals.css 의 `.card-photo` 를 쓴다", () => {
    /* 임의값으로 흩뿌리면 `/` 리스트 카드와 모양이 갈린다. */
    expect(component).toMatch(/card-photo/);
    expect(component).not.toMatch(/mask-image/);
  });
});

/**
 * 판정 사진과 유형 사진이 **같은 장이 아닌지** 본다 (TASK-94).
 *
 * TASK-92 가 `/` 카드 사진을 `/reading/[type]` 상단 히어로로 올리면서, 두 사진이 **한
 * 화면에 세로로 나란히** 놓이게 됐다. 그때 `movement-rhythm` 이 `/cards/exercise.jpg` 와
 * 같은 Pexels 사진(11513443)이라 **같은 그림이 두 번** 나왔고, 콜아웃이 히어로의 꼬리처럼
 * 읽혔다. 검색어를 갈아 다시 골랐다.
 *
 * **사람 눈으로는 잘 안 잡힌다** — 콜아웃은 실제로 제출해야 뜨고, 21종 중 그 판정이
 * 나오는 생일을 넣어야 그 조합이 화면에 보인다. 그래서 두 `photos.json` 의 id 를 댄다.
 */
describe("판정 사진과 유형 사진은 같은 장이 아니다", () => {
  const ids = (path: string) =>
    Object.entries(
      JSON.parse(readFileSync(new URL(path, ROOT), "utf8")) as Record<string, { id: number }>,
    ).map(([key, value]) => [value.id, key] as const);

  it("두 세트에 겹치는 Pexels id 가 없다", () => {
    const cards = new Map(ids("public/cards/photos.json"));
    const overlap = ids("public/verdict/photos.json")
      .filter(([id]) => cards.has(id))
      .map(([id, slug]) => `${slug} = ${cards.get(id)} (Pexels ${id})`);
    expect(overlap).toEqual([]);
  });
});
