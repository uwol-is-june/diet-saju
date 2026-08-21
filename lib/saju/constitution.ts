/**
 * 체질 경향 판정. 순수 함수 모듈 — 라이브러리도 I/O 도 없다.
 *
 * **판정은 여기서 하고 LLM 은 서술만 한다.** 출력이 프롬프트에 `계산 완료 · 수정 금지` 로
 * 들어간다. 같은 사주면 언제나 같은 판정이어야 하므로 **새 축은 동점 처리를 함께 고정한다.**
 *
 * - **고전**: 오행-신체 배속, 조후(월령의 한난 → 원국 화·수 세력으로 보정), 십신 5분류
 * - **우리 관례**: 과다/부족 임계값, 한열 5단계 눈금, 십신 그룹 → 살이 붙는 패턴 대응표,
 *   동점 처리 순서. 전부 아래 상수로 모아 뒀다.
 *
 * **의학적 주장을 하지 않는다.** 사용자에게 나가는 문구는 전부 생활 습관 언어다.
 * 장부 이름(`classical`)은 출처 표기이며 프롬프트로 내보내지 않는다.
 * 금지 어휘는 `constitution.test.ts` 가 이 파일의 모든 문구를 훑어 막는다.
 */
import {
  SIPSIN_GROUPS,
  jiSipsin,
  sipsinGroup,
  sipsinOf,
  type GanjiIndex,
  type Ohaeng,
  type Season,
  type SipsinGroup,
} from "./ganji";
import type { OhaengAnalysis, StrengthAnalysis } from "./analysis";

const OHAENG_LIST: readonly Ohaeng[] = ["목", "화", "토", "금", "수"];

// ── 1. 오행 과다 / 부족 ────────────────────────────────────────────────────
export type BalanceLevel = "과다" | "적정" | "부족";

/**
 * **우리 관례**: 평균 대비 비율로 과다·부족을 가른다.
 * **절대 개수로 자르지 말 것** — 시각 미상이면 글자가 6개뿐이라 같은 "2개" 의 무게가 다르다.
 */
export const EXCESS_RATIO = 1.5;
export const DEFICIENT_RATIO = 0.5;

// ── 2. 한열 (조후) ─────────────────────────────────────────────────────────
/**
 * **라벨은 문장에 그대로 들어가는 말이어야 한다** (TASK-117).
 *
 * 예전 값은 `한 · 서늘 · 중화 · 따뜻 · 열` 이었고 다섯 중 둘만 우리말이었다. 특히 `한`(寒)은
 * 관형사 `한`(一)과 충돌해 **본문이 다른 뜻으로 읽혔다** — `늘 서늘한 기운이 맴도는 한
 * 체질입니다` 가 "어떤 체질" 이 된다. 프롬프트가 라벨을 그대로 쓰라고 요구하므로
 * (인용률 99%) **라벨이 곧 사용자가 만나는 용어**다.
 */
export type ThermalTendency = "찬 쪽" | "서늘한 쪽" | "고른 쪽" | "따뜻한 쪽" | "더운 쪽";

/**
 * **고전**: 조후는 월령(태어난 계절)의 한난을 먼저 보고, 원국의 화·수 세력으로 보정한다.
 * **우리 관례**: 그 둘을 각각 −1·0·+1 로 두고 더해 5단계로 표현한다.
 *   (봄·가을은 치우침 없음으로 0)
 */
const SEASON_TILT: Record<Season, number> = { 봄: 0, 여름: 1, 가을: 0, 겨울: -1 };

/** 두 기울기의 합(−2~+2)을 눈금 인덱스(0~4)로 옮긴다. */
const THERMAL_SCALE: readonly ThermalTendency[] = [
  "찬 쪽",
  "서늘한 쪽",
  "고른 쪽",
  "따뜻한 쪽",
  "더운 쪽",
];

// ── 3. 대사 기조 ───────────────────────────────────────────────────────────
export type MetabolismTendency = "발산형" | "축적형";

// ── 4. 살이 붙는 패턴 ──────────────────────────────────────────────────────
export type GainPattern = "근육형" | "식욕형" | "불규칙형" | "스트레스형" | "움직임 부족형";

/**
 * **우리 관례**: 십신 우세 그룹 → 체중이 늘어나는 상황. 고전 상의(象意)에서 끌어왔지만
 * "살이 붙는 패턴" 이라는 축 자체는 이 서비스가 만든 것이다.
 */
const PATTERN_OF_GROUP: Record<SipsinGroup, GainPattern> = {
  비겁: "근육형",
  식상: "식욕형",
  재성: "불규칙형",
  관성: "스트레스형",
  인성: "움직임 부족형",
};

// ── 5. 다이어트 접근 순서 ──────────────────────────────────────────────────
export type DietApproach = "활동량 우선" | "리듬 고정 우선" | "식사량 조절 우선" | "회복 우선";

/** 살이 붙는 패턴이 어느 쪽에 걸리는지 — 접근 순서 판정의 두 번째 축 */
export type GainSite = "움직임" | "먹는 것";

/** **우리 관례**: 살이 붙는 패턴 → 걸리는 지점. 근거는 `GAIN_PATTERN_NOTE` 의 각 문구다. */
const SITE_OF_PATTERN: Record<GainPattern, GainSite> = {
  근육형: "움직임",
  "움직임 부족형": "움직임",
  식욕형: "먹는 것",
  불규칙형: "먹는 것",
  스트레스형: "먹는 것",
};

