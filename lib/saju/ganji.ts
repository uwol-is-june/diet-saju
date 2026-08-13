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
 * 지지가 품은 천간 중 **본기(정기)**. 지지의 십신을 말할 때의 기준이다.
 *
 * 자→계, 축→기, 인→갑, 묘→을, 진→무, 사→병,
 * 오→정, 미→기, 신→경, 유→신, 술→무, 해→임
 */
const JI_BONGI: readonly number[] = [
  9, // 자 → 계
  5, // 축 → 기
  0, // 인 → 갑
  1, // 묘 → 을
  4, // 진 → 무
  2, // 사 → 병
  3, // 오 → 정
  5, // 미 → 기
  6, // 신 → 경
  7, // 유 → 신
  4, // 술 → 무
  8, // 해 → 임
];

/** 지지의 본기 천간 인덱스 */
export function jiBongi(ji: number): number {
  return JI_BONGI[ji]!;
}

/** 지지의 십신 — 본기 천간을 일간과 비교한다. */
export function jiSipsin(ilgan: number, ji: number): Sipsin {
  return sipsinOf(ilgan, jiBongi(ji));
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
