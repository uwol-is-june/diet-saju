import type { ShareCardModel } from "./card-model";

/**
 * 공유 카드를 브라우저 캔버스에 그린다 (TASK-10).
 *
 * ## 왜 서버(`next/og`)가 아니라 캔버스인가
 *
 * `next/og`(satori)는 **폰트 데이터를 직접 넣어 줘야** 하고 기본 폰트에 한글 글리프가 없다.
 * 한글을 쓰려면 폰트 파일을 저장소에 넣거나 요청마다 받아 와야 한다. 반면 브라우저 캔버스는
 * 사용자가 이미 보고 있는 폰트를 그대로 쓴다 — 의존성도, 폰트 파일도, 서버 왕복도 없다.
 *
 * 부수 효과가 더 중요하다: **원국 데이터가 브라우저를 떠나지 않는다.** 이미지를 만들려고
 * 서버에 다시 보내면 개인정보 처리방침의 처리 경로를 다시 써야 한다.
 *
 * ## 색은 CSS 토큰에서 읽는다
 *
 * hex 를 여기 적으면 `app/globals.css` 단일 소스가 깨진다. 실행 시점에 CSS 변수를 읽어
 * 팔레트를 만들어 넘긴다 (`readPalette`).
 */

/** 인스타그램 세로 비율. 카카오톡·트위터에서도 잘리지 않는다. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const PAD = 72;

export interface CardPalette {
  canvas: string;
  surface: string;
  surfaceInset: string;
  line: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  brand: string;
  brandInk: string;
  brandSubtle: string;
  brandBorder: string;
  ohaeng: Record<string, { bg: string; fg: string }>;
}

const OHAENG_TOKEN: Record<string, string> = {
  목: "mok",
  화: "hwa",
  토: "to",
  금: "geum",
  수: "su",
};

/**
 * 실행 중인 문서에서 시맨틱 토큰을 읽어 팔레트를 만든다.
 * 토큰 이름이 바뀌면 여기가 빈 문자열을 받게 되므로 `app/globals.css` 와 함께 고칠 것.
 */
export function readPalette(element: HTMLElement): CardPalette {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();

  const ohaeng: CardPalette["ohaeng"] = {};
  for (const [element_, token] of Object.entries(OHAENG_TOKEN)) {
    ohaeng[element_] = {
      bg: read(`--color-ohaeng-${token}`),
      fg: read(`--color-ohaeng-${token}-ink`),
    };
  }

  return {
    canvas: read("--color-canvas"),
    surface: read("--color-surface"),
    surfaceInset: read("--color-surface-inset"),
    line: read("--color-line"),
    ink: read("--color-ink"),
    inkSoft: read("--color-ink-soft"),
    inkMuted: read("--color-ink-muted"),
    brand: read("--color-brand"),
    brandInk: read("--color-brand-ink"),
    brandSubtle: read("--color-brand-subtle"),
    brandBorder: read("--color-brand-border"),
    ohaeng,
  };
}

/** 페이지와 같은 글꼴 스택을 쓴다. 카드가 화면과 달라 보이면 어색하다. */
const FONT_STACK =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Malgun Gothic", sans-serif';