/**
 * **우리 관례**: 대사 기조 × 걸리는 지점 → 무엇을 먼저 고정하는가.
 *
 * **2×2 라서 동점이 없다** (두 입력이 각각 이미 결정론적이다).
 * **한열을 여기 섞지 말 것** — 한열은 같은 순서를 어느 온도·시간대에 실행하느냐를 정하는
 * 다른 층이고(`THERMAL_GUIDE`), 섞으면 칸이 20가지가 되어 각 칸의 근거를 설명할 수 없다.
 */
const APPROACH_TABLE: Record<MetabolismTendency, Record<GainSite, DietApproach>> = {
  발산형: { 움직임: "활동량 우선", "먹는 것": "식사량 조절 우선" },
  축적형: { 움직임: "회복 우선", "먹는 것": "리듬 고정 우선" },
};

// ── 6. 실행 방법 — 움직임의 종류와 식사 순서 ───────────────────────────────
/**
 * **방법은 구체적으로, 수치는 계속 막는다.** 층을 섞지 않는다.
 *
 * | 층 | 정하는 것 | 근거 축 |
 * | --- | --- | --- |
 * | 무엇을 먼저 고정하는가 | `dietApproach` | 대사 기조 × 걸리는 지점 |
 * | **어떤 종류로 움직이는가** | `movementKind` | ← `dietApproach` (여기) |
 * | **어떤 순서로 먹는가** | `mealSequence` | ← `gainPattern` (여기) |
 * | 언제·어떤 온도로 실행하는가 | `thermal` | 한열 (`THERMAL_GUIDE`) |
 *
 * **시간대와 온도를 이 표에 넣지 말 것** (한열이 정하는 다른 층이다).
 * 두 표 모두 이미 결정론적인 축에서 **1:1 로 파생**되므로 새 동점이 없다.
 */
export type MovementKind = "유산소 중심" | "근력 중심" | "풀어 주는 쪽" | "낮은 강도로 오래";

/**
 * 대표 종목과 대안. **새 판정 축이 아니라 이 표의 필드다** — `movementKind` 에서 1:1 로
 * 파생되므로 새 동점 처리가 없다. 별도 축으로 만들면 그 축의 동점을 새로 정해야 한다.
 *
 * **종목 선택에 한열을 넣지 않는다.** `exercise` 콜아웃이 두 표에서 각자 가져와 합친다
 * (종목 = 여기, 실행 조건 = `THERMAL_GUIDE`).
 *
 * **수치는 계속 막는다** — 종목 이름과 강도의 감각까지만. 횟수·세트·분·심박수·기간 금지.
 */
export const MOVEMENT_PLAN: Record<
  DietApproach,
  { kind: MovementKind; primary: string; alternatives: string[]; how: string; caution: string }
> = {
  "활동량 우선": {
    kind: "유산소 중심",
    primary: "빠르게 걷기",
    alternatives: ["자전거 타기", "가벼운 등산", "수영"],
    how: "걷기나 자전거처럼 오래 이어지는 움직임을 먼저 늘린다. 한 번의 길이보다 하는 횟수를 먼저 올린다.",
    caution: "숨이 조금 차되 말은 이어지는 정도까지만. 그 위로 올리면 며칠 만에 멈춘다.",
  },
  "식사량 조절 우선": {
    kind: "근력 중심",
    primary: "맨몸 스쿼트",
    alternatives: ["계단 오르기", "밴드 당기기", "벽 짚고 팔굽혀펴기"],
    how: "움직임은 지금 하던 만큼 유지하되 버티는 힘을 쓰는 쪽을 남겨 둔다. 맨몸으로 앉았다 일어서기, 계단 오르기처럼 가진 무게를 쓰는 것이면 된다.",
    caution: "먹는 양을 손대는 동안 움직임까지 함께 늘리면 둘 다 오래가지 않는다.",
  },
  "회복 우선": {
    kind: "풀어 주는 쪽",
    primary: "천천히 걷기",
    alternatives: ["스트레칭", "가벼운 요가", "호흡 고르기"],
    how: "스트레칭과 천천히 걷기처럼 회복을 방해하지 않는 것부터 넣는다. 잠과 쉬는 시간이 먼저 확보된 뒤에 활동량을 올린다.",
    caution: "지탱하는 힘이 얇을 때 강도를 올리면 회복이 밀려 오히려 멈춘다.",
  },
  "리듬 고정 우선": {
    kind: "낮은 강도로 오래",
    primary: "같은 시각에 걷기",
    alternatives: ["실내 자전거", "집안일로 몸 쓰기", "가벼운 체조"],
    how: "매일 같은 시각에 반복할 수 있을 만큼 낮은 강도로 둔다. 무엇을 하느냐보다 같은 시각에 하느냐가 먼저다.",
    caution: "강도를 올리면 시각이 다시 흐트러진다. 리듬이 잡힌 뒤에 손대는 것이 순서다.",
  },
};

/**
 * 살이 붙는 패턴 → 식사 순서 (1:1 파생이라 새 판정이 아니다).
 *
 * **식품 이름을 여기 적지 않는다.** 무엇을 먹을지는 `ELEMENT_FOOD`(오행)와
 * `THERMAL_GUIDE`(조리·온도)가 정하고, 이 표는 **순서와 시각의 규칙**만 정한다 —
 * 섞으면 목록 밖 식품이 이 표를 통해 새어 나간다.
 */
