/**
 * 간지(干支) 기본 테이블과 파생 규칙.
 *
 * 순수 함수 모듈 — 외부 라이브러리도 I/O 도 없다. 클라이언트에서도 안전하게 import 가능.
 *
 * 설계 원칙: 인덱스를 단일 표현으로 쓴다.
 * lunar-javascript 는 중국어(간체) 문자열을 돌려주므로 경계에서 즉시 인덱스로 바꾸고,
 * 노출 직전에만 한글로 바꾼다. 문자열을 중간 표현으로 들고 다니면 간체/정체 표기 차이로 깨진다.
 */

/** 천간 10 — 인덱스 0=갑 ... 9=계 */
export const GAN_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
const GAN_HANJA = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

/** 지지 12 — 인덱스 0=자 ... 11=해 */
export const JI_KO = [
  "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해",
] as const;
const JI_HANJA = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

/** 오행 */
export type Ohaeng = "목" | "화" | "토" | "금" | "수";

/** 천간의 오행 */
const GAN_OHAENG: readonly Ohaeng[] = [
  "목", "목", "화", "화", "토", "토", "금", "금", "수", "수",
];

/** 지지의 오행 */
const JI_OHAENG: readonly Ohaeng[] = [
  "수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수",
];

/** 띠 (지지 순서와 일치) */
const JI_ANIMAL = [
  "쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지",
] as const;

// 한자 → 인덱스 역인덱스 (라이브러리 경계에서만 쓴다)
const GAN_INDEX_BY_HANJA = new Map<string, number>(GAN_HANJA.map((c, i) => [c, i]));
const JI_INDEX_BY_HANJA = new Map<string, number>(JI_HANJA.map((c, i) => [c, i]));

/** 한 기둥의 간지를 인덱스 쌍으로 */
export interface GanjiIndex {
  gan: number;
  ji: number;
}

/**
 * lunar-javascript 가 준 간지 2글자(예: "庚午")를 인덱스로 바꾼다.
 * 매핑 실패는 라이브러리 동작이 바뀐 것이므로 조용히 넘기지 않고 던진다.
 */
export function parseGanjiHanja(ganji: string): GanjiIndex {
  const chars = [...ganji];
  const gan = GAN_INDEX_BY_HANJA.get(chars[0] ?? "");
  const ji = JI_INDEX_BY_HANJA.get(chars[1] ?? "");
  if (gan === undefined || ji === undefined) {
    throw new Error(`간지 파싱 실패: "${ganji}" (lunar-javascript 출력 형식 변경 의심)`);
  }
  return { gan, ji };
}

/** 인덱스 → 한글 간지 (예: {gan:6, ji:6} → "경오") */
export function ganjiToKorean({ gan, ji }: GanjiIndex): string {
  return `${GAN_KO[gan]}${JI_KO[ji]}`;
}

/** 기둥의 오행 표기 (천간오행 + 지지오행, 예: "금화") */
export function pillarOhaeng({ gan, ji }: GanjiIndex): string {
  return `${GAN_OHAENG[gan]}${JI_OHAENG[ji]}`;
}

export function ganOhaeng(gan: number): Ohaeng {
  return GAN_OHAENG[gan]!;
}

export function jiOhaeng(ji: number): Ohaeng {
  return JI_OHAENG[ji]!;
}

/** 띠 */
export function jiAnimal(ji: number): string {
  return JI_ANIMAL[ji]!;
}

/** 천간의 음양 — 갑병무경임(짝수 인덱스)이 양 */
export function isYang(gan: number): boolean {
  return gan % 2 === 0;
}

// ── 십신 ──────────────────────────────────────────────────────────────────
/**
 * 오행 관계로 십신을 판정한다.
 *
 * 상생: 목→화→토→금→수→목   (생하는 쪽이 앞)
 * 상극: 목→토→수→화→금→목   (극하는 쪽이 앞)
 */
const OHAENG_ORDER: readonly Ohaeng[] = ["목", "화", "토", "금", "수"];

function ohaengIndex(element: Ohaeng): number {
  return OHAENG_ORDER.indexOf(element);
}

export type Sipsin =
  | "비견" | "겁재" | "식신" | "상관" | "편재"
  | "정재" | "편관" | "정관" | "편인" | "정인";

/**
 * 일간(日干) 기준으로 대상 천간의 십신을 구한다.
 *
 * 같은 오행: 음양 같으면 비견, 다르면 겁재
 * 내가 생함: 같으면 식신, 다르면 상관
 * 내가 극함: 같으면 편재, 다르면 정재
 * 나를 극함: 같으면 편관, 다르면 정관
 * 나를 생함: 같으면 편인, 다르면 정인
 */
