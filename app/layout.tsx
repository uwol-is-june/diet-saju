import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const TITLE = "다이어트 사주 | 사주로 읽는 나의 기질";
const DESCRIPTION =
  "생년월일시로 사주 원국을 계산하고, 오행 균형을 바탕으로 기질과 생활 습관을 풀어드립니다.";

export const metadata: Metadata = {
  /**
   * OG 이미지 경로를 절대 URL 로 만드는 데 쓰인다. 없으면 Next 가 경고를 내고
   * 상대 경로를 내보내는데, 카카오톡·트위터 크롤러는 상대 경로를 못 읽는다.
   */
  metadataBase: new URL("https://diet-saju.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  /**
   * 공유 카드 (TASK-10). 이미지는 `app/opengraph-image.png` 를 Next 가 자동으로 붙인다.
   * **개인 결과가 아니라 서비스 소개 카드다** — 결과별 카드는 결과를 서버에 저장해야
   * 만들 수 있고 그건 "저장하지 않습니다" 를 무효화한다. 개인 결과는 이미지 저장으로 공유한다.
   */
  openGraph: {
    type: "website",
    siteName: "다이어트 사주",
    locale: "ko_KR",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