export const MEAL_PLAN: Record<GainPattern, { sequence: string; timing: string }> = {
  근육형: {
    sequence: "한 끼에 몰아 채우지 않고 끼니 사이 간격을 고르게 둔다.",
    timing: "운동한 날일수록 끼니를 건너뛰지 않는다. 거른 자리는 다음 끼니에 몰린다.",
  },
  식욕형: {
    sequence: "그릇을 먼저 정해 두고 덜어 먹는다. 무엇을 먼저 집고 무엇을 나중에 집을지 순서를 미리 정해 둔다.",
    timing: "참는 쪽으로 버티지 말고, 먹는 자리와 시각을 정해 두는 쪽으로 간다.",
  },
  불규칙형: {
    sequence: "메뉴를 고르기 전에 먹는 시각부터 정한다.",
    timing: "바깥 일정이 흔들려도 첫 끼 시각만은 고정한다. 나머지는 거기에 맞춰 따라온다.",
  },
  스트레스형: {
    sequence: "긴장이 쌓인 날일수록 늦은 시간에 몰아 먹는 흐름을 먼저 끊는다.",
    timing: "저녁을 뒤로 미루지 말고 이른 쪽으로 당긴다. 늦어질수록 양이 늘어난다.",
  },
  "움직임 부족형": {
    sequence: "앉은 자리에서 이어 먹지 않고 끼니를 분명히 끊어 둔다.",
    timing: "먹고 난 뒤 잠깐이라도 일어나 움직인 다음 다시 앉는다.",
  },
};

// ── 문구 테이블 ────────────────────────────────────────────────────────────
/**
 * 여기 문자열은 프롬프트가 아니라 **판정에 딸린 근거 데이터**다.
 * 프롬프트 문장 자체는 `lib/prompt.ts` 한 곳에 있다.
 */

/** 오행 → 몸의 자리. `classical` 은 배속의 출처이며 사용자에게 내보내지 않는다. */
export const BODY_AXIS: Record<Ohaeng, { axis: string; classical: string }> = {
  목: { axis: "근육과 유연성, 뻗어 나가는 활동", classical: "간·담, 근(筋)" },
  화: { axis: "순환과 열기, 활력의 기복", classical: "심·소장, 혈맥" },
  토: { axis: "소화와 먹는 리듬", classical: "비·위, 기육(肌肉)" },
  금: { axis: "호흡과 피부, 생활 리듬의 규칙성", classical: "폐·대장, 피모(皮毛)" },
  수: { axis: "수분 대사와 회복, 휴식의 질", classical: "신·방광, 골(骨)" },
};

interface Guide {
  tendency: string;
  diet: string;
  exercise: string;
}

/**
 * 오행 과다·부족 → 관리 축. **여기 적힌 말이 본문으로 새어 나갈 수 있다** (프롬프트에
 * 그대로 실리고 절 지침이 "함께 엮으라" 고 한다). 실행 방법 표와 같은 선을 지킨다:
 *
 * - **수치를 쓰지 않는다 — 한글로 쓴 것까지.** `20분 걷기` 도 `한 시간 뒤에` 도 안 된다.
 *   `constitution.test.ts` 가 아라비아 숫자와 "수사 + 측정 단위" 를 양쪽 다 훑는다.
 * - **효능 표현을 쓰지 않는다** (`소화를 돕는`). 모델에게 금지한 어법을 근거 데이터가
 *   쓰면 시킨 말과 준 말이 어긋난다.
 */
export const FOCUS_GUIDE: Record<Ohaeng, Record<"과다" | "부족", Guide>> = {
  목: {
    과다: {
      tendency: "움직이고 싶은 마음이 앞서 무리하기 쉽다",
      diet: "자극적인 맛보다 담백한 쪽으로, 끼니를 거르지 않기",
      exercise: "강도를 올리기보다 같은 강도를 오래, 스트레칭을 곁들이기",
    },
    부족: {
      tendency: "몸을 크게 펴는 움직임이 적어 뻣뻣해지기 쉽다",
      diet: "초록 잎채소와 제철 과일을 한 가지씩 곁들이기",
      exercise: "관절을 펴는 스트레칭이나 요가부터 시작하기",
    },
  },
  화: {
    과다: {
      tendency: "열기가 위로 몰려 밤에 식욕이 오르기 쉽다",
      diet: "늦은 시간의 맵고 뜨거운 음식과 술을 줄이고 물을 자주 마시기",
      exercise: "저녁 고강도보다 낮 시간대의 가벼운 유산소",
    },
    부족: {
      tendency: "몸이 쉽게 식고 활력이 늦게 오른다",
      diet: "익혀서 따뜻하게 먹고 아침을 거르지 않기",
      exercise: "준비운동을 길게 잡아 몸을 데운 뒤 시작하기",
    },
  },
  토: {
    과다: {
      tendency: "먹는 즐거움이 커서 한 번에 양이 늘기 쉽다",
      diet: "그릇을 작게 쓰고 천천히 씹기",
      exercise: "식사 뒤에 앉은 자리를 뜨고 가볍게 걷기",
    },
    부족: {
      tendency: "식사 시간이 흐트러지고 속이 부담을 느끼기 쉽다",
      diet: "정해진 시간에 소량씩, 국이나 죽처럼 부담이 적은 것부터",
      exercise: "공복 고강도는 피하고 속이 편안해진 뒤에 가볍게",
    },
  },
  금: {
    과다: {
      tendency: "규칙을 세게 잡다가 긴장이 쌓이기 쉽다",
      diet: "여러 규칙 대신 지킬 수 있는 한 가지만 정하기",
      exercise: "걷기나 수영처럼 호흡 리듬이 일정한 운동",
    },
    부족: {
      tendency: "생활 리듬이 들쭉날쭉해지기 쉽다",
      diet: "메뉴보다 식사 시각을 먼저 고정하기",
      exercise: "짧아도 매일 같은 시간에 반복하기",
    },
  },
  수: {
    과다: {
      tendency: "몸이 무겁고 붓는 느낌이 오기 쉽다",
      diet: "짠 음식과 늦은 밤의 수분을 줄이기",
      exercise: "땀이 살짝 날 정도로 매일 조금씩",
    },
    부족: {
      tendency: "회복이 더디고 쉽게 건조해진다",
      diet: "물을 한 번에 몰아 마시지 말고 나눠서 자주 마시기",
      exercise: "강도를 낮추고 수면 시간을 먼저 확보하기",
    },
  },
};

