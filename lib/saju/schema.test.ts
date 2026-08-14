import { describe, expect, it } from "vitest";
import { EMPTY_BIRTH_INPUT } from "../form/birth-input";
import {
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  sajuInputSchema,
} from "./schema";

/**
 * 유형 선택 카드의 문구를 검증한다 (TASK-30).
 *
 * 카드 설명은 **사용자에게 그대로 보이는 문구**이고, 각 유형의 표현 규칙이 그대로 적용된다.
 * `constitution.test.ts`·`yearly.test.ts` 의 금지 어휘를 여기서도 쓴다 — 판정 문구만
 * 막고 카드 문구를 놓치면 같은 약속이 화면 첫 장에서 깨진다.
 */

describe("유형 라벨과 설명", () => {
  it("세 유형 모두 라벨과 설명이 있다", () => {
    for (const type of READING_TYPES) {
      expect(READING_TYPE_LABEL[type]).toBeTruthy();
      expect(READING_TYPE_DESCRIPTION[type].length).toBeGreaterThan(10);
    }
  });

  it("설명이 서로 다르다", () => {
    // 복사해 붙이고 고치지 않으면 카드 셋이 같은 말을 한다.
    const seen = new Set(READING_TYPES.map((type) => READING_TYPE_DESCRIPTION[type]));
    expect(seen.size).toBe(READING_TYPES.length);
  });

  it("라벨도 서로 다르다", () => {
    const seen = new Set(READING_TYPES.map((type) => READING_TYPE_LABEL[type]));
    expect(seen.size).toBe(READING_TYPES.length);
  });

  it("설명에 키가 그대로 새어 나오지 않는다", () => {
    // Record 를 인덱스 시그니처로 바꾸면 undefined 가 문자열로 찍힐 수 있다.
    for (const type of READING_TYPES) {
      expect(READING_TYPE_DESCRIPTION[type]).not.toContain("undefined");
    }
  });
});

describe("카드 설명 — 표현 규칙", () => {
  /** `constitution.test.ts` 의 목록. 의학적 주장으로 읽히면 면책 고지가 깨진다. */
  const BANNED_MEDICAL = [
    "치료", "완치", "처방", "진단", "질병", "질환", "증상", "효능", "효과",
    "약효", "해독", "독소", "면역", "보장", "빠집니다", "빠진다", "낫는다",
  ];

  /** `constitution.test.ts` 의 처방 목록. diet 카드가 감량 방법을 약속하면 안 된다. */
  const BANNED_PRESCRIPTION = [
    "단식", "칼로리", "kcal", "kg", "그램", "저탄", "고지", "키토", "원푸드",
    "목표 체중", "일주일에", "보조제", "영양제",
  ];

  /** `yearly.test.ts` 의 목록. 올해 운세 카드가 사건을 예고하면 안 된다. */
  const BANNED_PROPHECY = [
    "반드시", "틀림없이", "확실히", "분명히", "대박", "횡재", "사고",
    "합격", "당첨", "투자", "돈이 들어온다",
  ];

  const all = READING_TYPES.map((type) => READING_TYPE_DESCRIPTION[type]);

  it.each([...BANNED_MEDICAL, ...BANNED_PRESCRIPTION, ...BANNED_PROPHECY])(
    "어느 설명에도 %s 가 없다",
    (word) => {
      expect(all.filter((text) => text.includes(word))).toEqual([]);
    },
  );

  it("diet 설명에 숫자가 없다", () => {
    // "3주에 5kg" 같은 수치가 섞이면 처방으로 읽힌다.
    expect(READING_TYPE_DESCRIPTION.diet).not.toMatch(/\d/);
  });

  it("어느 설명도 단정형으로 끝나지 않는다", () => {
    // "~합니다" 로 서술하는 화법을 지킨다. "~됩니다"·"~드립니다" 도 같은 결이다.
    for (const text of all) {
      expect(text.endsWith("다.")).toBe(true);
    }
  });
});

describe("폼 기본값이 서버 스키마 기본값과 같다", () => {
  it("빈 입력값의 기본 선택이 스키마 기본값과 일치한다", () => {
    // 어긋나면 화면에 보이는 선택과 서버가 쓰는 값이 달라진다.
    const parsed = sajuInputSchema.parse({ birthDate: "1990-05-17" });
    expect(parsed.calendar).toBe(EMPTY_BIRTH_INPUT.calendar);
    expect(parsed.isLeapMonth).toBe(EMPTY_BIRTH_INPUT.isLeapMonth);
    expect(parsed.gender).toBe(EMPTY_BIRTH_INPUT.gender);
    expect(parsed.solarTimeMode).toBe(EMPTY_BIRTH_INPUT.solarTimeMode);
    expect(parsed.dayBoundary).toBe(EMPTY_BIRTH_INPUT.dayBoundary);
  });

  it("스키마 기본 유형은 첫 유형이다", () => {
    const parsed = sajuInputSchema.parse({ birthDate: "1990-05-17" });
    expect(parsed.readingType).toBe(READING_TYPES[0]);
  });
});
