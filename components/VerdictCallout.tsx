import Image from "next/image";
import {
  ELEMENT_FOOD,
  VERDICT_BASIS_APPROACH,
  VERDICT_BASIS_GAIN,
  VERDICT_BASIS_METABOLISM,
  verdictFoodBasis,
  verdictMovementBasis,
  type DietApproach,
  type GainPattern,
  type MetabolismTendency,
} from "@/lib/saju/constitution";
import type { Ohaeng } from "@/lib/saju/ganji";
import type { ReadingType, SajuChart } from "@/lib/saju/schema";

/**
 * 판정 한 줄 콜아웃.
 *
 * **LLM 이 쓰지 않는다.** ① 판정은 코드가 한다는 경계(라벨은 `constitution.ts` 에서 오고
 * 같은 사주면 언제나 같다) ② 원국은 즉시 오고 첫 글자는 1초 뒤라 그 사이를 메운다.
 *
 * **라벨만 크게 띄우지 않는다.** 근거 한 줄을 함께 둔다 — 라벨만 있으면 몸에 대한 확정
 * 진술로 읽히는데, 단정해도 되는 것은 **이 사주에서 읽어 낸 판정**까지다.
 *
 * **그 한 줄은 판정 축의 이름을 대지 않고 라벨의 뜻을 말한다** (TASK-105). 문구는
 * `constitution.ts` 의 `VERDICT_BASIS_*` 에 있다 — 여기 직접 쓰면 `constitution.test.ts` 의
 * 금지 어휘·처방·숫자·효능 검사를 통째로 우회한다. 판정의 출처를 말하는 일은 화면의 다른
 * 자리 셋이 맡는다: **눈썹 줄** · 아래 `내 사주` 묶음 머리 · `ResultView` 하단 고정 문구.
 *
 * **`Record` 다.** 삼항이나 인덱스 시그니처로 두면 새 유형이 조용히 남의 콜아웃을 달고 나간다.
 *
 * **모든 유형이 낸다.** 글을 읽기 전에 키워드 하나를 먼저 쥐여 주는 카드라 유형을 가리지
 * 않는다. **조건은 하나 — 라벨이 기존 판정에서 1:1 로 파생될 것.** 억지로 만들면 동점
 * 처리를 새로 정해야 하고 그 순간 "판정은 코드가 한다" 가 무너진다.
 * (`deficient[0]` 처럼 목록의 첫 항목을 쓰는 것은 새 동점이 아니다 — 오행 열거 순서라
 * 이미 고정돼 있고 공유 카드 칩이 같은 값을 쓴다.)
 *
 * **"본문에서 되풀이하지 말라" 는 `gainLabel` 에만 건다.** 그것만 문장 꼴이라 본문에 그대로
 * 들어가면 같은 말이 화면 위아래에 두 번 나온다. 나머지는 낱말 꼴이고 `SYSTEM_INSTRUCTION`
 * 이 **본문에 그대로 쓰라고 요구하는 값**이라, 금지하면 라벨 인용률을 스스로 깎는다.
 *
 * **판정 사진이 유형 사진과 같은 장이면 안 된다** — 히어로와 세로로 나란히 놓여 콜아웃이
 * 히어로의 꼬리처럼 읽힌다. `verdict-photo.test.ts` 가 두 `photos.json` 의 id 를 댄다.
 *
 * **모습이 둘이다** (TASK-109). 사진이 있으면 **사진 전면 + 어둠 + 흰 글씨**이고, 사진이
 * 없는 내부 유형(`general`·`decade`)은 연한 브랜드 면 + `text-brand-ink` 다. 형식·크롭·
 * 스크림은 `globals.css` 의 `.verdict-cover`·`.verdict-photo` 가 정한다.
 */
interface Callout {
  label: string;
  basis: string;
  /** `public/verdict/<slug>.jpg`. 목록에 나오지 않는 내부 유형은 `null` 이다. */
  photo: string | null;
}

/*
 * 사진 슬러그는 **유형이 아니라 판정 축의 값**에 붙는다 — `Record<축, …>` 라 축에 값이
 * 늘면 컴파일 오류로 잡힌다. `verdict-photo.test.ts` 가 스크립트 검색어 표 · 이 파일 ·
 * `public/verdict/` 셋을 대조한다.
 */
const METABOLISM_PHOTO: Record<MetabolismTendency, string> = {
  발산형: "metabolism-balsan",
  축적형: "metabolism-chukjeok",
};

