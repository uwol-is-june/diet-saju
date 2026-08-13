import { FirstVisitNotice } from "@/components/FirstVisitNotice";
import { SajuForm } from "@/components/SajuForm";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium tracking-widest text-brand-ink">
          DIET SAJU
        </p>
        <h1 className="mb-3 text-3xl font-bold tracking-tight">사주로 읽는 나의 기질</h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          생년월일시로 사주 원국(사주팔자)을 계산하고,
          <br />
          오행 균형을 바탕으로 타고난 기질과 생활 습관을 풀어드립니다.
        </p>
      </header>

      <FirstVisitNotice />
      <SajuForm />
    </main>
  );
}
