import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackIconLink } from "@/components/BackLink";
import { FirstVisitNotice } from "@/components/FirstVisitNotice";
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
 * 입력 + 결과 화면 (TASK-30).
 *
 * **세그먼트 값은 기존 `ReadingType` id 를 그대로 쓴다** (`general`·`diet`).
 * 한글 슬러그를 따로 만들면 API 계약(`schema.ts`)과 URL 이 두 벌이 된다.
 * 같은 이유로 `diet` 는 라벨이 `종합 체질 풀이` 로 바뀐 뒤에도 id 를 유지한다 (TASK-39).
 *
 * 없어진 유형(`yearly`)은 여기서 404 가 되지 않는다 — `next.config.ts` 의 리다이렉트가
 * 먼저 잡아 `/` 로 보낸다. 한때 유효했던 URL 이라 밖에 링크가 남아 있을 수 있다.
 *
 * 단계를 클라이언트 상태가 아니라 라우트로 나눈 덕에 ⓐ 뒤로가기가 그대로 동작하고
 * ⓑ `/reading/diet` 를 바로 공유·북마크할 수 있으며 ⓒ 유형별 메타데이터를 붙일 자리가 생긴다.
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
 * 공유 카드 이미지 — **`/` 와 같은 고정 카드 하나**를 가리킨다 (TASK-31).
 *
 * `app/opengraph-image.png` 는 **파일 규약이라 그 세그먼트에만 붙고 하위로 상속되지
 * 않는다** (Next 문서: "set ... for a route segment"). 실측으로 확인했다 — 이 줄이 없으면
 * `/reading/diet` 를 카카오톡에 붙였을 때 이미지 없는 카드가 나간다. 사람들이 실제로
 * 공유하는 URL 이 여기라 그쪽이 더 아프다.
 *
 * **유형별 카드를 만들지 않는다.** 세 벌이 되면 `docs/og-card.html` 원본도 세 벌이고
 * 팔레트 검사(`lib/design/tokens.test.ts`)도 그만큼 는다. 얻는 것보다 유지 비용이 크다.
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
     * 내부 유형은 검색에 노출하지 않는다 (TASK-41). 메인 목록에서 링크가 사라져도
     * 이미 색인됐을 수 있고, 검색에서 들어오면 내린 의미가 없다.
     * 프리렌더는 계속 한다 — 빼면 `/reading/general` 자체가 죽는다.
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
    <>
      {/* 조회수는 브라우저가 센다 (TASK-51). 서버 렌더에서 세면 이 페이지의 프리렌더가 죽는다. */}
      <ViewBeacon type={readingType} />
      <header className="mb-8">
        {/*
          뒤로가기 (TASK-93). **전역 헤더를 없애고(TASK-91) 유형 줄을 없애면서** 이 자리가
          이 화면의 유일한 홈 동선이 된다 — 그 둘이 TASK-74 가 `BackLink` 를 뺀 근거였다.

          `history.back()` 이 아니라 `/` 로 가는 링크다. 근거는 `components/BackLink.tsx`.

          **유형 줄을 없앴다** (TASK-71 을 되돌린다). 레퍼런스의 가로 아이콘 줄을 받은
          것이었는데, 다섯 칸이 제목 바로 위에서 같은 굵기로 늘어서 **지금 고른 유형이
          무엇인지가 오히려 흐려졌다.** 결과 전에 다른 유형으로 가는 길은 `<` → `/` →
          카드 다섯이 맡는다 — 카드에는 사진·묻는 것·설명이 함께 있어 고르는 데 필요한
          것이 그 화면에서 끝난다. 결과 뒤 동선은 `OtherReadingLinks` 가 그대로 들고 있다.

          **유형 선택 컨트롤을 폼 안에 두지 않는다는 경계는 그대로다** — 이 줄이 없어져도
          `birth-input.test.ts` 가 폼 안을 계속 본다.
        */}
        <BackIconLink />

        {/*
          히어로 사진 (TASK-92). **`/` 에서 고른 카드와 같은 그림이다** — 눌린 카드가
          무엇이었는지가 이어진다. 캐릭터(TASK-70)를 여기서 되돌렸고 근거는
          `components/ReadingHeroPhoto.tsx` 에 있다.

          **글자를 이 위에 얹지 않는다** — 사진 안의 색은 팔레트 검사가 닿지 않는다.
        */}
        <div className="mt-4">
          <ReadingHeroPhoto readingType={readingType} />
        </div>

        <h1 className="title-lg title-extrabold mt-1 text-center">
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
    </>
  );
}
