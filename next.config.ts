import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 서버 응답에 프레임워크 정보를 노출하지 않는다.
  poweredByHeader: false,
  /**
   * 없어진 리딩 유형 (TASK-39).
   *
   * `/reading/yearly` 는 프리렌더돼 있었고 검색·공유 문구까지 있었으므로 밖에 링크가
   * 남아 있을 수 있다. `generateStaticParams` 에서 빠지면 `notFound()` 로 404 가 되는데,
   * **한때 유효했던 URL 을 404 로 두는 것은 유형을 정리한 결과로 치를 값이 아니다.**
   *
   * 목적지는 `/reading/diet` 가 아니라 `/` 다. 올해 운세 판정의 작용 축은 체질 풀이로
   * 옮겨갔지만 "올해 운세" 를 보러 온 사람에게 "종합 체질 풀이" 를 들이미는 것은
   * 다른 것을 준 것이다. 유형 선택 화면에서 직접 고르게 한다.
   *
   * 라우트 파일이 아니라 여기 두는 이유: 없어진 유형을 `ReadingType` 에 되살리지
   * 않아도 되고, 타입 시스템이 유형 목록을 계속 강제할 수 있다.
   */
  async redirects() {
    return [{ source: "/reading/yearly", destination: "/", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        // 사주 결과는 캐시하지 않는다 (개인정보 포함).
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
