import Image from "next/image";
import type { DietApproach, GainPattern, MetabolismTendency } from "@/lib/saju/constitution";
import type { Ohaeng } from "@/lib/saju/ganji";
import type { ReadingType, SajuChart } from "@/lib/saju/schema";

/**
 * 판정 한 줄 콜아웃 (TASK-47 · 90).
 *
 * ## 왜 LLM 이 쓰지 않는가
 *
 * 두 가지다. ① **판정은 코드가 한다**는 경계 — 라벨은 `constitution.ts` 의 `GAIN_LABEL`
 * 에서 오고 같은 사주면 언제나 같다. ② **`chart` 는 60~70ms 에 오고 첫 글자는 1초 뒤다.**
 * 기다리는 동안 결론 한 줄이 먼저 떠서 볼거리가 생긴다.
 *
 * ## 라벨만 크게 띄우지 않는다
 *
 * 라벨 밑에 **근거 한 줄**을 함께 둔다. 라벨만 있으면 "당신은 먹는 자리에서 찐다" 는
 * 확정 진술로 읽히는데, 단정해도 되는 것은 **이 사주에서 읽어 낸 판정**이지 몸에서
 * 실제로 일어나는 일이 아니다 (TASK-55 경계). 밑줄이 판정 근거(십신 우세 그룹 · 걸리는 지점)와
 * 그 범위를 함께 말한다.
 *
 * ## `Record` 인 이유
 *
 * `prompt.ts` 의 `VERDICT_BLOCK` 과 같은 모양이다. 삼항이나 인덱스 시그니처로 두면
 * **새 유형이 조용히 남의 콜아웃을 달고 나간다** — TASK-15 에서 공유 카드 칩이 실제로
 * 그렇게 샐 뻔했다.
 *
 * ## 모든 유형이 낸다 (TASK-66)
 *
 * 예전에는 `gain-cause`·`exercise` 만 냈고 나머지는 "한 줄로 요약되는 판정이 아니다" 로
 * 비워 뒀다. 지금은 전부 낸다 — **글을 읽기 전에 키워드 하나를 먼저 쥐여 주는 카드**라
 * 유형을 가릴 이유가 없었다.
 *
 * **조건은 하나다: 라벨이 기존 판정에서 1:1 로 파생될 것.** 그래야 같은 사주에 언제나 같은
 * 라벨이 나온다. 억지로 만들면 동점 처리를 새로 정해야 하고, 그 순간 "판정은 코드가 한다" 가
 * 무너진다. 아래 다섯은 전부 이미 결정론적인 값에서 그대로 온다.
 *
 * `deficient[0]` 처럼 **목록의 첫 항목을 쓰는 것도 새 동점 처리가 아니다** — 그 목록은
 * 오행 열거 순서로 만들어져 순서가 이미 고정돼 있다 (`card-model.ts` 의 칩이 같은 값을 쓴다).
 *
 * ## "본문에서 되풀이하지 말라" 는 `gainLabel` 에만 건다
 *
 * `prompt.ts` 의 판정 블록이 `gainLabel` 한 줄에만 그 지시를 붙인다. 그것이 문장 꼴
 * ("먹는 자리에서 붙는 성향")이라 본문에 그대로 들어가면 같은 말이 화면 위아래에 두 번
 * 나오기 때문이다.
 *
 * **나머지 라벨에는 걸지 않는다.** 대사 기조·접근 순서 같은 낱말 꼴 라벨은
 * `SYSTEM_INSTRUCTION` 이 **본문에 그대로 쓰라고 요구하는 값**이고, 그 인용률이 이 서비스의
 * 적중감을 만든다(기준선에서 48/48). 되풀이를 금지하면 그 지표를 스스로 깎는다.
 * 콜아웃은 제목처럼 얹히는 한 줄이지 본문과 같은 자리의 문장이 아니다.
 *
 * ## 사진 (TASK-90 · 94)
 *
 * 이 카드가 원래 **첫 글자 오기 전 1초를 메우는 자리**라 볼거리가 하나 더 붙는다.
 * 규칙 넷은 아래 `VerdictPhoto` 주석에 있다.
 *
 * **판정 사진이 유형 사진과 같은 장이면 안 된다** (TASK-94). TASK-92 가 `/` 카드 사진을
 * 이 화면 상단 히어로로 올리면서 둘이 세로로 나란히 놓이는데, `movement-rhythm` 이
 * `/cards/exercise.jpg` 와 **같은 Pexels 사진**이라 콜아웃이 히어로의 꼬리처럼 읽혔다.
 * 사진을 갈았고 `verdict-photo.test.ts` 가 두 `photos.json` 의 id 를 댄다.
 */
interface Callout {
  label: string;
  basis: string;
  /** `public/verdict/<slug>.jpg`. 목록에 나오지 않는 내부 유형은 `null` 이다. */
  photo: string | null;
}

