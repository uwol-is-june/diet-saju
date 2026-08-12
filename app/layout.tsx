import type { Metadata, Viewport } from "next";
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
      <body>{children}</body>
    </html>
  );
}