export function sipsinOf(ilgan: number, target: number): Sipsin {
  const me = ohaengIndex(ganOhaeng(ilgan));
  const it = ohaengIndex(ganOhaeng(target));
  const samePolarity = isYang(ilgan) === isYang(target);

  // 상생 순환(목화토금수)에서 한 칸 뒤가 "내가 생하는 것"
  const diff = (it - me + 5) % 5;

  switch (diff) {
    case 0:
      return samePolarity ? "비견" : "겁재";
    case 1:
      return samePolarity ? "식신" : "상관";
    // 상생으로 두 칸 뒤 = 내가 극하는 것 (목→토, 화→금 …)
    case 2:
      return samePolarity ? "편재" : "정재";
    // 세 칸 뒤 = 나를 극하는 것
    case 3:
      return samePolarity ? "편관" : "정관";
    // 네 칸 뒤 = 나를 생하는 것
    default:
      return samePolarity ? "편인" : "정인";
  }
}

// ── 시주(時柱) ────────────────────────────────────────────────────────────
/**
 * 시각 → 시지(時支) 인덱스.
 *
 * 자시는 23:00~00:59 로 자정을 걸친다. 나머지는 홀수시에 시작한다.
 * (축 01~02, 인 03~04, … 해 21~22)
 */
export function hourToJiIndex(hour: number): number {
  return Math.floor(((hour + 1) % 24) / 2);
}

/**
 * 시간(時干) 인덱스 — 오서둔(五鼠遁).
 *
 * 일간에 따라 자시의 천간이 정해지고(갑기일→갑자시, 을경일→병자시 …),
 * 거기서 시지만큼 순행한다.
 */
export function hourGanIndex(ilgan: number, jiIndex: number): number {
  return ((ilgan % 5) * 2 + jiIndex) % 10;
}

// ── 지장간(支藏干) ────────────────────────────────────────────────────────
/**
 * 지지가 품은 천간 전부 — **여기(餘氣) · 중기(中氣) · 정기(正氣)** 순.
 *
 * 마지막 항목이 정기(=본기)이고 `jiBongi` 가 그것을 읽는다. 표를 두 벌로 두면
 * 어긋나므로 본기를 따로 적지 않는다.
 *
 * **일수 가중치(여기 7일·중기 3일 …)를 쓰지 않는다.** 일수 배분은 유파마다 다르지만
 * "어느 천간이 들었는가" 는 이견이 거의 없다. 있나 없나만 보면 우리 관례를 늘리지
 * 않고 고전 규칙 안에 머문다.
 *
 * 판본 차이가 있는 자리 (채택한 쪽을 적어 둔다 · `docs/saju-validation.md` 3-2):
 * - 오(午)의 중기 기(己) — 넣는 판본을 따랐다
 * - 해(亥)의 여기 무(戊) — 넣는 판본을 따랐다
 * - 신(申)의 여기는 무(戊)로 둔다 (기(己)로 적는 판본도 있다)
 */
const JI_JANGGAN: readonly (readonly number[])[] = [
  [8, 9], //       자 → 임 계
  [9, 7, 5], //    축 → 계 신 기
  [4, 2, 0], //    인 → 무 병 갑
  [0, 1], //       묘 → 갑 을
  [1, 9, 4], //    진 → 을 계 무
  [4, 6, 2], //    사 → 무 경 병
  [2, 5, 3], //    오 → 병 기 정
  [3, 1, 5], //    미 → 정 을 기
  [4, 8, 6], //    신 → 무 임 경
  [6, 7], //       유 → 경 신
  [7, 3, 4], //    술 → 신 정 무
  [4, 0, 8], //    해 → 무 갑 임
];

/** 지지의 지장간 전체 (여기 → 중기 → 정기 순) */
export function jiJanggan(ji: number): readonly number[] {
  return JI_JANGGAN[ji]!;
}

/** 지지의 본기(정기) 천간 인덱스 — 지지의 십신을 말할 때의 기준이다. */
export function jiBongi(ji: number): number {
  const hidden = JI_JANGGAN[ji]!;
  return hidden[hidden.length - 1]!;
}

/**
 * 지지의 십신 — 본기 천간을 일간과 비교한다.
 *
 * **표시는 언제나 본기 기준이다.** 아래 `isRootedIn` 은 신강/신약 판정에만 쓴다.
 * 화면의 지지 십신까지 지장간 전체로 바꾸면 근거 표시가 흔들린다.
 */
export function jiSipsin(ilgan: number, ji: number): Sipsin {
  return sipsinOf(ilgan, jiBongi(ji));
}