/*
 * 사진 슬러그는 **유형이 아니라 판정 축의 값**에 붙는다. `Record<축, …>` 라 축에 값이
 * 늘면 여기가 컴파일 오류로 잡힌다 — 유형에 붙이면 그 안전장치가 한 겹 사라진다.
 *
 * `scripts/fetch-verdict-photos.mjs` 의 검색어 표가 같은 슬러그를 쓰고,
 * `lib/reading/verdict-photo.test.ts` 가 그 표 · 이 파일 · `public/verdict/` 셋을 대조한다.
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
 * 닫힌 목록을 판정 코드 밖에서 우회하는 셈이 된다 (`ReadingCharacter` 가 특정 식품을
 * 그리지 않는 것과 같은 경계).
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
 * 대표 종목. **`movementPrimary` 가 `MOVEMENT_PLAN[dietApproach].primary` 라** 접근 순서에서
 * 1:1 로 나온다 — 그래서 키가 `DietApproach` 이고 새 동점 처리가 없다.
 *
 * `APPROACH_PHOTO` 와 **다른 사진을 쓴다.** 두 유형이 묻는 것이 다르고(무엇을 먼저 /
 * 어떤 운동을), 같은 장을 돌려 쓰면 `diet-method` 에서 `exercise` 로 넘어갔을 때 화면이
 * 바뀌지 않은 것처럼 보인다.
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
   * 종합 체질 (TASK-66). **대사 기조를 라벨로 쓴다** — 신강신약에서 1:1 로 나오는 값이고,
   * 이 유형이 답하는 "몸이 어떤 쪽인가" 에 가장 가깝다. 한열은 근거 줄로 내린다.
   */
  diet: (chart) => ({
    label: chart.constitution.metabolism,
    basis: `신강신약 ${chart.strength.verdict}에서 나온 기조이고, 한열은 ${chart.constitution.thermal} 쪽입니다`,
    photo: METABOLISM_PHOTO[chart.constitution.metabolism],
  }),
  "gain-cause": (chart) => ({
    label: chart.constitution.gainLabel,
    basis: `십신 우세 ${chart.constitution.dominantGroup} · ${chart.constitution.gainSite} 쪽에서 먼저 드러납니다`,
    photo: GAIN_PHOTO[chart.constitution.gainPattern],
  }),
  // 방법 유형 (TASK-66): 접근 순서가 이 유형이 답하는 질문이다. 2×2 표라 동점이 없다.
  "diet-method": (chart) => ({
    label: chart.constitution.dietApproach,
    basis: `대사 기조 ${chart.constitution.metabolism} · 걸리는 지점 ${chart.constitution.gainSite}에서 나온 순서입니다`,
    photo: APPROACH_PHOTO[chart.constitution.dietApproach],
  }),
  /**
   * 식단 유형 (TASK-63 · 66). 곁들일 계열이 이 유형이 답하는 질문이다.
   *
   * **부족한 오행이 없을 때 지어내지 않는다** — 그 사실 자체가 판정이므로 그렇게 쓴다.
   * 대신 근거 줄이 한열을 들어 "그래도 조리와 온도는 정해진다" 를 말한다.
   */
  "diet-food": (chart) => {
    const short = chart.constitution.deficient[0];
    return {
      label: short ? `${short} 계열을 곁들이기` : "곁들일 계열이 따로 없음",
      basis: short
        ? `오행 ${short}이 부족한 쪽이고, 한열 ${chart.constitution.thermal}이 조리와 온도를 정합니다`
        : `오행이 한쪽으로 쏠리지 않았고, 한열 ${chart.constitution.thermal}이 조리와 온도를 정합니다`,
      photo: short ? ELEMENT_PHOTO[short] : ELEMENT_EVEN_PHOTO,
    };
  },
  /**
   * 운동 유형 (TASK-48). **콜아웃이 이 유형의 핵심이다** — "어떤 운동을" 을 하나로 좁혀
   * 보여주는 것이 목적이라, 종목이 본문 어딘가가 아니라 맨 위에 떠 있어야 한다.
   *
   * 근거 줄은 **두 층을 각자의 표에서 가져와 합친다** — 종목은 `MOVEMENT_PLAN`(접근 순서
   * 층), 실행 조건은 `THERMAL_GUIDE`(한열 층). 층을 섞지 않으므로 4 × 5 = 20가지 문장이
   * 나오면서도 각 칸의 근거를 설명할 수 있다.
   */
  exercise: (chart) => ({
    label: chart.constitution.movementPrimary,
    basis: `${chart.constitution.movementKind} · ${chart.constitution.dietApproach}에서 나온 종목이고, 한열 ${chart.constitution.thermal}이 실행 조건을 정합니다`,
    photo: MOVEMENT_PHOTO[chart.constitution.dietApproach],
  }),
  /**
   * 시기 유형 (TASK-66). 작용 3단계가 라벨이다 — `yearly.ts` 의 규칙을 그대로 대운에
   * 적용한 값이라 새 관례가 없다. **다음 구간은 판정하지 않았으므로 라벨에도 없다.**
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
 * 슬롯 크기. `/` 리스트 카드와 같은 값이다 (`ReadingCardPhoto` 의 `SLOT`) — 두 화면이
 * 같은 폭의 열 안에서 같은 비율을 쓰므로 여기서 다른 값을 고를 이유가 없다.
 *
 * **`object-position` 을 주지 않는다** (TASK-94 실측 · 390px). 이 카드가 낮아서 정사각
 * 원본이 크게 잘릴 것 같지만, 재보니 **슬롯이 거의 정사각이다** — 폭 42% 는 147px 이고
 * 카드 높이가 138px(라벨 한 줄) ~ 166px(두 줄)이라 잘려 나가는 것이 한 자릿수 %다.
 * 그래서 가운데 있는 피사체(`element-hwa` 촛불)가 그대로 산다. **21칸짜리 표를 하나 더
 * 만들 이유가 없다.** (히어로는 사정이 다르다 — 거기는 열 폭을 채워 세로로 절반이 잘리고,
 * 그래서 `.hero-photo` 가 크롭 위치를 한 값으로 정한다.)
 */