const GAIN_PHOTO: Record<GainPattern, string> = {
  근육형: "gain-geunyuk",
  식욕형: "gain-sigyok",
  불규칙형: "gain-bulgyuchik",
  스트레스형: "gain-stress",
  정체형: "gain-jeongche",
};

const APPROACH_PHOTO: Record<DietApproach, string> = {
  "활동량 우선": "approach-activity",
  "식사량 조절 우선": "approach-meal",
  "회복 우선": "approach-recovery",
  "리듬 고정 우선": "approach-rhythm",
};

/**
 * 곁들일 계열. **재료 사진이 아니라 오행 상징이다** — 채소·곡물을 찍으면 `ELEMENT_FOOD`
 * 닫힌 목록을 판정 코드 밖에서 우회하는 셈이 된다.
 */
const ELEMENT_PHOTO: Record<Ohaeng, string> = {
  목: "element-mok",
  화: "element-hwa",
  토: "element-to",
  금: "element-geum",
  수: "element-su",
};

/** 부족한 오행이 없을 때. 라벨이 "곁들일 계열이 따로 없음" 이므로 그림도 균형 쪽이다. */
const ELEMENT_EVEN_PHOTO = "element-even";

/**
 * 대표 종목. 접근 순서에서 1:1 로 나오므로 키가 `DietApproach` 이고 새 동점이 없다.
 * **`APPROACH_PHOTO` 와 다른 사진을 쓴다** — 같은 장을 돌려 쓰면 `diet-method` 에서
 * `exercise` 로 넘어갔을 때 화면이 바뀌지 않은 것처럼 보인다.
 */
const MOVEMENT_PHOTO: Record<DietApproach, string> = {
  "활동량 우선": "movement-brisk",
  "식사량 조절 우선": "movement-strength",
  "회복 우선": "movement-slow",
  "리듬 고정 우선": "movement-rhythm",
};

const CALLOUT: Record<ReadingType, (chart: SajuChart) => Callout | null> = {
  // 내부 유형이지만 `Record` 라 값이 필요하다. 신강신약은 고전 규칙이라 그대로 쓴다.
  general: (chart) => ({
    label: chart.strength.verdict,
    basis: `${chart.ohaeng.season}에 태어나 ${chart.ohaeng.strongest} 기운이 가장 강한 사주입니다`,
    // 목록에 나오지 않는 유형이라 사진을 만들지 않았다 (TASK-90 범위는 공개 다섯 유형).
    photo: null,
  }),
  /**
   * 종합 체질. **대사 기조를 라벨로 쓴다** — 신강신약에서 1:1 로 나오고 이 유형이 답하는
   * "몸이 어떤 쪽인가" 에 가장 가깝다.
   */
  diet: (chart) => ({
    label: chart.constitution.metabolism,
    basis: VERDICT_BASIS_METABOLISM[chart.constitution.metabolism],
    photo: METABOLISM_PHOTO[chart.constitution.metabolism],
  }),
  "gain-cause": (chart) => ({
    label: chart.constitution.gainLabel,
    basis: VERDICT_BASIS_GAIN[chart.constitution.gainPattern],
    photo: GAIN_PHOTO[chart.constitution.gainPattern],
  }),
  // 방법 유형 (TASK-66): 접근 순서가 이 유형이 답하는 질문이다. 2×2 표라 동점이 없다.
  "diet-method": (chart) => ({
    label: chart.constitution.dietApproach,
    basis: VERDICT_BASIS_APPROACH[chart.constitution.dietApproach],
    photo: APPROACH_PHOTO[chart.constitution.dietApproach],
  }),
  /**
   * 식단 유형. **부족한 계열이 없을 때 지어내지 않는다** — 그 사실 자체가 판정이고,
   * 근거 줄도 "지금 먹는 대로 두면 된다" 로 갈린다 (`verdictFoodBasis`).
   */
  "diet-food": (chart) => {
    const element = chart.constitution.deficient[0];
    const basis = verdictFoodBasis(element);
    if (!element) {
      return { label: "오행이 고르게 퍼진 편", basis, photo: ELEMENT_EVEN_PHOTO };
    }
    const food = ELEMENT_FOOD[element];
    return {
      /** **오행 이름이 아니라 재료 이름이 뜬다** — 오행은 아는 사람만 읽을 수 있다. */
      label: `${food.short}${objectParticle(food.short)} 곁들이기`,
      basis,
      photo: ELEMENT_PHOTO[element],
    };
  },
  /**
   * 운동 유형. **콜아웃이 이 유형의 핵심이다** — 종목이 본문 어딘가가 아니라 맨 위에 뜬다.
   * 근거 줄은 **두 층을 각자의 표에서 받아 끼운다** (강도 = 접근 순서, 때 = 한열).
   * 층을 섞지 않으므로 각 칸의 근거를 설명할 수 있다 — 합치는 일은 `verdictMovementBasis`.
   */
  exercise: (chart) => ({
    label: chart.constitution.movementPrimary,
    basis: verdictMovementBasis(chart.constitution.dietApproach, chart.constitution.thermal),
    photo: MOVEMENT_PHOTO[chart.constitution.dietApproach],
  }),
  /**
   * 시기 유형. 작용 3단계가 라벨이다 (`yearly.ts` 규칙을 대운에 적용한 값이라 새 관례가 없다).
   * **다음 구간은 판정하지 않았으므로 라벨에도 없다.**
   */
  decade: (chart) =>
    chart.decade
      ? {
          label: `${chart.decade.current.effect}하는 10년`,
          basis: chart.decade.shift
            ? `지금 ${chart.decade.current.ganji} 대운이고, 직전 구간과 견주면 ${chart.decade.shift}입니다`
            : `지금 ${chart.decade.current.ganji} 대운이고, 첫 대운을 지나는 중입니다`,
          // `general` 과 같다 — 내부 유형이라 사진을 만들지 않았다.
          photo: null,
        }
      : null,
};

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

