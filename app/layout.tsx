import type { Metadata, Viewport } from "next";
import { AppPanel } from "@/components/AppPanel";
import { BirthInputProvider } from "@/components/BirthInputProvider";
import { ScrollToTop } from "@/components/ScrollToTop";
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
      {/*
        방문 통계 스크립트를 붙이지 않는다 (2026-08-13 확정 · 근거는 CLAUDE.md).
        서버 운영 로그만 남기며 수집 항목은 app/privacy/page.tsx 6항에 있다.
      */}
      {/*
        셸은 `body` 직계 셋이다 (TASK-74 · 레퍼런스 web.dasii.kr 구조).
        좌측 패널 · 콘텐츠 열 · 빈 균형추. **셋 다 서버 컴포넌트여야 한다** — 상태를
        하나라도 들면 `/` 를 통째로 정적으로 두는 성질이 깨진다.

        바닥은 `canvas-outer`(green50)이고 콘텐츠 열만 흰 면이다. 모바일에서는 열이
        화면을 꽉 채우므로 이 바닥이 드러나지 않는다.
      */}
      <body className="flex items-start bg-canvas-outer">
        <AppPanel />

        {/*
          콘텐츠 열. **`<main>` 은 레이아웃이 소유한다** — 페이지가 각자 `<main>` 을 내면
          중첩 `main` 이 된다. 그래서 다섯 페이지에서 그 껍데기를 걷어냈다.

          `min-h-dvh` 는 `vh` 가 아니다 — 모바일 주소창 때문에 `vh` 는 튄다
          (CLAUDE.md "모바일이 기본값이다").
        */}
        <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-canvas shadow-sm">
          {/*
            입력값을 **루트 레이아웃의 메모리에** 둔다 (TASK-30). 레이아웃은 이동에서
            다시 렌더되지 않으므로 `/` ↔ `/reading/*` 사이에 값이 남는다.
            `app/reading/layout.tsx` 로 내리면 `/` 를 거쳐 갈 때 언마운트되어 값이 날아간다.
            저장소·URL 로 옮기면 개인정보 처리방침을 같은 커밋에서 고쳐야 한다.
          */}
          <main className="w-full flex-1 px-5 py-10">
            <BirthInputProvider>{children}</BirthInputProvider>
          </main>
          <SiteFooter />
          {/* 모든 페이지에서 동작한다 — 면책 고지·개인정보 처리방침도 길다 (TASK-29).
              열 안에 두어야 데스크톱에서 뷰포트 끝이 아니라 **열 오른쪽**에 붙는다. */}
          <ScrollToTop />
        </div>

        {/*
          **빈 균형추를 지우지 말 것.** 없으면 콘텐츠 열이 화면 가운데가 아니라 좌측 패널
          옆에 붙는다 (좌측이 `flex-1` 이므로 오른쪽에도 같은 `flex-1` 이 있어야 한다).
        */}
        <div aria-hidden className="sticky top-0 hidden h-dvh flex-1 xl:block" />
      </body>
    </html>
  );
}