/**
 * 오행 → 재료 범주.
 *
 * **고전**: 오행-오미(목=신맛·화=쓴맛·토=단맛·금=매운맛·수=짠맛)와 오행-오색 배속.
 * **우리 관례**: 그 배속에서 한국에서 흔히 구하는 재료를 고른 목록. 문헌값이 아니다.
 *
 * **목록은 코드가 닫고 프롬프트가 "이 밖의 식품 이름을 쓰지 말라" 고 지시한다.**
 * 지키는 선:
 *
 * - **재료 범주까지만.** 상표·영양제·보조식품·다이어트 식단 이름 금지.
 * - **성미(性味) 용어를 쓰지 않는다** (면책 고지의 "한의학과 무관" 약속이 깨진다).
 *   조리·온도는 `THERMAL_GUIDE` 가 이미 담고 있다 — 여기서 표를 새로 만들지 않는다.
 * - **효능을 말하지 않는다.** "무엇을 곁들일 수 있나" 만 말한다.
 * - `constitution.test.ts` 가 금지 어휘·처방 어휘·숫자를 이 표에도 적용한다.
 *
 * `short` 는 `diet-food` 콜아웃 라벨과 공유 카드 칩에 **크게 뜨는 이름**이다.
 *
 * - **`groups` 에서 코드로 뽑을 수 없다** (둘을 섞은 값이다). 손으로 적되 `Record` 를 유지한다.
 * - **맛(매운맛·쓴맛)을 여기 올리지 않는다** — 몸의 온도가 `더운 쪽` 인 사람 화면에서
 *   `THERMAL_GUIDE["더운 쪽"]` 과 정면으로 부딪힌다. **재료는 오행, 조리·온도는 한열.**
 */
export const ELEMENT_FOOD: Record<
  Ohaeng,
  { basis: string; groups: readonly string[]; short: string }
> = {
  목: {
    basis: "신맛·푸른색",
    groups: ["초록 잎채소", "나물과 새싹", "신맛이 도는 제철 과일"],
    short: "초록 잎채소",
  },
  화: {
    basis: "쓴맛·붉은색",
    groups: ["붉은 채소", "쓴맛이 도는 나물", "팥과 수수"],
    short: "붉은 채소",
  },
  토: {
    basis: "단맛·노란색",
    groups: ["뿌리채소", "단호박과 고구마", "기장과 좁쌀"],
    short: "뿌리채소",
  },
  금: {
    basis: "매운맛·흰색",
    groups: ["무와 양파, 대파", "버섯", "배와 도라지"],
    short: "무와 버섯",
  },
  수: {
    basis: "짠맛·검은색",
    groups: ["콩과 두부", "해조류", "검은콩과 검은쌀"],
    short: "콩과 해조류",
  },
};

/**
 * 그 재료를 **어떻게 다룰지.** 알레르기·지병·복약·임신 여부를 입력받지 않으므로
 * "많이 먹어라 / 끊어라" 로 가지 않는다 — 부족은 **곁들이기**, 과다는 **더 늘리지 않기** 까지.
 */
export const FOOD_HOW: Record<"과다" | "부족", string> = {
  부족: "밥상에 한 가지씩 곁들이는 정도로 쓴다. 많이 먹으라는 뜻이 아니다.",
  과다: "이미 넉넉한 계열이라 굳이 더 늘리지 않아도 된다. 끊으라는 뜻은 아니다.",
};

