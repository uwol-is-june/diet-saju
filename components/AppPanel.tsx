import Image from "next/image";

/**
 * 데스크톱 좌측 패널 — 다시(dasii) 앱으로 보내는 입구 (TASK-74).
 *
 * 레퍼런스(web.dasii.kr)의 좌측 `aside` 를 그대로 받는다. **QR 두 개와 스토어 링크,
 * `Android`/`iPhone` 라벨까지 같다** (2026-08-19 사용자 확정) — dasii 는 우리 앱이고
 * 이 사이트가 그 앱으로 보내는 입구가 된다.
 *
 * ## 좁은 화면에는 없다
 *
 * `hidden xl:flex` 다. 주 사용자가 모바일이고(CLAUDE.md "모바일이 기본값이다") 그쪽
 * 화면은 콘텐츠 열이 꽉 채우므로 이 패널이 들어갈 자리 자체가 없다. **모바일에서 이
 * 패널을 되살리려 하지 말 것** — 첫 화면이 앱 광고로 시작하게 된다.
 *
 * **`md`(768px)가 아니라 `xl`(1280px)인 이유:** 이 패널은 QR 148px 두 개 + 사이 여백이라
 * 최소 360px 가 필요하다. 768px 에서 켜 보면 옆칸이 168px 로 눌려 **카피가 낱말 가운데서
 * 꺾이고**(`나를 위한 똑 / 똑한 선택`) QR 이 48px 로 줄어 읽을 수 없게 된다. 게다가
 * `flex-1` 은 내용보다 작게 줄이지 못하므로 **콘텐츠 열이 가운데에서 밀려난다.**
 * 1280px 에서 옆칸은 384px 이고 레퍼런스와 같은 배치가 된다. **낮추지 말 것.**
 *
 * ## 자산은 우리 도메인에서 서빙한다
 *
 * QR·로고를 dasii 에서 **핫링크하지 않는다.** 그러면 방문자 브라우저가 제3자에게 요청을
 * 보내게 되어 `app/privacy/page.tsx` 4·5항("외부 도구를 전혀 쓰지 않습니다")이 거짓이 된다.
 * **핫링크로 바꾸는 순간 그 두 항을 같은 커밋에서 고쳐야 한다.**
 *
 * 로고는 **문양은 벡터, 글자는 원본 파일**이다 (TASK-83). 문양은 `docs/icon.html` 의
 * 좌표를 그대로 쓰고(TASK-76 에서 원본 55×55 마스크와 대조해 역산해 둔 실측값 —
 * **눈대중으로 고치지 말 것**), 워드마크는 원본 PNG 를 받아 `public/dasii/logo_text.png`
 * 로 서빙한다. 예전에는 글자도 시스템 폰트 굵기 800 으로 흉내 냈는데 **원본 글자꼴과
 * 달랐다** — `다`·`시` 의 획 끝 처리와 쉼표 모양이 아예 다른 글자다.
 *
 * ## 서버 컴포넌트다
 *
 * 레이아웃에 얹히므로 상태를 들면 `/` 가 통째로 정적이라는 성질이 깨진다.
 */

/** 스토어 링크는 레퍼런스와 같은 값이다. QR 이 가리키는 곳도 같다. */
const STORES = [
  {
    label: "Android",
    href: "https://play.google.com/store/apps/details?id=com.dasii&pcampaignid=web_share",
    src: "/dasii/qr_android.png",
    alt: "플레이스토어 설치 QR",
  },
  {
    label: "iPhone",
    href: "https://apps.apple.com/kr/app/id6754357876",
    src: "/dasii/qr_ios.png",
    alt: "앱스토어 설치 QR",
  },
] as const;

/** 카피 세 줄 — 레퍼런스와 같은 문구다. */
const COPY = ["다이어트를 위한 성분 분석부터", "실제 후기까지, 필요한 정보를", "한 번에 확인해보세요!"];

export function AppPanel() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-1 shrink-0 items-center justify-center xl:flex">
      <div className="flex flex-col items-center px-6 py-20">
        <DasiiLogo />

        <p className="title-lg title-extrabold mt-7">
          나를 위한 똑똑한 선택
        </p>

        <div className="mt-4 space-y-1 text-center text-base leading-relaxed text-ink-soft">
          {COPY.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className="mt-8 flex gap-6">
          {STORES.map((store) => (
            <div key={store.label} className="flex flex-col items-center gap-2">
              <a
                href={store.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl bg-surface p-1.5 shadow-sm"
              >
                <Image src={store.src} alt={store.alt} width={148} height={148} />
              </a>
              <span className="text-sm font-bold">{store.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/**
 * 다시(dasii) 로고 — 문양(벡터) + 워드마크(원본 PNG).
 *
 * 문양 좌표는 `docs/icon.html` 과 **같은 값**이다. 파비콘 쪽은 글자를 빼고 문양만 쓰지만
 * (TASK-76) 여기는 앱을 소개하는 자리라 브랜드 이름을 함께 낸다.
 *
 * ## 원본 통짜 로고(`logo.png`)를 쓰지 않는 이유
 *
 * 그 파일은 **187×55 한 벌**이라 문양이 44px 로 그려지는 이 자리에서 DPR 2·3 이면
 * 뭉갠다(44px × DPR 3 = 132px 인데 원본 문양은 55px 다). 그래서 문양은 벡터로 두고
 * 글자만 고해상도 원본(906×404)에서 받아 **표시 크기에 맞게 줄여**(360×161) 커밋했다.
 *
 * ## 크기 비율은 원본 통짜 로고에서 잰 값이다
 *
 * `logo.png` 의 불투명 픽셀 경계를 열 단위로 훑어 얻었다 — 문양 55, 사이 21, 글자 109
 * (글자 높이는 원본 비율로 48.6). 문양 높이를 1 로 두면 **사이 0.38 · 글자 폭 1.98 ·
 * 글자 높이 0.88** 이다. 문양이 44px 이므로 사이 16px(`gap-4`) · 글자 87×39 가 된다.
 * **눈대중으로 고치지 말 것** — 고치려면 같은 방법으로 다시 재고 이 숫자를 갱신한다.
 *
 * 접근 가능한 이름은 **워드마크의 `alt`** 가 만든다. 문양은 `aria-hidden` 이라
 * 여기를 비우면 로고에 이름이 없어진다.
 */
function DasiiLogo() {
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 100 100"
        className="size-11"
        aria-hidden
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* `userSpaceOnUse` 여야 링 둘과 점 둘이 **하나의** 그라데이션을 나눠 쓴다.
              기본값이면 도형마다 자기 상자에서 다시 흘러 색이 끊긴다. */}
          <linearGradient
            id="dasii-mark"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="100"
            y2="100"
          >
            <stop offset="0" stopColor="var(--color-mark-from)" />
            <stop offset="1" stopColor="var(--color-mark-to)" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#dasii-mark)" strokeLinecap="round">
          <path d="M57.63 93.52A44.18 44.18 0 1 1 91.38 65.49" strokeWidth="11.45" />
          <path d="M45.59 24.93A25.45 25.45 0 1 1 24.80 46.44" strokeWidth="9.20" />
        </g>
        <g fill="url(#dasii-mark)">
          <circle cx="83.23" cy="78.45" r="5.57" />
          <circle cx="71.14" cy="89.27" r="5.59" />
        </g>
      </svg>
      <Image src="/dasii/logo_text.png" alt="다시," width={87} height={39} />
    </div>
  );
}
