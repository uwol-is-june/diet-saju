import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 컬러 토큰 검증 (TASK-16).
 *
 * `app/globals.css` 를 **파싱해서** 검사한다. 값을 여기 복사해 두면 한쪽이 반드시 낡으므로,
 * CSS 를 단일 소스로 두고 테스트는 그걸 읽는다.
 *
 * 검사 두 가지
 *  1. 실제로 쓰이는 배경·전경 조합이 WCAG AA 를 넘는지
 *  2. 컴포넌트에 raw hex / Tailwind 기본 색상이 남아 있지 않은지 (TASK-16 완료 기준)
 */

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/** `--raw-*` 원시 팔레트를 읽는다 */
function readRawPalette(): Record<string, string> {
  const palette: Record<string, string> = {};
  for (const match of CSS.matchAll(/(--raw-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    palette[match[1]!] = match[2]!;
  }
  return palette;
}

/** `--color-*` 시맨틱 토큰을 원시 팔레트까지 따라가 실제 hex 로 해석한다 */
function readSemanticTokens(): Record<string, string> {
  const raw = readRawPalette();
  const tokens: Record<string, string> = {};
  for (const match of CSS.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    const trimmed = value!.trim();
    const varMatch = /^var\((--raw-[\w-]+)\)$/.exec(trimmed);
    if (varMatch) {
      const resolved = raw[varMatch[1]!];
      if (resolved) tokens[name!] = resolved;
    } else if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      tokens[name!] = trimmed;
    }
  }
  return tokens;
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const body = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(body.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [brighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (brighter + 0.05) / (darker + 0.05);
}

const tokens = readSemanticTokens();
const raw = readRawPalette();

function hex(token: string): string {
  const value = tokens[token];
  if (!value) throw new Error(`토큰을 찾지 못했습니다: ${token} (globals.css 확인)`);
  return value;
}

describe("토큰 정의", () => {
  it("원시 팔레트가 읽힌다", () => {
    expect(Object.keys(raw).length).toBeGreaterThan(15);
  });

  it("모든 시맨틱 토큰이 hex 로 해석된다", () => {
    // var() 참조가 깨지면 여기서 잡힌다
    const expected = [
      "--color-brand", "--color-brand-hover", "--color-brand-subtle", "--color-brand-border",
      "--color-brand-ink", "--color-on-brand",
      "--color-brand-solid", "--color-brand-solid-hover", "--color-on-brand-solid",
      "--color-brand-solid-disabled", "--color-on-brand-solid-disabled",
      "--color-canvas", "--color-surface", "--color-surface-muted", "--color-surface-inset",
      "--color-ink", "--color-ink-soft", "--color-ink-muted", "--color-ink-placeholder",
      "--color-line", "--color-line-strong",
      "--color-link", "--color-danger", "--color-danger-subtle", "--color-danger-ink",
      "--color-warning", "--color-warning-subtle", "--color-warning-ink",
      "--color-ohaeng-mok", "--color-ohaeng-mok-ink",
      "--color-ohaeng-hwa", "--color-ohaeng-hwa-ink",
      "--color-ohaeng-to", "--color-ohaeng-to-ink",
      "--color-ohaeng-geum", "--color-ohaeng-geum-ink",
      "--color-ohaeng-su", "--color-ohaeng-su-ink",
    ];
    for (const token of expected) {
      expect(tokens[token], `${token} 미해석`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("대비비 — 본문 텍스트 (AA 4.5:1)", () => {
  const pairs: [string, string, string][] = [
    ["본문", "--color-ink", "--color-surface"],
    ["본문 on canvas", "--color-ink", "--color-canvas"],
    ["보조 텍스트", "--color-ink-soft", "--color-surface"],
    /*
      사진 위에 얹히는 뒤로가기 버튼 (TASK-97 · `Button` 의 `surface` variant). 그 꼴은
      **자기 면(`canvas`)을 들고 가므로** 아이콘이 놓이는 면이 사진이 아니다 — 그래서
      대비를 여기서 잴 수 있다. 이 조합이 깨지면 사진 위의 아이콘부터 안 보인다.
    */
    ["보조 on canvas", "--color-ink-soft", "--color-canvas"],
    ["약한 텍스트", "--color-ink-muted", "--color-surface"],
    ["보조 on muted 배경", "--color-ink-soft", "--color-surface-muted"],
    ["약한 on inset 배경", "--color-ink-muted", "--color-surface-inset"],
    ["링크", "--color-link", "--color-surface"],
    ["링크 on canvas", "--color-link", "--color-canvas"],
    ["브랜드 텍스트", "--color-brand-ink", "--color-surface"],
    ["브랜드 텍스트 on subtle", "--color-brand-ink", "--color-brand-subtle"],
    ["에러 텍스트", "--color-danger-ink", "--color-surface"],
    ["에러 텍스트 on subtle", "--color-danger-ink", "--color-danger-subtle"],
    ["경고 텍스트 on subtle", "--color-warning-ink", "--color-warning-subtle"],
    /*
      셸 바깥 바닥 (TASK-74). 좌측 패널의 카피·QR 라벨이 이 면 위에 **직접** 얹히므로
      본문 대비를 실제로 재야 한다 — 카드가 아니라 맨 배경 위의 글자다.
    */
    ["본문 on canvas-outer", "--color-ink", "--color-canvas-outer"],
    ["보조 on canvas-outer", "--color-ink-soft", "--color-canvas-outer"],
    ["약한 on canvas-outer", "--color-ink-muted", "--color-canvas-outer"],
  ];

  it.each(pairs)("%s", (_label, fg, bg) => {
    expect(contrast(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("대비비 — 연한 브랜드 면 (AA 4.5:1)", () => {
  // `--color-brand`(green500)는 채운 버튼이 아니라 연한 강조 면·커서·링에 쓴다.
  it("브랜드 면 위 on-brand 텍스트", () => {
    // green500 은 밝아서 흰 텍스트가 1.82:1 이다. 어두운 잉크를 쓰는 이유.
    expect(contrast(hex("--color-on-brand"), hex("--color-brand"))).toBeGreaterThanOrEqual(4.5);
  });

  it("흰 텍스트는 브랜드 면에서 쓸 수 없다", () => {
    // 이 단정이 깨지면(=흰 텍스트가 통과하면) 팔레트가 어두워진 것이다.
    // 그때는 --color-on-brand 를 흰색으로 되돌릴 수 있다.
    // 채운 버튼은 별도 토큰(--color-brand-solid)을 쓰므로 여기 영향을 받지 않는다.
    expect(contrast("#FFFFFF", hex("--color-brand"))).toBeLessThan(4.5);
  });

  it("brand-hover 면도 통과한다", () => {
    expect(contrast(hex("--color-on-brand"), hex("--color-brand-hover"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

/**
 * 주 액션 버튼 — **검정 면** (TASK-75). dasii 의 `default` variant 를 받았다.
 * TASK-71 이 green 을 유지한 이유는 "새 토큰과 대비 검증이 필요해서" 였고,
 * 그 검증이 여기다.
 */
describe("대비비 — 검정 채운 버튼 (AA 4.5:1, TASK-75)", () => {
  it("기본 상태", () => {
    expect(contrast(hex("--color-on-ink-solid"), hex("--color-ink-solid"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("hover 상태", () => {
    expect(
      contrast(hex("--color-on-ink-solid"), hex("--color-ink-solid-hover")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("hover 가 기본보다 밝다", () => {
    // 검정 면은 더 어두워질 자리가 없다. 그래서 hover 는 **밝은** 쪽으로 간다 —
    // 초록 버튼(어두워짐)과 방향이 반대인 것이 의도다.
    expect(luminance(hex("--color-ink-solid-hover"))).toBeGreaterThan(
      luminance(hex("--color-ink-solid")),
    );
  });

  it("비활성 조합은 초록 버튼과 같은 것을 쓴다", () => {
    // 면을 비우는 방식이라 면 색이 밝다 — 검정이든 초록이든 비활성 처리는 하나다.
    expect(
      contrast(hex("--color-on-brand-solid-disabled"), hex("--color-brand-solid-disabled")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("비활성이 기본과 밝기로 구분된다", () => {
    expect(
      contrast(hex("--color-ink-solid"), hex("--color-brand-solid-disabled")),
    ).toBeGreaterThanOrEqual(3);
  });
});

/**
 * 사진 위 흰 글씨 (TASK-109).
 *
 * **팔레트 검사가 닿지 않는 자리다** — 배경이 토큰이 아니라 사진이다. 그래서 여기서 재는
 * 것은 색 조합이 아니라 **스크림의 알파**다: 최악의 사진(흰 면) 위에 그 알파의 검정을
 * 얹은 색을 계산해서 그 위의 흰 글씨가 AA 를 넘는지 본다. 검사를 새로 만들지 않으면
 * 아무도 이 자리를 지키지 않는다.
 */
describe("대비비 — 판정 콜아웃의 사진 위 흰 글씨 (AA 4.5:1, TASK-109)", () => {
  /** `.verdict-cover` 의 평평한 어둠. 카드 어디서도 이 값 아래로 내려가지 않는다. */
  function readScrimAlpha(): number {
    const match = /--verdict-scrim:\s*([\d.]+)\s*;/.exec(CSS);
    if (!match) throw new Error("--verdict-scrim 을 찾지 못했습니다 (globals.css 확인)");
    return Number(match[1]);
  }

  /** `.verdict-cover::after` 의 배경에 쓰인 색 목록 (그라데이션 정지점까지 전부) */
  function readScrimLayers(): [number, number, number, number][] {
    const block = /\.verdict-cover::after\s*\{([\s\S]*?)\}/.exec(CSS);
    if (!block) throw new Error(".verdict-cover::after 를 찾지 못했습니다");
    return [...block[1]!.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+|var\([^)]+\))\s*\)/g)].map(
      (m) =>
        [Number(m[1]), Number(m[2]), Number(m[3]), m[4]!.startsWith("var") ? 1 : Number(m[4])] as [
          number,
          number,
          number,
          number,
        ],
    );
  }

  /** 흰 면 위에 알파 `a` 의 검정을 얹은 색 — 이 카드가 만날 수 있는 **가장 밝은 배경**이다. */
  function worstBackground(alpha: number): string {
    const value = Math.round(255 * (1 - alpha));
    return `#${value.toString(16).padStart(2, "0").repeat(3)}`;
  }

  /** 반투명 흰 글씨의 실효 색 — 배경 위에 얹혀 합성된 결과로 대비를 재야 한다. */
  function blendWhite(alpha: number, background: string): string {
    const body = background.replace("#", "");
    const channels = [0, 2, 4].map((i) => {
      const base = parseInt(body.slice(i, i + 2), 16);
      return Math.round(255 * alpha + base * (1 - alpha));
    });
    return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }

  /** `--color-on-photo-dim` 의 알파. `rgba()` 라 `readSemanticTokens` 가 hex 로 풀지 못한다. */
  function readDimAlpha(): number {
    const match = /--color-on-photo-dim:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/.exec(
      CSS,
    );
    if (!match) throw new Error("--color-on-photo-dim 을 찾지 못했습니다");
    return Number(match[1]);
  }

  const scrim = readScrimAlpha();
  const worst = worstBackground(scrim);

  it("최악의 사진(흰 면)에서도 흰 글씨가 AA 를 넘는다", () => {
    expect(contrast(hex("--color-on-photo"), worst)).toBeGreaterThanOrEqual(4.5);
  });

  it("흐린 흰 글씨도 같은 면에서 AA 를 넘는다", () => {
    // 카드뉴스의 흰색 0.62 를 그대로 가져오면 여기서 걸린다 (2.8:1).
    expect(contrast(blendWhite(readDimAlpha(), worst), worst)).toBeGreaterThanOrEqual(4.5);
  });

  it("스크림 알파가 흰 글씨 AA 의 하한을 넘는다", () => {
    // 위 두 검사와 같은 것을 **반대 방향**으로 잰다 — 알파를 내리면 어느 값에서 깨지는지
    // 이 단정이 알려 준다. 상한 배경 밝기는 흰 글씨 4.5:1 을 만족하는 가장 밝은 회색이다.
    let brightest = 255;
    while (contrast("#FFFFFF", worstBackground(1 - brightest / 255)) < 4.5) brightest -= 1;
    expect(scrim).toBeGreaterThanOrEqual(1 - (brightest + 1) / 255);
  });

  it("그라데이션 층은 어둠만 더한다", () => {
    // 흰색·유채색 층이 섞이면 평평한 어둠이 하한이라는 근거가 무너진다.
    for (const [r, g, b] of readScrimLayers()) {
      expect([r, g, b]).toEqual([0, 0, 0]);
    }
    expect(readScrimLayers().length).toBeGreaterThan(1);
  });
});

describe("대비비 — 채운 버튼 (AA 4.5:1, TASK-21)", () => {
  it("기본 상태", () => {
    expect(
      contrast(hex("--color-on-brand-solid"), hex("--color-brand-solid")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("hover 상태", () => {
    expect(
      contrast(hex("--color-on-brand-solid"), hex("--color-brand-solid-hover")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("비활성 상태", () => {
    expect(
      contrast(hex("--color-on-brand-solid-disabled"), hex("--color-brand-solid-disabled")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("hover 가 기본보다 어둡다", () => {
    // "hover 인데 더 밝아짐" 같은 실수를 막는다.
    expect(luminance(hex("--color-brand-solid-hover"))).toBeLessThan(
      luminance(hex("--color-brand-solid")),
    );
  });

  it("비활성이 기본과 밝기로 구분된다", () => {
    // 색상(초록↔회색)만으로 구분되면 색각 이상에서 같아 보인다. 명도차를 강제한다.
    // 회색으로 "채우는" 방식이 여기서 걸린다 — gray500 은 green700 과 1.07:1 이다.
    expect(
      contrast(hex("--color-brand-solid"), hex("--color-brand-solid-disabled")),
    ).toBeGreaterThanOrEqual(3);
  });

  it("중간 밝기 초록에는 어느 글씨색도 통과하지 않는 사각지대가 있다", () => {
    // TASK-21 의 핵심 근거. "조금만 어둡게" 로 타협하면 더 나빠진다는 것을 고정해 둔다.
    const midGreen = "#1F9155";
    expect(contrast("#FFFFFF", midGreen)).toBeLessThan(4.5);
    expect(contrast(hex("--color-ink"), midGreen)).toBeLessThan(4.5);
  });
});

describe("대비비 — 오행 배지 (AA 4.5:1)", () => {
  it.each(["mok", "hwa", "to", "geum", "su"])("%s 배지", (element) => {
    const bg = hex(`--color-ohaeng-${element}`);
    const fg = hex(`--color-ohaeng-${element}-ink`);
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("다섯 배지 배경이 서로 구분된다", () => {
    const backgrounds = ["mok", "hwa", "to", "geum", "su"].map((e) => hex(`--color-ohaeng-${e}`));
    expect(new Set(backgrounds).size).toBe(5);
  });
});

/*
 * 캐릭터 면(`--color-seat-*` · `--color-character-*`) 검사는 **지웠다** (TASK-92).
 * 캐릭터가 히어로 사진으로 바뀌어 토큰 자체가 없어졌다 — 남겨 두면 없는 토큰을 재는
 * 검사가 된다. 사진 안의 색은 이 파일이 닿지 않는 자리이고(감수한 값 · TASK-86)
 * 대신 **글자를 사진 위에 얹지 않는다**가 그 자리를 지킨다.
 */

describe("대비비 — UI 경계 (1.4.11, 3:1)", () => {
  it("폼 컨트롤 테두리는 3:1 을 넘는다", () => {
    expect(contrast(hex("--color-line-strong"), hex("--color-surface"))).toBeGreaterThanOrEqual(3);
  });

  it("장식용 구분선은 3:1 을 요구하지 않는다", () => {
    // --color-line 은 의미 전달용이 아니다. 폼 컨트롤에 쓰면 안 된다는 것을 명시해 둔다.
    expect(contrast(hex("--color-line"), hex("--color-surface"))).toBeLessThan(3);
  });
});

/**
 * 가로 스크롤러 (TASK-43).
 *
 * 브라우저 기본 스크롤바를 그대로 쓰면 팔레트 밖 회색이 하나 생긴다. 규칙이 `globals.css`
 * 한 곳에 있는지와 **두 벌(표준·webkit)이 같은 색을 쓰는지**를 여기서 고정한다.
 */
describe("가로 스크롤러 (.scroller-x)", () => {
  const blocks = [...CSS.matchAll(/\.scroller-x[^{]*\{([^}]*)\}/g)].map((m) => m[1]!);

  it("규칙 블록을 읽어 온다", () => {
    expect(blocks.length).toBeGreaterThan(1);
  });

  it("표준 속성과 webkit 의사요소를 둘 다 둔다", () => {
    // 하나만 두면 한쪽 브라우저(구형 사파리 또는 Firefox)에서 OS 기본 스크롤바가 남는다.
    expect(CSS).toMatch(/\.scroller-x\s*\{[^}]*scrollbar-width:/);
    expect(CSS).toMatch(/\.scroller-x\s*\{[^}]*scrollbar-color:/);
    expect(CSS).toMatch(/\.scroller-x::-webkit-scrollbar-thumb\s*\{/);
  });

  it("표준과 webkit 이 같은 막대 색을 쓴다", () => {
    // 두 벌이 어긋나면 브라우저마다 다른 색으로 보인다.
    const standard = /scrollbar-color:\s*var\((--color-[\w-]+)\)/.exec(CSS)?.[1];
    const webkit = /::-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\((--color-[\w-]+)\)/.exec(
      CSS,
    )?.[1];
    expect(standard).toBeDefined();
    expect(webkit).toBe(standard);
  });

  it("색이 시맨틱 토큰에서만 온다", () => {
    for (const body of blocks) {
      expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      // 원시 팔레트를 직접 참조하면 2층 구조가 깨진다.
      expect(body).not.toMatch(/var\(--raw-/);
    }
  });

  it("카드 줄과 스크롤바 사이에 여백이 있다", () => {
    // 스크롤바는 패딩 박스 밖의 거터에 그려지므로 카드의 `mb-*` 로는 간격이 생기지 않는다.
    expect(CSS).toMatch(/\.scroller-x\s*\{[^}]*padding-bottom:/);
  });
});

/**
 * 미리 렌더해 커밋하는 정적 이미지의 원본들. CSS 를 import 할 수 없어 팔레트 값을
 * **복사해 쓰므로** 여기서 원본과 대조해 드리프트를 막는다.
 *
 * - `og-card.html` → `app/opengraph-image.png` (TASK-10)
 * - `icon.html` → `app/icon.png` · `apple-icon.png` · `favicon.ico` (TASK-26)
 */
describe.each([
  ["og-card.html", "docs/og-card.html"],
  ["icon.html", "docs/icon.html"],
])("%s 팔레트가 globals.css 와 같다", (_label, path) => {
  const HTML = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const declared = [...HTML.matchAll(/(--raw-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)];

  it("팔레트 선언을 읽어 온다", () => {
    expect(declared.length).toBeGreaterThan(1);
  });

  it.each(declared.map((m) => [m[1]!, m[2]!]))("%s 가 원본과 일치한다", (name, value) => {
    expect(raw[name], `${name} 이 globals.css 에 없다`).toBeDefined();
    expect(value.toLowerCase()).toBe(raw[name]!.toLowerCase());
  });

  it("팔레트 선언 밖에서 hex 를 쓰지 않는다", () => {
    // 흰색(#ffffff)은 토큰이 아니라 "그 위에 올리는 글자색" 이라 예외로 둔다.
    const allowed = new Set([...declared.map((m) => m[2]!.toLowerCase()), "#ffffff"]);
    const all = [...HTML.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]!.toLowerCase());
    expect(all.filter((hex) => !allowed.has(hex))).toEqual([]);
  });
});

describe("완료 기준 — 컴포넌트에 raw 색상이 없다", () => {
  const sources = [
    "app/page.tsx",
    "app/layout.tsx",
    "app/admin/page.tsx",
    "app/reading/[type]/page.tsx",
    "components/SajuForm.tsx",
    "components/ResultView.tsx",
    "components/ReadingSections.tsx",
    "components/ShareActions.tsx",
    "components/SiteFooter.tsx",
    // 셸 (TASK-74) — 좌측 패널은 인라인 SVG 라 fill/stroke 에 hex 가 새기 쉽다
    "components/AppPanel.tsx",
    // 부품 (TASK-75) — 규격의 단일 소스라 여기에 hex 가 새면 화면 전체가 새는 것과 같다
    "components/ui/Button.tsx",
    "components/ui/field.ts",
    "components/ui/ChoiceChips.tsx",
    "components/FirstVisitNotice.tsx",
    /* 뒤로가기 (TASK-93) — 인라인 SVG 라 stroke 에 hex 가 새기 쉽다.
       색은 `currentColor` 여야 variant 를 따른다 */
    "components/BackLink.tsx",
    "components/OtherReadingLinks.tsx",
    "components/ScrollToTop.tsx",
    "components/LikeButton.tsx",
    "components/VerdictCallout.tsx",
    // 도식 (TASK-25) — SVG 의 fill/stroke 도 토큰에서만 온다
    "components/charts/OhaengBars.tsx",
    "components/charts/OhaengCycle.tsx",
    "components/charts/ThermalScale.tsx",
    "components/charts/DaeunTimeline.tsx",
    /* 유형 리스트 카드의 사진 (TASK-86) — 사진 안의 색은 이 검사가 닿지 않지만
       카드 면·글자·화살표는 여전히 토큰에서만 온다 */
    "components/ReadingCardPhoto.tsx",
    /* 히어로 사진 (TASK-92) — 마스크는 `globals.css` 의 `.hero-photo` 가 걸고
       이 파일에는 색이 없어야 한다 */
    "components/ReadingHeroPhoto.tsx",
    // 캔버스 카드도 색을 CSS 토큰에서 읽는다. hex 를 박으면 단일 소스가 깨진다.
    "lib/share/draw-card.ts",
  ];

  it.each(sources)("%s 에 hex 리터럴이 없다", (path) => {
    const code = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it.each(sources)("%s 에 Tailwind 기본 색상 유틸리티가 없다", (path) => {
    const code = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    const builtins =
      /\b(?:bg|text|border|ring|accent|divide|outline|placeholder|caret|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
    expect(code).not.toMatch(builtins);
  });
});