export const THERMAL_GUIDE: Record<ThermalTendency, Guide> = {
  "찬 쪽": {
    tendency: "몸이 차가운 쪽으로 기운 편",
    diet: "익혀서 따뜻하게 먹고 찬 음료를 줄이기",
    exercise: "실내에서 몸을 데운 뒤 움직이고 새벽 야외 운동은 피하기",
  },
  "서늘한 쪽": {
    tendency: "약간 서늘한 쪽으로 기운 편",
    diet: "하루 첫 끼를 따뜻한 것으로 시작하기",
    exercise: "준비운동을 충분히 하고 들어가기",
  },
  "고른 쪽": {
    tendency: "몸의 온도가 크게 치우치지 않은 편",
    diet: "음식 온도를 가리기보다 양과 시간에 집중하기",
    exercise: "계절에 맞춰 강도를 조절하기",
  },
  "따뜻한 쪽": {
    tendency: "약간 더운 쪽으로 기운 편",
    diet: "기름지고 자극적인 음식을 줄이기",
    exercise: "한낮 고강도는 피하기",
  },
  "더운 쪽": {
    tendency: "열기가 위로 뜨기 쉬운 편",
    diet: "찬물보다 미지근한 물을 자주, 맵고 뜨거운 음식과 술을 줄이기",
    exercise: "이른 아침이나 해가 진 뒤의 서늘한 시간대에 하기",
  },
};

export const METABOLISM_NOTE: Record<MetabolismTendency, string> = {
  발산형:
    "일간을 돕는 힘이 넉넉해 기운이 밖으로 도는 편이다. 먹는 양을 줄이는 것보다 쓰는 양을 늘리는 순서가 잘 맞는다.",
  축적형:
    "일간을 돕는 힘이 얇아 쌓아 두려는 쪽이다. 무리하게 줄이기보다 수면과 끼니를 먼저 고정하고 강도는 나중에 올리는 순서가 맞는다.",
};

/**
 * 살이 붙는 패턴의 **한 줄 라벨.** 화면 콜아웃과 프롬프트가 함께 쓴다.
 * `gainPattern` 에서 1:1 로 파생되므로 새 동점 처리가 없다.
 *
 * **형태는 "~할 때 붙는 성향" 으로 고정한다.** 서술은 단정형이지만 주장하는 것은 그 성향이
 * 드러나는 자리와 상황까지다 — `~할 때` 는 언제인지만 말하고 원인을 말하지 않는다.
 * `~해서`·`~라서` 로 바꾸면 몸의 인과를 주장하는 문장이 된다.
 * `constitution.test.ts` 가 인과 어미와 hedge 어미를 **양쪽에서** 막고 형태도 고정한다.
 * **`결` 을 쓰지 않는다.**
 */
export const GAIN_LABEL: Record<GainPattern, string> = {
  근육형: "몰아붙일 때 붙는 성향",
  식욕형: "먹는 자리에서 붙는 성향",
  불규칙형: "때를 놓칠 때 붙는 성향",
  스트레스형: "긴장이 쌓일 때 붙는 성향",
  "움직임 부족형": "덜 움직일 때 붙는 성향",
};

export const GAIN_PATTERN_NOTE: Record<GainPattern, string> = {
  근육형:
    "겨루듯 몰아붙이기 쉬운 쪽이다. 체중 숫자보다 몸의 구성이 더 의미 있고, 한 번에 쏟아붓는 방식은 오래가지 않는다.",
  식욕형:
    "먹고 만들고 나누는 즐거움이 큰 쪽이다. 참는 방식보다 먹는 순서와 그릇 크기를 조절하는 쪽이 오래간다.",
  불규칙형:
    "바깥 일정에 끌려 식사 시간이 들쭉날쭉해지기 쉬운 쪽이다. 메뉴보다 시간을 먼저 고정하는 것이 낫다.",
  스트레스형:
    "긴장을 오래 붙들고 있는 쪽이다. 압박이 쌓인 날 늦은 시간에 몰아 먹는 흐름을 먼저 끊는 것이 좋다.",
  "움직임 부족형":
    "받아들이고 쌓는 힘이 강한 쪽이다. 활동량이 줄면 바로 붙으므로 앉아 있는 시간을 끊어 주는 것이 먼저다.",
};

/**
 * 접근 순서에 딸린 근거 문구. `order` 는 무엇을 먼저 하는가, `caution` 은 그 순서를 지킬 때
 * 흔히 어긋나는 지점이다. **둘 다 생활 습관 수준을 넘지 않는다** — 단식·식단 이름·칼로리·
 * 목표 체중 금지 (`constitution.test.ts` 가 막는다).
 */
export const DIET_APPROACH_NOTE: Record<DietApproach, { order: string; caution: string }> = {
  "활동량 우선": {
    order:
      "쓰는 양을 먼저 늘리고 먹는 양은 그다음에 손댄다. 앉아 있는 시간을 끊는 것이 첫 단계다.",
    caution:
      "한 번에 강도를 올리면 며칠 만에 멈춘다. 같은 강도를 자주 반복하는 쪽이 오래간다.",
  },
  "식사량 조절 우선": {
    order:
      "먹는 양과 순서를 먼저 손대고 움직임은 지금 하던 만큼 유지한다. 그릇 크기와 먹는 순서가 첫 단계다.",
    caution:
      "끼니를 거르는 방식으로 양을 줄이면 다음 끼니에 몰린다. 줄이는 것은 끼니 수가 아니라 한 번의 양이다.",
  },
  "리듬 고정 우선": {
    order:
      "먹는 시각과 자는 시각을 먼저 고정하고, 양과 강도는 리듬이 잡힌 뒤에 손댄다.",
    caution:
      "메뉴를 먼저 바꾸면 시각이 다시 흐트러진다. 무엇을 먹을지보다 언제 먹을지가 먼저다.",
  },
  "회복 우선": {
    order: "잠과 쉬는 시간을 먼저 확보하고, 활동량은 그다음에 조금씩 올린다.",
    caution:
      "지탱하는 힘이 얇은 상태에서 강도를 올리면 회복이 밀려 오히려 멈춘다. 늘리는 것은 한 번의 길이가 아니라 횟수부터다.",
  },
};

