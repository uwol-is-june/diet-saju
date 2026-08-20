import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackIconLink } from "@/components/BackLink";
import { FirstVisitNotice } from "@/components/FirstVisitNotice";
import { PageTransition } from "@/components/PageTransition";
import { ReadingHeroPhoto } from "@/components/ReadingHeroPhoto";
import { SajuForm } from "@/components/SajuForm";
import { ViewBeacon } from "@/components/ViewBeacon";
import {
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  READING_TYPE_META,
  READING_TYPE_VISIBILITY,
  type ReadingType,
} from "@/lib/saju/schema";

/**
 * 입력 + 결과 화면.
 *
 * **세그먼트 값은 기존 `ReadingType` id 를 그대로 쓴다** — 한글 슬러그를 만들면 API
 * 계약(`schema.ts`)과 URL 이 두 벌이 된다. 같은 이유로 **id 를 바꾸지 않는다.**
 *
 * 없어진 유형(`yearly`)은 여기서 404 가 되지 않는다 — `next.config.ts` 의 리다이렉트가
 * 먼저 잡아 `/` 로 보낸다(한때 유효했던 URL 이라 밖에 링크가 남아 있다).
 *
 * 단계를 클라이언트 상태가 아니라 **라우트로** 나눈 덕에 뒤로가기·공유·북마크·유형별
 * 메타데이터가 저절로 산다.
 */

export function generateStaticParams() {
  return READING_TYPES.map((type) => ({ type }));
}

/** 계약에 없는 세그먼트는 404 다. `READING_TYPES` 를 늘리면 여기도 자동으로 따라온다. */
function toReadingType(value: string): ReadingType {
  const match = READING_TYPES.find((type) => type === value);
  if (!match) notFound();
  return match;
}

/**
 * 공유 카드 이미지 — **`/` 와 같은 고정 카드 하나**를 가리킨다.
 *
 * `app/opengraph-image.png` 는 **파일 규약이라 그 세그먼트에만 붙고 하위로 상속되지
 * 않는다.** 이 줄이 없으면 `/reading/*` 에는 og:image 가 아예 없고, 사람들이 실제로
 * 공유하는 URL 이 여기다. **지우지 말 것.**
 *
 * **유형별 카드를 만들지 않는다** — 여러 벌이 되면 원본 HTML 도 팔레트 검사도 그만큼 는다.
 */
const SHARED_OG_IMAGE = "/opengraph-image.png";