const SLOT = 240;

/**
 * 판정 사진 (TASK-90).
 *
 * ## `/` 리스트 카드와 같은 방식이다
 *
 * 오른쪽 면을 채우고 `.card-photo`(globals.css)가 글 쪽으로 흐리게 지운다. 사진을 그냥
 * 얹으면 세로 경계선이 하나 생겨 카드가 두 칸으로 쪼개져 보인다. 마스크 규칙을 Tailwind
 * 임의값으로 흩뿌리지 않는 이유도 그쪽과 같다 — 규칙이 한 곳에 있어야 같은 모양이 나온다.
 *
 * ## `priority` 를 주지 않는다
 *
 * `/` 첫 카드는 어느 장이 필요한지 서버가 아는데(세그먼트), **이 사진은 `chart` 가 와야
 * 안다.** 제출 전에는 preload 할 대상이 없으므로 `priority` 가 할 일이 없고, 유형별 후보
 * 전부를 미리 받는 것은 모바일에서 쓰지 않을 장을 받는 것이다.
 *
 * 대신 **`loading="eager"`** 다. 기본값(지연 로드)이면 교차 관찰자가 한 프레임 뒤에
 * 움직이는데, 이 카드가 메우려는 공백이 1초짜리라 그 한 프레임이 아깝다.
 *
 * ## 늦게 와도 레이아웃이 튀지 않는다
 *
 * 사진이 `absolute` 이고 폭이 `%` 로 고정이라 도착 전후로 글의 자리가 같다. 그래서 빈
 * 자리가 잠깐 보일 수는 있어도 읽던 줄이 밀리지는 않는다.
 *
 * ## 장식이므로 `alt` 이 빈 문자열이다
 *
 * 라벨이 바로 옆에 글자로 있다. 사진에 설명을 달면 스크린리더가 판정보다 "잔잔한 물"
 * 을 먼저 읽는다. 출처 표기도 화면이 아니라 `public/verdict/CREDITS.md` 에 둔다.
 */
function VerdictPhoto({ slug }: { slug: string }) {
  return (
    <Image
      src={`/verdict/${slug}.jpg`}
      alt=""
      width={SLOT}
      height={SLOT}
      sizes="(max-width: 640px) 42vw, 220px"
      loading="eager"
      className="card-photo pointer-events-none absolute inset-y-0 right-0 h-full w-[42%] object-cover"
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
  const callout = CALLOUT[readingType](chart);
  if (!callout) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-subtle p-5 shadow-sm sm:p-6">
      {callout.photo ? <VerdictPhoto slug={callout.photo} /> : null}

      {/*
        글은 사진 위에 온다(`relative`). 폭을 사진과 겹치지 않게 잡아야 흐려지는 구간에
        글자가 얹히지 않는다 — 사진 색은 `tokens.test.ts` 검사 밖이라 그 위에 글자를
        올리면 대비를 보증할 수 없다 (`/` 리스트 카드와 같은 판단).
      */}
      <div className={callout.photo ? "relative w-[62%] break-keep" : "relative break-keep"}>
        <p className="text-xs font-bold tracking-wide text-ink-muted">이 사주에서 읽은 한 줄</p>
        <p className="mt-1 text-xl font-bold text-brand-ink sm:text-2xl">{callout.label}</p>
        <p className="mt-2 text-sm text-ink-soft">{callout.basis}</p>
      </div>
    </section>
  );
}
