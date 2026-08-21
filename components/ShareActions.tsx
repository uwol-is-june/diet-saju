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
 * 결과 공유. 이미지는 **브라우저에서** 만든다 — 원국 데이터가 밖으로 나가지 않으므로
 * 처리방침의 처리 경로가 그대로다 (근거는 `lib/share/draw-card.ts`).
 *
 * 링크 복사는 **결과 링크가 아니라 서비스 주소**다. 결과 영구 링크는 결과를 서버에 저장한다는
 * 뜻이고 "저장하지 않습니다" 를 무효화하므로 도입하지 않았다.
 *
 * **버튼 둘은 어느 폭에서도 한 줄이다** (`grid-cols-2`). 예전에는 모바일에서만 세로로
 * 쌓여, 주 사용자가 있는 쪽에서만 48px 짜리 큰 면 둘이 화면을 차지했다.
 *
 * 절반 폭에 앉히느라 **라벨을 줄이고 아이콘을 붙였다** (아이콘은 `aria-hidden` 장식이고
 * 버튼 이름은 옆 글자가 만든다).
 *
 * **글자만 `text-sm` 으로 내리고 부품 규격(48px · radius 12px)은 그대로다.**
 * **`size="compact"` 로 낮추지 않는다** — 40px 이라 손가락으로 누르는 자리에는 낮다.
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

      const model = buildShareCardModel(chart, readingType);
      /*
        판정 사진은 **우리 도메인 자산**이라 캔버스가 오염되지 않는다 — `toBlob` 이 그대로
        된다 (제3자 URL 을 물면 여기서 보안 오류가 난다). 사진을 못 받으면 그리기를 멈추지
        않고 **연한 면 꼴로 떨어진다** — 내부 유형이 쓰는 그 꼴이다.
      */
      const photo = model.photo ? await loadImage(`/verdict/${model.photo}.jpg`) : null;
      drawShareCard(ctx, model, readPalette(document.body), photo);

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
 * 사진 한 장을 기다린다. **실패해도 예외를 올리지 않는다** — 이미지 저장이 통째로 실패하는
 * 것보다 사진 없는 카드가 낫다 (그 꼴은 내부 유형이 이미 쓰고 있다).
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * 아이콘 둘 — `aria-hidden` 장식이고 색은 `currentColor` 다.
 * **값을 박지 말 것** (`tokens.test.ts` 가 이 파일에서 원시 색상을 찾는다).
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
