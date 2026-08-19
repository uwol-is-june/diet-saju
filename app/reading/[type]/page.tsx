import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { FirstVisitNotice } from "@/components/FirstVisitNotice";
import { SajuForm } from "@/components/SajuForm";
import { ReadingCharacter } from "@/components/ReadingCharacter";
import { ViewBeacon } from "@/components/ViewBeacon";
import {
  PUBLIC_READING_TYPES,
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  READING_TYPE_META,
  READING_TYPE_SHORT,
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
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      {/* 조회수는 브라우저가 센다 (TASK-51). 서버 렌더에서 세면 이 페이지의 프리렌더가 죽는다. */}
      <ViewBeacon type={readingType} />
      <header className="mb-8">
        <BackLink label="다른 풀이 고르기" />

        {/*
          유형 줄 (TASK-71). 레퍼런스 화면 1 의 가로 아이콘 줄을 여기서 받는다.
          **`/` 가 아니라 여기인 이유**: `/` 에는 "선택된 유형" 이 없고(선택이 곧 이동이다)
          상태를 들면 클라이언트 컴포넌트가 되어 `/` 를 정적으로 두는 성질이 깨진다.
          이 화면은 세그먼트로 현재 유형을 **서버가** 알므로 클라이언트 JS 없이 강조된다.

          **링크이지 컨트롤이 아니다.** `/reading/*` 에 유형 선택 *컨트롤* 을 두지 않는다는
          경계는 그대로이고 `birth-input.test.ts` 가 폼 안을 본다. 이 줄은 폼 밖이다.
        */}
        <nav aria-label="풀이 유형" className="mt-3">
          <ul className="flex flex-wrap justify-center gap-1.5">
            {PUBLIC_READING_TYPES.map((type) => {
              const current = type === readingType;
              return (
                <li key={type}>
                  <Link
                    href={`/reading/${type}`}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "block rounded-full bg-brand-subtle px-3.5 py-1.5 text-sm font-bold text-brand-ink ring-1 ring-brand-border"
                        : "block rounded-full px-3.5 py-1.5 text-sm text-ink-muted hover:text-brand-ink"
                    }
                  >
                    {READING_TYPE_SHORT[type]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 유형별 캐릭터 (TASK-70). 면 색만 유형 톤이고 화면 배경은 그대로다. */}
        <div className="mt-6">
          <ReadingCharacter readingType={readingType} />
        </div>

        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">
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
    </main>
  );
}
