/**
 * lunar-javascript 는 중국어(간체) 문자열을 반환한다.
 * 서비스 노출 문자열은 전부 한글이어야 하므로 여기서 한 번에 변환한다.
 * 순수 함수 모듈 — 클라이언트에서도 안전하게 import 가능하다.
 */

/** 천간 10 */
export const CHEONGAN: Record<string, string> = {
  甲: "갑",
  乙: "을",
  丙: "병",
  丁: "정",
  戊: "무",
  己: "기",
  庚: "경",
  辛: "신",
  壬: "임",
  癸: "계",
};

/** 지지 12 */
export const JIJI: Record<string, string> = {
  子: "자",
  丑: "축",
  寅: "인",
  卯: "묘",
  辰: "진",
  巳: "사",
  午: "오",
  未: "미",
  申: "신",
  酉: "유",
  戌: "술",
  亥: "해",
};

/** 오행 5 */
export const OHAENG: Record<string, string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

/** 십신 10 (간체/정체 표기 모두 수용) */
export const SIPSIN: Record<string, string> = {
  比肩: "비견",
  劫財: "겁재",
  劫财: "겁재",
  食神: "식신",
  傷官: "상관",
  伤官: "상관",
  偏財: "편재",
  偏财: "편재",
  正財: "정재",
  正财: "정재",
  偏官: "편관",
  七殺: "편관",
  七杀: "편관",
  正官: "정관",
  偏印: "편인",
  正印: "정인",
};

/** 십이지 동물 */
export const SAENGCHO: Record<string, string> = {
  鼠: "쥐",
  牛: "소",
  虎: "호랑이",
  兔: "토끼",
  龍: "용",
  龙: "용",
  蛇: "뱀",
  馬: "말",
  马: "말",
  羊: "양",
  猴: "원숭이",
  雞: "닭",
  鸡: "닭",
  狗: "개",
  豬: "돼지",
  猪: "돼지",
};

/** 간지 2글자(예: "庚午")를 한글로 (예: "경오"). 매핑 실패 시 원문 유지. */
export function ganjiToKorean(ganji: string): string {
  return [...ganji]
    .map((ch) => CHEONGAN[ch] ?? JIJI[ch] ?? ch)
    .join("");
}

/** 오행 문자열(예: "金火")을 한글로 (예: "금화"). */
export function ohaengToKorean(wuxing: string): string {
  return [...wuxing].map((ch) => OHAENG[ch] ?? ch).join("");
}

/** 십신 변환. 매핑 실패 시 원문 유지. */
export function sipsinToKorean(sipsin: string): string {
  return SIPSIN[sipsin] ?? sipsin;
}

/** 생초(띠) 변환. */
export function saenchoToKorean(shengXiao: string): string {
  return SAENGCHO[shengXiao] ?? shengXiao;
}

/** 천간 1글자의 오행 */
export const GAN_TO_OHAENG: Record<string, string> = {
  甲: "목",
  乙: "목",
  丙: "화",
  丁: "화",
  戊: "토",
  己: "토",
  庚: "금",
  辛: "금",
  壬: "수",
  癸: "수",
};

/** 지지 1글자의 오행 */
export const JI_TO_OHAENG: Record<string, string> = {
  子: "수",
  丑: "토",
  寅: "목",
  卯: "목",
  辰: "토",
  巳: "화",
  午: "화",
  未: "토",
  申: "금",
  酉: "금",
  戌: "토",
  亥: "수",
};
