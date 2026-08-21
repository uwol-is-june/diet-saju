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

/** 사진(또는 연한 면)이 차지하는 높이. 아래는 근거 자리다. */
const COVER_HEIGHT = 860;

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
  onPhoto: string;
  onPhotoDim: string;
  /** 사진 위 어둠의 알파. **화면과 같은 값이어야 한다** (`:root` 의 `--verdict-scrim`). */
  scrim: number;
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
    onPhoto: read("--color-on-photo"),
    onPhotoDim: read("--color-on-photo-dim"),
    // 값이 없으면 **더 어두운 쪽으로** 떨어진다 — 대비의 하한을 넘기는 방향이다.
    scrim: Number(read("--verdict-scrim")) || 0.62,
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
  photo?: CanvasImageSource | null,
): void {
  ctx.fillStyle = palette.canvas;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  /*
    ── 위: 판정 한 줄 (화면 콜아웃과 같은 꼴) ──

    사진이 있으면 **사진 전면 + 어둠 + 흰 글씨**이고 없으면 연한 브랜드 면이다.
    갈리는 지점이 `model.photo` 하나뿐인 것도 화면과 같다 (`VerdictCallout`).

    **어둠의 알파는 화면과 같은 값을 쓴다** (`palette.scrim`). 최악의 사진(흰 면) 위에서도
    흰 글씨가 AA 를 넘는다는 근거가 `tokens.test.ts` 에 있고, 여기서 값을 따로 정하면
    그 근거가 이 카드에는 적용되지 않는다.
  */
  if (photo) {
    drawCover(ctx, photo, 0, 0, CARD_WIDTH, COVER_HEIGHT);
    ctx.fillStyle = `rgba(0, 0, 0, ${palette.scrim})`;
    ctx.fillRect(0, 0, CARD_WIDTH, COVER_HEIGHT);
  } else {
    ctx.fillStyle = palette.brandSubtle;
    ctx.fillRect(0, 0, CARD_WIDTH, COVER_HEIGHT);
  }

  const onCover = photo ? palette.onPhoto : palette.brandInk;
  const onCoverDim = photo ? palette.onPhotoDim : palette.inkSoft;

  ctx.fillStyle = photo ? palette.onPhotoDim : palette.brandInk;
  ctx.font = font(28, 700);
  drawTracked(ctx, "DIET SAJU", PAD, 108, 8);

  // 글은 **아래로 모은다** — 위쪽을 사진 몫으로 남기는 것이 화면 콜아웃과 같은 배치다.
  ctx.fillStyle = onCoverDim;
  ctx.font = font(34, 600);
  ctx.fillText(model.eyebrow, PAD, COVER_HEIGHT - 232);

  ctx.fillStyle = onCover;
  ctx.font = font(86, 800);
  const labelBottom = drawWrapped(ctx, model.label, PAD, COVER_HEIGHT - 148, CARD_WIDTH - PAD * 2, 96);

  ctx.fillStyle = onCoverDim;
  ctx.font = font(32);
  drawWrapped(ctx, model.basis, PAD, labelBottom + 58, CARD_WIDTH - PAD * 2, 46);

  /*
    ── 아래: 근거 (오행 막대) ──

    **간지를 한 자도 싣지 않는다** (TASK-116). 오행 개수는 그 자체로는 생년월일시를 되짚을
    수 없고, 화면의 오행 막대와 같은 시각 언어를 카드에 남기는 값이다.
  */
  ctx.fillStyle = palette.inkSoft;
  ctx.font = font(32, 600);
  ctx.fillText(model.headline, PAD, COVER_HEIGHT + 92);

  const badgeTop = COVER_HEIGHT + 148;
  const badgeHeight = 88;
  const BADGE_BAR_HEIGHT = 12;
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

    /*
      배지 아래 세력 막대 — 길이의 근거는 우리 관례(계절 배수)라 **숫자는 찍지 않고
      길이로만** 말한다. 개수 0 이면 아예 그리지 않는다 (1px 조각이 남으면 "조금 있다" 로
      읽힌다).
    */
    const barY = badgeTop + badgeHeight + 14;
    roundRect(ctx, x, barY, badgeWidth, BADGE_BAR_HEIGHT, BADGE_BAR_HEIGHT / 2);
    ctx.fillStyle = palette.surfaceInset;
    ctx.fill();

    if (badge.count > 0) {
      roundRect(
        ctx,
        x,
        barY,
        Math.max(badgeWidth * badge.weight, BADGE_BAR_HEIGHT),
        BADGE_BAR_HEIGHT,
        BADGE_BAR_HEIGHT / 2,
      );
      ctx.fillStyle = colors.fg;
      ctx.fill();
    }
  });

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

/**
 * 사진을 슬롯에 **꽉 채워** 그린다 (`object-fit: cover` 와 같은 계산). 원본은 정사각
 * 480×480 이고 슬롯은 가로로 기니 위아래가 잘린다 — 크롭 위치는 화면(`.verdict-photo`)과
 * 같은 **한 값(가운데)** 이다.
 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const size = imageSize(image);
  if (!size) return;
  const scale = Math.max(width / size.width, height / size.height);
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;

  /*
    **슬롯 밖으로 넘치는 부분을 잘라낸다.** 정사각 원본을 가로로 긴 슬롯에 채우면 위아래로
    넘치는데, 어둠은 슬롯 안에만 깔리므로 잘라내지 않으면 **넘친 사진이 아래 근거 자리를
    덮는다** (실제로 띠·계절 줄이 사진에 묻혔다).
  */
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  ctx.restore();
}

function imageSize(image: CanvasImageSource): { width: number; height: number } | null {
  if ("naturalWidth" in image && image.naturalWidth) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  if ("width" in image && typeof image.width === "number" && image.width) {
    return { width: image.width, height: image.height as number };
  }
  return null;
}

/**
 * 글을 폭에 맞춰 접는다. **캔버스에는 줄바꿈이 없다** — 라벨이 길면(`팥과 수수를 곁들이기`)
 * 한 줄로 그리다 카드 밖으로 나간다. 마지막 줄의 y 를 돌려주어 다음 글이 그 아래에 앉는다.
 */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
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
