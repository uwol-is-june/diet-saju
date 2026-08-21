import Image from "next/image";
import { verdictOf } from "@/lib/reading/verdict";
import type { ReadingType, SajuChart } from "@/lib/saju/schema";

/**
 * 판정 한 줄 콜아웃 — **그리기만 한다.**
 *
 * **무엇을 띄울지는 `lib/reading/verdict.ts` 가 정한다** (TASK-116). 공유 카드가 같은 값을
 * 읽으므로 표를 여기 되돌리면 화면과 저장된 이미지가 다른 말을 한다.
 *
 * **LLM 이 쓰지 않는다.** ① 판정은 코드가 한다는 경계 ② 원국은 즉시 오고 첫 글자는 1초
 * 뒤라 그 사이를 메운다.
 *
 * **라벨만 크게 띄우지 않는다.** 근거 한 줄을 함께 둔다 — 라벨만 있으면 몸에 대한 확정
 * 진술로 읽히는데, 단정해도 되는 것은 **이 사주에서 읽어 낸 판정**까지다. 판정의 범위를
 * 한정하는 일은 화면의 자리 **하나**가 맡는다: `ResultView` 하단 고정 문구(`오락·참고용` ·
 * `AI 가 작성`). **눈썹 줄은 주제를 말하는 줄이 되고(TASK-111) `내 사주` 묶음 머리는
 * 없어졌다(TASK-112)** — 그래서 하단 문구를 지우면 범위를 말하는 자리가 화면에 남지 않는다.
 *
 * **판정 사진이 유형 사진과 같은 장이면 안 된다** — 히어로와 세로로 나란히 놓여 콜아웃이
 * 히어로의 꼬리처럼 읽힌다. `verdict-photo.test.ts` 가 두 `photos.json` 의 id 를 댄다.
 *
 * **모습이 둘이다** (TASK-109). 사진이 있으면 **사진 전면 + 어둠 + 흰 글씨**이고, 사진이
 * 없는 내부 유형(`general`·`decade`)은 연한 브랜드 면 + `text-brand-ink` 다. 형식·크롭·
 * 스크림은 `globals.css` 의 `.verdict-cover`·`.verdict-photo` 가 정한다.
 */

/**
 * 원본 크기. 정사각 480×480 이고 `fetch-verdict-photos.mjs` 의 `SIZE` 가 단일 소스다.
 *
 * **전면 깔기라 원본이 열 폭보다 작다** (390px 화면에서 카드 폭이 350px 이므로 DPR 2 에서
 * 모자란다). 히어로에서 한 판단과 같다 — 스크림 아래에 깔리는 장식이라 선명도가 정보를
 * 나르지 않고, 원본을 키우면 저장소와 전송량이 함께 오른다.
 */
const SLOT = 480;

/**
 * 판정 사진. **카드를 통째로 덮는다** — 형식과 크롭·스크림은 `globals.css` 의
 * `.verdict-cover`·`.verdict-photo` 가 정한다. **Tailwind 임의값으로 흩뿌리지 않는다**
 * (`ReadingCardPhoto`·`ReadingHeroPhoto` 와 같은 판단).
 *
 * **`priority` 를 주지 않는다** — 어느 장이 필요한지는 `chart` 가 와야 알기 때문에 제출
 * 전에는 preload 할 대상이 없다. 대신 **`loading="eager"`** 로 지연 로드만 끈다.
 *
 * 사진이 `absolute` 라 늦게 와도 글의 자리가 밀리지 않는다. 스크림(`::after`)이 트리
 * 순서상 뒤라 사진 위에 깔리고, 글만 `z-10` 으로 그 위에 올라간다.
 *
 * **`alt` 이 빈 문자열인 장식이다** — 라벨이 바로 위에 글자로 있다. 출처 표기는
 * `public/verdict/CREDITS.md`.
 */
function VerdictPhoto({ slug }: { slug: string }) {
  return (
    <Image
      src={`/verdict/${slug}.jpg`}
      alt=""
      width={SLOT}
      height={SLOT}
      sizes="(max-width: 640px) 100vw, 512px"
      loading="eager"
      className="verdict-photo pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export function VerdictCallout({
  chart,
  readingType,
}: {
  chart: SajuChart;
  readingType: ReadingType;
}) {
  const callout = verdictOf(chart, readingType);
  if (!callout) return null;

  /*
    **사진이 없는 유형은 예전 모습 그대로다** (`general`·`decade` 는 `photo: null`).
    두 모습이 한 컴포넌트에 있는 것이 맞다 — 갈리는 지점이 `Callout.photo` 하나뿐이고,
    갈라 두면 눈썹 줄과 위계 규칙을 두 곳에서 고쳐야 한다.
  */
  if (!callout.photo) {
    return (
      <section className="rounded-2xl border border-brand-border bg-brand-subtle p-5 shadow-sm sm:p-6">
        <div className="break-keep">
          <p className="text-xs font-bold tracking-wide text-ink-muted">{callout.eyebrow}</p>
          <p className="mt-1 text-xl font-bold text-brand-ink sm:text-2xl">{callout.label}</p>
          <p className="mt-2 text-sm text-ink-soft">{callout.basis}</p>
        </div>
      </section>
    );
  }

  /*
    **글이 사진 위에 온다** — 이 카드에서만 그렇게 하고, 뒤집어도 되는 근거는 사진이 아니라
    스크림이 대비를 보증한다는 것이다(계산은 `globals.css` 의 `.verdict-cover`).

    글 폭을 잡지 않는다 — 어둠이 카드 전체에 깔리므로 글이 열 폭을 다 쓴다. 대신
    `min-height` 가 카드를 띠로 만들지 않고 `justify-end` 가 글을 아래로 모아 위쪽을 사진
    몫으로 남긴다.

    **위계는 무게와 크기로만 만든다** — 색은 흰색 하나이고 흐린 흰색도 같은 계산에서 나온
    알파다. `text-on-photo*` 밖의 색을 여기 쓰지 말 것.
  */
  return (
    <section className="verdict-cover flex flex-col justify-end overflow-hidden rounded-2xl p-5 shadow-sm sm:p-6">
      <VerdictPhoto slug={callout.photo} />

      <div className="relative z-10 break-keep">
        <p className="text-xs font-bold tracking-wide text-on-photo-dim">{callout.eyebrow}</p>
        <p className="mt-1 text-2xl font-extrabold text-on-photo sm:text-3xl">{callout.label}</p>
        <p className="mt-2 text-sm text-on-photo-dim">{callout.basis}</p>
      </div>
    </section>
  );
}