/**
 * 판정 콜아웃(`VerdictCallout`)의 **근거 줄.** 라벨의 뜻을 생활어 한 줄로 옮긴 표다.
 *
 * **판정 축의 이름을 대지 않는다.** 예전에는 `대사 기조 발산형 · 걸리는 지점 먹는 것에서
 * 나온 순서입니다` 처럼 `<축 이름> <값>` 을 조사 없이 붙여 표를 문장인 척 늘어놓았다.
 * 결과 화면 맨 위이고 본문 첫 글자보다 먼저 뜨는 자리라, 모르는 말로 출처를 대면 범위
 * 한정이 아니라 권위 신호가 된다. **판정의 범위를 한정하는 일은 이제 `ResultView` 하단 고정
 * 문구 하나가 맡는다** — 눈썹 줄은 유형이 답하는 질문을 말하는 줄이 되고(TASK-111)
 * `내 사주` 묶음 머리는 없어졌다(TASK-112).
 *
 * - **용어를 괄호로 풀지 않는다.** 글 폭이 좁아 용어 하나에 줄이 하나 자란다. 용어 풀이는
 *   `SYSTEM_INSTRUCTION` 이 본문의 일로 정해 뒀다.
 * - **`DIET_APPROACH_NOTE` 를 참조하지 않는다.** 그쪽은 프롬프트가 "풀어 쓰라" 고 넘기는
 *   값이라 그대로 가져오면 카드와 본문 첫 문단이 같은 말을 한다.
 * - 전부 이미 결정론적인 축에서 **1:1 로 파생**된다 — 새 판정 축도 새 동점 처리도 없다.
 * - **두 줄 안에 들어가는 길이로 둔다.** 세 줄이 되면 큰 글자 라벨이 카드의 주인 자리를
 *   잃는다. 지금 문구는 축 값 조합 29가지가 전부 두 줄이다 (390px · `text-sm` · 글 폭
 *   191px · 2026-08-20 측정). **문구를 늘릴 때 다시 잰다.**
 */
export const VERDICT_BASIS_METABOLISM: Record<MetabolismTendency, string> = {
  발산형: "먹는 양을 줄이기보다 움직임을 늘리는 쪽이 잘 맞습니다",
  축적형: "먹는 양을 줄이기보다 잠과 끼니를 먼저 챙기는 쪽이 잘 맞습니다",
};

export const VERDICT_BASIS_GAIN: Record<GainPattern, string> = {
  근육형: "한 번에 몰아붙이기보다 꾸준히 이어 가는 쪽이 낫습니다",
  식욕형: "참기보다 먹는 순서와 그릇 크기를 바꾸는 쪽이 낫습니다",
  불규칙형: "무엇을 먹을지보다 언제 먹을지를 먼저 정하는 쪽이 낫습니다",
  스트레스형: "늦은 밤에 몰아 먹는 흐름을 먼저 끊는 쪽이 낫습니다",
  "움직임 부족형": "앉아 있는 시간을 끊어 주는 것이 먼저입니다",
};

export const VERDICT_BASIS_APPROACH: Record<DietApproach, string> = {
  "활동량 우선": "먹는 양보다 움직이는 양을 먼저 늘립니다",
  "식사량 조절 우선": "움직임은 그대로 두고, 먹는 양과 순서를 먼저 바꿉니다",
  "리듬 고정 우선": "먹는 시각과 자는 시각부터 고정하고, 양은 그다음입니다",
  "회복 우선": "잠과 쉬는 시간을 먼저 확보하고, 움직임은 그다음입니다",
};

/**
 * 근거 줄의 빈칸. **문장은 표가 통째로 들고 값만 끼운다** — 컴포넌트가 조각을 이어 붙이면
 * 그 문장이 `constitution.test.ts` 의 금지 어휘 검사를 통째로 우회한다.
 */
const TIME_SLOT = "{시간대}";
const ELEMENT_SLOT = "{이름}";
const FOOD_SLOT = "{맛과 빛깔}";

/**
 * 운동 유형의 근거 줄. **종목은 라벨이 이미 말했으므로 여기는 강도와 때만 말한다.**
 * 두 칸만 한열의 시간대를 받는다 — 나머지 둘은 강도 자체가 조건이라 시간대가 붙지 않는다.
 */
export const VERDICT_BASIS_MOVEMENT: Record<DietApproach, string> = {
  "활동량 우선": `숨이 조금 차는 정도로, ${TIME_SLOT} 합니다`,
  "식사량 조절 우선": "지금 하던 움직임은 두고, 무게를 쓰는 것만 더합니다",
  "회복 우선": `회복을 방해하지 않을 만큼 가볍게, ${TIME_SLOT} 합니다`,
  "리듬 고정 우선": "매일 같은 시각에 반복할 만큼 낮은 강도로 합니다",
};

/**
 * 한열 → 언제 움직이는가. `THERMAL_GUIDE.exercise` 를 그대로 쓰지 않는 이유는 그쪽이
 * 프롬프트로 나가는 본문용 문장이고 이 자리에 넣으면 두 줄을 넘기기 때문이다.
 * **온도·조리는 여기 없다** — 이 표는 때만 정한다.
 */