/**
 * 목적격 조사 — 받침이 있으면 `을`, 없으면 `를`. 라벨마다 손으로 적으면 표가 하나 더
 * 생긴다. 한글 음절은 `(코드 − 0xAC00) % 28` 이 종성 인덱스라 규칙 하나로 끝난다.
 */
function objectParticle(word: string): string {
  const last = word.codePointAt(word.length - 1) ?? 0;
  if (last < 0xac00 || last > 0xd7a3) return "를";
  return (last - 0xac00) % 28 === 0 ? "를" : "을";
}

const EYEBROW = "이 사주에서 읽은 한 줄";

export function VerdictCallout({
  chart,
  readingType,
}: {
  chart: SajuChart;
  readingType: ReadingType;
}) {
  const callout = CALLOUT[readingType](chart);
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
          <p className="text-xs font-bold tracking-wide text-ink-muted">{EYEBROW}</p>
          <p className="mt-1 text-xl font-bold text-brand-ink sm:text-2xl">{callout.label}</p>
          <p className="mt-2 text-sm text-ink-soft">{callout.basis}</p>
        </div>
      </section>
    );
  }

  /*
    **글이 사진 위에 온다** — 이 카드에서만 그렇게 하고, 뒤집어도 되는 근거는 사진이 아니라
    스크림이 대비를 보증한다는 것이다(계산은 `globals.css` 의 `.verdict-cover`).

    글 폭을 잡지 않는다 — 사진이 오른쪽 42% 만 덮던 동안에는 `w-[62%]` 로 겹침을 피했고
    그래서 라벨이 길면 두 줄로 접혔다. 이제 어둠이 카드 전체에 깔리므로 글이 열 폭을
    다 쓴다. 대신 `min-height` 가 카드를 띠로 만들지 않고(`.verdict-cover`),
    `justify-end` 가 글을 아래로 모아 위쪽을 사진 몫으로 남긴다.

    **위계는 무게와 크기로만 만든다** — 색은 흰색 하나이고 흐린 흰색도 같은 계산에서 나온
    알파다. `text-on-photo*` 밖의 색을 여기 쓰지 말 것.
  */
  return (
    <section className="verdict-cover flex flex-col justify-end overflow-hidden rounded-2xl p-5 shadow-sm sm:p-6">
      <VerdictPhoto slug={callout.photo} />

      <div className="relative z-10 break-keep">
        <p className="text-xs font-bold tracking-wide text-on-photo-dim">{EYEBROW}</p>
        <p className="mt-1 text-2xl font-extrabold text-on-photo sm:text-3xl">{callout.label}</p>
        <p className="mt-2 text-sm text-on-photo-dim">{callout.basis}</p>
      </div>
    </section>
  );
}
