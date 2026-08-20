"use client";

import { Button } from "./ui/Button";
import { useState } from "react";
import { buildShareCardModel } from "@/lib/share/card-model";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  drawShareCard,
  readPalette,
} from "@/lib/share/draw-card";
import type { ReadingType, SajuChart } from "@/lib/saju/schema";

/**
 * 결과 공유 (TASK-10).
 *
 * 이미지는 **브라우저에서** 만든다. 원국 데이터가 밖으로 나가지 않으므로 개인정보 처리방침의
 * 처리 경로가 그대로다 (근거는 `lib/share/draw-card.ts`).
 *
 * 링크 복사는 **결과 링크가 아니라 서비스 주소**를 복사한다. 결과 영구 링크는 결과를 서버에
 * 저장한다는 뜻이고 "저장하지 않습니다" 를 무효화하므로 도입하지 않았다
 * (판단 근거는 `CLAUDE.md` 의 "결과 영구 링크(/r/[id])는 도입하지 않았다").
 *
 * ## 버튼 둘은 좁은 화면에서도 한 줄이다 (TASK-88)
 *
 * 예전에는 `flex-col sm:flex-row` 라 **모바일에서만 세로로 쌓였다.** 주 사용자가 모바일인데
 * (CLAUDE.md "모바일이 기본값이다") 거기서만 48px 짜리 큰 면 둘이 위아래로 붙어, 결과를
 * 다 읽고 내려온 자리에서 공유 카드가 화면을 크게 차지했다. 지금은 `grid-cols-2` 로 고정이다.
 *
 * 한 줄에 둘을 넣으면 글자 자리가 절반이 되므로 **라벨을 줄이고 아이콘을 붙였다.**
 * 아이콘은 `aria-hidden` 장식이고 버튼 이름은 옆 글자가 만든다 (`LikeButton` 의 하트와 같다).
 * 진행 중 문구도 `이미지를 만들고 있습니다…` 에서 줄였다 — 그 길이는 한 줄에 들어가지 않는다.
 *
 * **글자만 한 단계 줄인다(`text-sm`).** 부품의 높이 48px · radius 12px 는 그대로다 —
 * 규격을 바꾼 것이 아니라 절반 폭에 라벨을 앉히는 것이다. 360px(가장 좁은 실기기)에서
 * 아이콘 20 + 사이 8 + 글자 + 좌우 여백 32 가 칸 136px 안에 들어가야 하는데, `text-base`
 * 로는 `이미지 저장` 이 그 칸을 넘는다. **`size="compact"` 로 낮추지 않는다** — 그쪽은
 * 40px 이고 손가락으로 누르는 주 동작 자리에는 낮다.
 */
export function ShareActions({
  chart,
  readingType,
}: {
  chart: SajuChart;
  readingType: ReadingType;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveImage() {
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스를 만들 수 없습니다");

      // 글꼴이 준비되기 전에 그리면 대체 글꼴로 렌더된다.
      await document.fonts.ready;
      drawShareCard(ctx, buildShareCardModel(chart, readingType), readPalette(document.body));

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("이미지를 만들 수 없습니다");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "다이어트사주-결과.png";
      link.click();
      URL.revokeObjectURL(url);
      setNotice("이미지를 저장했습니다.");
    } catch (error) {
      console.error("[share] 이미지 저장 실패:", error);
      setNotice("이미지를 만들지 못했습니다. 화면을 캡처해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("링크를 복사했습니다.");
    } catch {
      // 권한이 없거나 보안 컨텍스트가 아니면 클립보드 API 가 막힌다.
      setNotice(`복사가 막혔습니다. 주소를 직접 복사해 주세요: ${url}`);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      {/*
        설명 줄은 없앴다 (TASK-100). 여백은 옆 카드(`OtherReadingLinks`)의
        `mb-1` + `mb-4` 를 합친 값이라 제목과 내용 사이 거리가 그쪽과 같다.
      */}
      <h2 className="mb-4 text-base font-bold">공유하기</h2>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="gap-2 whitespace-nowrap"
          onClick={saveImage}
          disabled={busy}
        >
          <DownloadIcon />
          <span className="text-sm">{busy ? "만드는 중…" : "이미지 저장"}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2 whitespace-nowrap"
          onClick={copyLink}
        >
          <LinkIcon />
          <span className="text-sm">링크 복사</span>
        </Button>
      </div>

      {notice && (
        <p role="status" className="mt-3 text-sm text-brand-ink">
          {notice}
        </p>
      )}
    </section>
  );
}

/**
 * 아이콘 둘 — `aria-hidden` 장식이다. 색은 `currentColor` 라 버튼 variant 를 그대로 따른다
 * (`tokens.test.ts` 가 이 파일에서 원시 색상을 찾으므로 값을 박지 말 것).
 * 모양·굵기는 `ScrollToTop` 의 화살표와 같은 규격이다.
 */
function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d="M10 13.5a4 4 0 0 0 5.7.4l3-3a4 4 0 0 0-5.7-5.7L11.3 6.9" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" />
    </svg>
  );
}