const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT_STACK}`;

export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  model: ShareCardModel,
  palette: CardPalette,
): void {
  ctx.fillStyle = palette.canvas;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // ── 머리말 ──
  ctx.fillStyle = palette.brandInk;
  ctx.font = font(30, 700);
  drawTracked(ctx, "DIET SAJU", PAD, 130, 8);

  ctx.fillStyle = palette.ink;
  ctx.font = font(60, 700);
  ctx.fillText(model.typeLabel, PAD, 214);

  ctx.fillStyle = palette.inkMuted;
  ctx.font = font(32);
  ctx.fillText(model.headline, PAD, 272);

  // ── 사주팔자 4기둥 ──
  const boxTop = 336;
  const boxHeight = 300;
  const gap = 20;
  const boxWidth = (CARD_WIDTH - PAD * 2 - gap * 3) / 4;

  model.pillars.forEach((pillar, index) => {
    const x = PAD + index * (boxWidth + gap);
    roundRect(ctx, x, boxTop, boxWidth, boxHeight, 28);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    const center = x + boxWidth / 2;
    ctx.textAlign = "center";

    ctx.fillStyle = palette.inkMuted;
    ctx.font = font(28);
    ctx.fillText(pillar.label, center, boxTop + 62);

    // 간지 2글자는 한 글자씩 세로로 쌓는 것이 만세력 관행이다.
    const isUnknown = pillar.ganji === "미상";
    ctx.fillStyle = isUnknown ? palette.inkMuted : palette.ink;
    if (isUnknown) {
      ctx.font = font(36, 600);
      ctx.fillText("시각", center, boxTop + 150);
      ctx.fillText("미상", center, boxTop + 200);
    } else {
      ctx.font = font(76, 700);
      const [gan, ji] = [...pillar.ganji];
      ctx.fillText(gan ?? "", center, boxTop + 158);
      ctx.fillText(ji ?? "", center, boxTop + 236);
    }

    if (pillar.sipsin) {
      ctx.fillStyle = palette.inkMuted;
      ctx.font = font(26);
      ctx.fillText(pillar.sipsin, center, boxTop + 278);
    }
    ctx.textAlign = "left";
  });

  // ── 오행 배지 ──
  const badgeTop = boxTop + boxHeight + 56;
  const badgeHeight = 88;
  const badgeGap = 16;
  const badgeWidth = (CARD_WIDTH - PAD * 2 - badgeGap * 4) / 5;

  model.badges.forEach((badge, index) => {
    const x = PAD + index * (badgeWidth + badgeGap);
    const colors = palette.ohaeng[badge.element] ?? {
      bg: palette.surfaceInset,
      fg: palette.inkSoft,
    };

    ctx.globalAlpha = badge.count === 0 ? 0.45 : 1;
    roundRect(ctx, x, badgeTop, badgeWidth, badgeHeight, badgeHeight / 2);
    ctx.fillStyle = colors.bg;
    ctx.fill();

    const center = x + badgeWidth / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = colors.fg;
    ctx.font = font(38, 700);
    ctx.fillText(`${badge.element} ${badge.count}`, center, badgeTop + 46);
    ctx.font = font(22);
    ctx.fillText(badge.state, center, badgeTop + 74);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  });

  // ── 판정 칩 ──
  const chipTop = badgeTop + badgeHeight + 64;
  const chipHeight = 96;
  let chipX = PAD;

  ctx.font = font(40, 600);
  for (const chip of model.chips) {
    const width = ctx.measureText(chip).width + 72;
    roundRect(ctx, chipX, chipTop, width, chipHeight, chipHeight / 2);
    ctx.fillStyle = palette.brandSubtle;
    ctx.fill();
    ctx.strokeStyle = palette.brandBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = palette.brandInk;
    ctx.font = font(40, 600);
    ctx.fillText(chip, chipX + 36, chipTop + 62);
    chipX += width + 20;
  }

  // ── 근거 줄 ──
  let noteY = chipTop + chipHeight + 82;
  for (const note of model.notes) {
    ctx.fillStyle = palette.brand;
    roundRect(ctx, PAD, noteY - 16, 8, 8, 4);
    ctx.fill();

    ctx.fillStyle = palette.inkSoft;
    ctx.font = font(32);
    ctx.fillText(note, PAD + 28, noteY);
    noteY += 58;
  }

  // ── 꼬리말 ──
  ctx.fillStyle = palette.brand;
  roundRect(ctx, PAD, CARD_HEIGHT - 176, CARD_WIDTH - PAD * 2, 6, 3);
  ctx.fill();

  ctx.fillStyle = palette.inkSoft;
  ctx.font = font(34, 600);
  ctx.fillText(model.footer, PAD, CARD_HEIGHT - 108);

  ctx.fillStyle = palette.inkMuted;
  ctx.font = font(26);
  ctx.fillText("명리학 해석을 참고한 오락·참고용 콘텐츠 · AI 작성", PAD, CARD_HEIGHT - 62);
}

/** 자간을 벌려 그린다. 캔버스에는 letter-spacing 이 없다. */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
}

/** `roundRect` 미지원 브라우저에서는 각진 사각형으로 떨어진다 (그려지긴 한다). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}