/**
 * 통근(通根) — 일간이 그 지지에 뿌리를 두는가.
 *
 * 지장간 **전체**에 일간을 돕는 천간(비겁·인성)이 하나라도 들어 있으면 참이다.
 * 본기만 보면 지지 속에 숨은 뿌리를 놓친다 — 예로 미(未)의 본기는 기(己)라
 * 을(乙) 일간에게 편재로 보이지만, 중기가 을목이라 실제로는 뿌리가 서 있다.
 *
 * `isSupportingSipsin` 과 같은 기준(비겁·인성)을 쓰므로, **본기가 이미 돕는
 * 지지는 반드시 여기서도 참이다.** 판정이 약해지는 방향으로는 절대 움직이지 않는다.
 */
export function isRootedIn(ilgan: number, ji: number): boolean {
  return jiJanggan(ji).some((gan) => isSupportingSipsin(sipsinOf(ilgan, gan)));
}

// ── 계절과 왕상휴수사(旺相休囚死) ─────────────────────────────────────────
export type Season = "봄" | "여름" | "가을" | "겨울";

/** 월지로 계절을 정한다. 인묘진=봄, 사오미=여름, 신유술=가을, 해자축=겨울 */
export function seasonOf(monthJi: number): Season {
  if (monthJi >= 2 && monthJi <= 4) return "봄";
  if (monthJi >= 5 && monthJi <= 7) return "여름";
  if (monthJi >= 8 && monthJi <= 10) return "가을";
  return "겨울";
}

const SEASON_DOMINANT: Record<Season, Ohaeng> = {
  봄: "목",
  여름: "화",
  가을: "금",
  겨울: "수",
};

/** 왕상휴수사 — 계절이 각 오행에 주는 기세 */
export type SeasonalState = "왕" | "상" | "휴" | "수" | "사";

/**
 * 고전 규칙에서 그대로 유도된다.
 *   당령자 왕(旺) · 왕이 생하는 것 상(相) · 왕을 생하는 것 휴(休)
 *   왕을 극하는 것 수(囚) · 왕이 극하는 것 사(死)
 *
 * 상생 순환(목화토금수)에서 +1 = 생하는 것, +2 = 극하는 것이라는 성질을 이용한다.
 */
export function seasonalStates(monthJi: number): Record<Ohaeng, SeasonalState> {
  const dominant = ohaengIndex(SEASON_DOMINANT[seasonOf(monthJi)]);

  const byOffset: Record<number, SeasonalState> = {
    0: "왕",
    1: "상", // 왕이 생하는 것
    2: "사", // 왕이 극하는 것
    3: "수", // 왕을 극하는 것
    4: "휴", // 왕을 생하는 것
  };

  const result = {} as Record<Ohaeng, SeasonalState>;
  for (const element of OHAENG_ORDER) {
    const offset = (ohaengIndex(element) - dominant + 5) % 5;
    result[element] = byOffset[offset]!;
  }
  return result;
}

// ── 십신 분류 ─────────────────────────────────────────────────────────────
/** 일간을 돕는 십신(비겁·인성)인지 — 신강/신약 판정에 쓴다. */
export function isSupportingSipsin(sipsin: Sipsin): boolean {
  return sipsin === "비견" || sipsin === "겁재" || sipsin === "편인" || sipsin === "정인";
}

/**
 * 십신 10종을 묶는 고전 5분류. 음양 짝(편/정)을 하나로 본다.
 * 순서도 고전 순서(비겁→식상→재성→관성→인성)이며, 동점일 때의 우선순위로 쓴다.
 */
export const SIPSIN_GROUPS = ["비겁", "식상", "재성", "관성", "인성"] as const;
export type SipsinGroup = (typeof SIPSIN_GROUPS)[number];

const SIPSIN_GROUP_OF: Record<Sipsin, SipsinGroup> = {
  비견: "비겁",
  겁재: "비겁",
  식신: "식상",
  상관: "식상",
  편재: "재성",
  정재: "재성",
  편관: "관성",
  정관: "관성",
  편인: "인성",
  정인: "인성",
};

export function sipsinGroup(sipsin: Sipsin): SipsinGroup {
  return SIPSIN_GROUP_OF[sipsin];
}

// ── 60갑자 순행/역행 ──────────────────────────────────────────────────────
/** 60갑자 인덱스를 step 만큼 옮긴다 (음수면 역행). */
export function shiftSexagenary(index60: number, step: number): number {
  return (((index60 + step) % 60) + 60) % 60;
}

/** 60갑자 인덱스 → 간지 인덱스 쌍 */
export function fromSexagenary(index60: number): GanjiIndex {
  return { gan: index60 % 10, ji: index60 % 12 };
}

/** 60갑자 인덱스 (0=갑자 … 59=계해). 검증용. */
export function sexagenaryIndex({ gan, ji }: GanjiIndex): number {
  // 천간 주기 10, 지지 주기 12 → 해는 60 주기에서 유일
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === gan && i % 12 === ji) return i;
  }
  throw new Error(`불가능한 간지 조합: gan=${gan}, ji=${ji}`);
}
