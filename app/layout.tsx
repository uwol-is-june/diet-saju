import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "다이어트 사주 | 사주로 읽는 나의 기질",
  description:
    "생년월일시로 사주 원국을 계산하고, 오행 균형을 바탕으로 기질과 생활 습관을 풀어드립니다.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <SiteFooter />
        {/*
          방문 통계 (TASK-13). 쿠키를 쓰지 않고 개별 방문자를 식별하지 않는다 —
          수집 항목은 app/privacy/page.tsx 6항에 그대로 적어 뒀다.
          이 서비스의 URL 에는 쿼리 파라미터가 없어 생년월일이 경로로 새지 않는다.
          `/api/*` 는 클라이언트 스크립트가 붙지 않으므로 계측 대상이 아니다.
        */}
        <Analytics />
      </body>
    </html>
  );
}