export const VERDICT_TIME_SLOT: Record<ThermalTendency, string> = {
  "찬 쪽": "실내에서",
  "서늘한 쪽": "몸을 푼 뒤에",
  "고른 쪽": "계절에 맞는 때에",
  "따뜻한 쪽": "한낮을 피해",
  "더운 쪽": "해가 진 뒤에",
};

/**
 * 식단 유형의 근거 줄. 부족한 계열이 있으면 그 계열이 무엇으로 알아볼 수 있는 쪽인지와
 * **한 가지씩만** 을 함께 말한다 (라벨의 재료 이름이 "그것만 먹으라" 로 읽히지 않게 한다).
 */
export const VERDICT_BASIS_FOOD = `${ELEMENT_SLOT} 계열은 ${FOOD_SLOT} 쪽입니다. 밥상에 한 가지씩만 올리면 됩니다`;
export const VERDICT_BASIS_FOOD_EVEN = "한쪽으로 치우친 계열이 없습니다. 지금 먹는 대로 두면 됩니다";

/** 운동 유형 근거 줄 — 종목 층(접근 순서)과 때 층(한열)을 각자의 표에서 받아 끼운다. */
export function verdictMovementBasis(approach: DietApproach, thermal: ThermalTendency): string {
  return VERDICT_BASIS_MOVEMENT[approach].replace(TIME_SLOT, VERDICT_TIME_SLOT[thermal]);
}

/** 식단 유형 근거 줄 — 부족한 계열이 없으면 지어내지 않는다 (그 사실 자체가 판정이다). */
export function verdictFoodBasis(element: Ohaeng | undefined): string {
  if (!element) return VERDICT_BASIS_FOOD_EVEN;
  return VERDICT_BASIS_FOOD.replace(ELEMENT_SLOT, element).replace(
    FOOD_SLOT,
    ELEMENT_FOOD[element].basis,
  );
}

// ── 판정 ───────────────────────────────────────────────────────────────────
export interface ConstitutionFocus {
  element: Ohaeng;
  level: "과다" | "부족";
  /** 몸의 자리 — 생활어 */
  axis: string;
  tendency: string;
  diet: string;
  exercise: string;

  /** 재료 범주. **조리·온도는 여기 없다** — 한열(`thermalDiet`)이 정한다. */
  foodBasis: string;
  foodGroups: readonly string[];
  foodHow: string;
}

export interface ConstitutionAnalysis {
  /** 오행별 3단계 — 점수가 평균의 몇 배인지로 가른다 (우리 관례) */
  balance: Record<Ohaeng, BalanceLevel>;
  excess: Ohaeng[];
  deficient: Ohaeng[];
  /** 과다·부족이 하나도 없는가 (고르게 퍼진 원국) */
  even: boolean;

  /** 한열 — 조후 */
  thermal: ThermalTendency;
  /** 한열 판정의 근거: 계절 기울기 + 원국 화·수 기울기 (−2~+2) */
  thermalScore: number;
  thermalTendency: string;
  thermalDiet: string;
  thermalExercise: string;

  /** 신강/신약에서 오는 대사 기조 */
  metabolism: MetabolismTendency;
  metabolismNote: string;

  /** 일간을 뺀 글자들의 십신 그룹 분포 */
  sipsinGroups: Record<SipsinGroup, number>;
  dominantGroup: SipsinGroup;
  gainPattern: GainPattern;
  gainPatternNote: string;
  /** 패턴의 한 줄 라벨. 화면 콜아웃과 프롬프트가 함께 쓴다. */
  gainLabel: string;

  /** 접근 순서 — 대사 기조 × 걸리는 지점 (우리 관례). LLM 이 다시 정하지 않는다. */
  gainSite: GainSite;
  dietApproach: DietApproach;
  dietApproachOrder: string;
  dietApproachCaution: string;

  /**
   * 실행 방법. 접근 순서·패턴에서 1:1 파생이라 새 동점이 없다.
   * **시간대와 온도는 여기 없다** — 한열(`thermal*`)이 정하는 다른 층이다.
   */
  movementKind: MovementKind;
  /** 대표 종목과 대안. `movementKind` 에서 1:1 파생이라 새 동점이 없다. */
  movementPrimary: string;
  movementAlternatives: string[];
  movementHow: string;
  movementCaution: string;
  mealSequence: string;
  mealTiming: string;

  /** 과다·부족 오행마다의 관리 축. 과다 먼저, 그다음 부족 (오행 순서 유지) */
  focus: ConstitutionFocus[];
}

export interface ConstitutionInput {
  ilgan: number;
  year: GanjiIndex;
  month: GanjiIndex;
  day: GanjiIndex;
  hour: GanjiIndex | null;
  ohaeng: OhaengAnalysis;
  strength: StrengthAnalysis;
}

