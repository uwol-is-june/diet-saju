"use client";

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
 * 저장한다는 뜻이고 "저장하지 않습니다" 를 무효화하므로 도입하지 않았다 (판단 근거는 TASK.md).
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
      <h2 className="mb-1 text-base font-bold">공유하기</h2>
      <p className="mb-4 text-sm text-ink-muted">
        이미지는 브라우저에서 만들어지고 서버로 전송되지 않습니다. 사주팔자와 오행이 담기므로
        공개된 곳에 올릴 때 참고해 주세요.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={saveImage}
          disabled={busy}
          className="min-h-11 flex-1 rounded-xl bg-brand-solid px-4 py-3 font-semibold text-on-brand-solid transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:bg-brand-solid-disabled disabled:text-on-brand-solid-disabled"
        >
          {busy ? "이미지를 만들고 있습니다…" : "이미지로 저장"}
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="min-h-11 flex-1 rounded-xl border border-line-strong px-4 py-3 font-semibold text-ink-soft transition hover:bg-surface-inset"
        >
          링크 복사
        </button>
      </div>

      {notice && (
        <p role="status" className="mt-3 text-sm text-brand-ink">
          {notice}
        </p>
      )}
    </section>
  );
}
