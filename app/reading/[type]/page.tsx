import Link from "next/link";
import { notFound } from "next/navigation";
import { FirstVisitNotice } from "@/components/FirstVisitNotice";
import { SajuForm } from "@/components/SajuForm";
import {
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  type ReadingType,
} from "@/lib/saju/schema";

/**
 * 입력 + 결과 화면 (TASK-30).
 *
 * **세그먼트 값은 기존 `ReadingType` id 를 그대로 쓴다** (`general`·`diet`·`yearly`).
 * 한글 슬러그를 따로 만들면 API 계약(`schema.ts`)과 URL 이 두 벌이 된다.
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

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const readingType = toReadingType((await params).type);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-ink-muted transition hover:text-brand-ink"
        >
          ← 다른 풀이 고르기
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {READING_TYPE_LABEL[readingType]}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {READING_TYPE_DESCRIPTION[readingType]}
        </p>
      </header>

      {/* 첫 방문 안내는 **정보를 넣기 직전에** 보여야 뜻이 있다 (TASK-30). */}
      <FirstVisitNotice />
      <SajuForm readingType={readingType} />
    </main>
  );
}