/** 유형별 title·description (TASK-31). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const readingType = toReadingType((await params).type);
  const { title, description } = READING_TYPE_META[readingType];
  const url = `/reading/${readingType}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    /**
     * 내부 유형은 검색에 노출하지 않는다 — 목록에서 링크가 사라져도 이미 색인됐을 수 있다.
     * **프리렌더는 계속 한다** (빼면 그 라우트 자체가 죽는다).
     */
    robots:
      READING_TYPE_VISIBILITY[readingType] === "internal"
        ? { index: false, follow: false }
        : undefined,
    openGraph: {
      type: "website",
      siteName: "다이어트 사주",
      locale: "ko_KR",
      url,
      title,
      description,
      images: [SHARED_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARED_OG_IMAGE],
    },
  };
}

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const readingType = toReadingType((await params).type);

  return (
    /*
      `/` 에서 카드를 누르면 오른쪽에서 밀려 들어오고 맨 위 `<` 로 나가면 반대로 빠진다.
      근거와 제약은 `components/PageTransition.tsx`.
    */
    <PageTransition>
      {/* 조회수는 브라우저가 센다 (TASK-51). 서버 렌더에서 세면 이 페이지의 프리렌더가 죽는다. */}
      <ViewBeacon type={readingType} />
      <header className="mb-8">
        {/*
          히어로 사진과 뒤로가기가 **한 상자 안에 있다** (TASK-97).

          `-mx-5 -mt-10` 이 `main` 의 여백(`px-5 py-10`)을 되돌려 사진을 **콘텐츠 열의
          맨 위·양 끝까지** 펼친다. 뷰포트 폭이 아니라 열 폭이다 — 데스크톱 3열 셸에서
          사진이 열을 넘지 않는다. 예전에는 사진이 버튼 아래에서 `mt-4` 만큼 떨어져
          시작해 **열 안에 얹힌 띠**로 보였고, `/` 카드에서 이어져 온 그림이 거기서
          한 번 끊겼다.

          **음수 여백과 `relative` 가 같은 요소에 있어야 한다** — 버튼을 사진의 좌상단에
          맞추려면 위치 기준이 사진과 같은 상자여야 한다. 그래서 이 둘을 여기서 함께
          들고, `ReadingHeroPhoto` 는 슬롯 높이와 마스크만 맡는다.
        */}
        <div className="relative -mx-5 -mt-10">
          {/*
            히어로 사진 (TASK-92). **`/` 에서 고른 카드와 같은 그림이다** — 눌린 카드가
            무엇이었는지가 이어진다. 캐릭터(TASK-70)를 여기서 되돌렸고 근거는
            `components/ReadingHeroPhoto.tsx` 에 있다.

            **글자를 이 위에 얹지 않는다** — 사진 안의 색은 팔레트 검사가 닿지 않는다.
            아래 버튼만 예외이고, 그것도 `surface` variant 로 자기 면을 들고 간다.
          */}
          <ReadingHeroPhoto readingType={readingType} />

          {/*
            뒤로가기 (TASK-93 · 97). **전역 헤더를 없애고(TASK-91) 유형 줄을 없애면서**
            이 자리가 이 화면의 유일한 홈 동선이 된다 — 그 둘이 TASK-74 가 `BackLink` 를
            뺀 근거였다. `history.back()` 이 아니라 `/` 로 가는 링크이고 근거는
            `components/BackLink.tsx` 에 있다.

            `left-5` 는 `main` 의 좌측 여백과 같은 값이다 — 면을 든 버튼이라 원의
            **왼쪽 끝**이 본문 시작선과 맞는다(글자가 없는 `ghost` 였을 때는 광학 정렬로
            `-ml-2.5` 만큼 당겼다). `top-3` 은 사진 위쪽 여백이고, 44px 원이 사진의
            불투명한 구간 안에 온전히 들어온다.

            **유형 선택 컨트롤을 폼 안에 두지 않는다는 경계는 그대로다** —
            `birth-input.test.ts` 가 폼 안을 계속 본다.
          */}
          <div className="absolute left-5 top-3">
            <BackIconLink />
          </div>
        </div>

        {/*
          제목이 **슬롯 안으로 올라온다** (TASK-106). 사진 슬롯(300px)의 아래 구간은
          마스크 알파가 0 인 빈 자리이고, `-mt-7`(=28px)이 제목을 그 안으로 당긴다 —
          그래야 페이드 꼬리가 제목·설명이 앉는 높이까지 이어지고 사진과 글 사이에
          경계선이 생기지 않는다. **슬롯 높이·마스크와 한 벌이라 따로 고치지 말 것**
          (근거 계산은 `app/globals.css` 의 `.hero-photo`).

          **글자가 사진 위에 얹히는 것이 아니다** — 이 자리의 알파는 0 이라 뒤가
          `canvas` 다. 값을 줄이면(더 위로 당기면) 반투명한 그림 위에 글자가 놓여
          대비가 사진마다 달라진다.
        */}
        <h1 className="title-lg title-extrabold -mt-7 text-center">
          {READING_TYPE_LABEL[readingType]}
        </h1>
        {/* 중앙 정렬은 **짧은 글에만** 쓴다 — 본문 문단을 가운데로 놓으면 줄 시작점이 흔들린다. */}
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-ink-muted">
          {READING_TYPE_DESCRIPTION[readingType]}
        </p>
      </header>

      {/* 첫 방문 안내는 **정보를 넣기 직전에** 보여야 뜻이 있다 (TASK-30). */}
      <FirstVisitNotice />
      <SajuForm readingType={readingType} />
    </PageTransition>
  );
}