export function analyzeConstitution(input: ConstitutionInput): ConstitutionAnalysis {
  const { ohaeng, strength } = input;

  // ── 오행 과다/부족 ──
  const total = OHAENG_LIST.reduce((sum, element) => sum + ohaeng.score[element], 0);
  const mean = total / OHAENG_LIST.length;

  const balance = {} as Record<Ohaeng, BalanceLevel>;
  for (const element of OHAENG_LIST) {
    const score = ohaeng.score[element];
    balance[element] =
      score >= mean * EXCESS_RATIO ? "과다" : score <= mean * DEFICIENT_RATIO ? "부족" : "적정";
  }
  const excess = OHAENG_LIST.filter((element) => balance[element] === "과다");
  const deficient = OHAENG_LIST.filter((element) => balance[element] === "부족");

  // ── 한열 (조후) ──
  // 계절이 먼저, 원국의 화·수 세력이 보정. 동점이면 치우침 없음으로 둔다.
  const chartTilt =
    ohaeng.score.화 > ohaeng.score.수 ? 1 : ohaeng.score.화 < ohaeng.score.수 ? -1 : 0;
  const thermalScore = SEASON_TILT[ohaeng.season] + chartTilt;
  const thermal = THERMAL_SCALE[thermalScore + 2]!;

  // ── 대사 기조 ──
  // 신강 계열은 쓸 힘이 있고, 신약 계열은 회복이 먼저다.
  const metabolism: MetabolismTendency =
    strength.verdict === "신강" || strength.verdict === "약간 신강" ? "발산형" : "축적형";

  // ── 살이 붙는 패턴 ──
  const sipsinGroups = countSipsinGroups(input);
  // 동점이면 고전 십신 순서(비겁→식상→재성→관성→인성)에서 앞선 쪽. 결정론을 위해 고정한다.
  const dominantGroup = SIPSIN_GROUPS.reduce((best, group) =>
    sipsinGroups[group] > sipsinGroups[best] ? group : best,
  );
  const gainPattern = PATTERN_OF_GROUP[dominantGroup];

  // ── 다이어트 접근 순서 ──
  // 2×2 표라 동점이 없다. 두 입력이 이미 결정론적이므로 같은 사주면 같은 방식이 나온다.
  const gainSite = SITE_OF_PATTERN[gainPattern];
  const dietApproach = APPROACH_TABLE[metabolism][gainSite];

  // ── 관리 축 ──
  const focus: ConstitutionFocus[] = [
    ...excess.map((element) => toFocus(element, "과다")),
    ...deficient.map((element) => toFocus(element, "부족")),
  ];

  return {
    balance,
    excess,
    deficient,
    even: excess.length === 0 && deficient.length === 0,

    thermal,
    thermalScore,
    thermalTendency: THERMAL_GUIDE[thermal].tendency,
    thermalDiet: THERMAL_GUIDE[thermal].diet,
    thermalExercise: THERMAL_GUIDE[thermal].exercise,

    metabolism,
    metabolismNote: METABOLISM_NOTE[metabolism],

    sipsinGroups,
    dominantGroup,
    gainPattern,
    gainPatternNote: GAIN_PATTERN_NOTE[gainPattern],
    gainLabel: GAIN_LABEL[gainPattern],

    gainSite,
    dietApproach,
    dietApproachOrder: DIET_APPROACH_NOTE[dietApproach].order,
    dietApproachCaution: DIET_APPROACH_NOTE[dietApproach].caution,

    movementKind: MOVEMENT_PLAN[dietApproach].kind,
    movementPrimary: MOVEMENT_PLAN[dietApproach].primary,
    movementAlternatives: MOVEMENT_PLAN[dietApproach].alternatives,
    movementHow: MOVEMENT_PLAN[dietApproach].how,
    movementCaution: MOVEMENT_PLAN[dietApproach].caution,
    mealSequence: MEAL_PLAN[gainPattern].sequence,
    mealTiming: MEAL_PLAN[gainPattern].timing,

    focus,
  };
}

function toFocus(element: Ohaeng, level: "과다" | "부족"): ConstitutionFocus {
  const guide = FOCUS_GUIDE[element][level];
  const food = ELEMENT_FOOD[element];
  return {
    element,
    level,
    axis: BODY_AXIS[element].axis,
    tendency: guide.tendency,
    diet: guide.diet,
    exercise: guide.exercise,
    foodBasis: food.basis,
    foodGroups: food.groups,
    foodHow: FOOD_HOW[level],
  };
}

/**
 * 일간을 뺀 글자들의 십신 그룹을 센다.
 *
 * 세는 자리는 `analyzeStrength` 의 판정 글자와 같다 — 년간·년지·월간·월지·일지(·시간·시지).
 * 일간 자신은 비교 기준이므로 제외한다. 두 판정이 다른 글자를 보면 근거가 어긋난다.
 */
function countSipsinGroups(input: ConstitutionInput): Record<SipsinGroup, number> {
  const counts = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 } as Record<SipsinGroup, number>;

  const add = (group: SipsinGroup) => {
    counts[group] += 1;
  };

  const { ilgan } = input;
  add(sipsinGroup(sipsinOf(ilgan, input.year.gan)));
  add(sipsinGroup(jiSipsin(ilgan, input.year.ji)));
  add(sipsinGroup(sipsinOf(ilgan, input.month.gan)));
  add(sipsinGroup(jiSipsin(ilgan, input.month.ji)));
  add(sipsinGroup(jiSipsin(ilgan, input.day.ji)));
  if (input.hour) {
    add(sipsinGroup(sipsinOf(ilgan, input.hour.gan)));
    add(sipsinGroup(jiSipsin(ilgan, input.hour.ji)));
  }

  return counts;
}
