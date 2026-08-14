import { describe, expect, it } from "vitest";
import { EMPTY_BIRTH_INPUT } from "../form/birth-input";
import {
  INTERNAL_READING_TYPES,
  PUBLIC_READING_TYPES,
  READING_TYPES,
  READING_TYPE_DESCRIPTION,
  READING_TYPE_LABEL,
  READING_TYPE_META,
  READING_TYPE_VISIBILITY,
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
  it("모든 유형에 라벨과 설명이 있다", () => {
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

  /** 카드 설명과 검색·공유 문구 전부 — 어느 쪽도 사용자에게 그대로 보인다. */
  const all = READING_TYPES.flatMap((type) => [
    READING_TYPE_DESCRIPTION[type],
    READING_TYPE_META[type].description,
  ]);

  it.each([...BANNED_MEDICAL, ...BANNED_PRESCRIPTION, ...BANNED_PROPHECY])(
    "어느 설명에도 %s 가 없다",
    (word) => {
      expect(all.filter((text) => text.includes(word))).toEqual([]);
    },
  );

  /**
   * **모든 유형에 적용한다** (TASK-44 에서 넓혔다). 예전에는 `diet` 만 봤는데, 유형이 늘 때
   * 목록에 이름을 더해야 하는 검사는 반드시 빠뜨린다 — 다이어트 계열이 셋이 된 지금
   * 그게 실제 위험이다.
   *
   * 넓혀도 되는 이유: 수치는 다이어트 계열에서 처방으로("3주에 5kg"), 나머지에서 예언으로
   * ("3년 안에") 읽힌다. **어느 유형에도 카드 한 줄에 숫자가 필요할 일이 없다.**
   */
  it.each(READING_TYPES)("%s 문구에 숫자가 없다", (type) => {
    expect(READING_TYPE_DESCRIPTION[type]).not.toMatch(/\d/);
    expect(READING_TYPE_META[type].description).not.toMatch(/\d/);
  });

  it("어느 설명도 단정형으로 끝나지 않는다", () => {
    // "~합니다" 로 서술하는 화법을 지킨다. "~됩니다"·"~드립니다" 도 같은 결이다.
    for (const text of all) {
      expect(text.endsWith("다.")).toBe(true);
    }
  });
});

describe("유형별 검색·공유 문구 (TASK-31)", () => {
  it("모든 유형에 title 과 description 이 있다", () => {
    for (const type of READING_TYPES) {
      expect(READING_TYPE_META[type].title).toBeTruthy();
      expect(READING_TYPE_META[type].description.length).toBeGreaterThan(30);
    }
  });

  it("title 이 서로 다르고 유형 라벨을 담는다", () => {
    const titles = READING_TYPES.map((type) => READING_TYPE_META[type].title);
    expect(new Set(titles).size).toBe(READING_TYPES.length);
    for (const type of READING_TYPES) {
      expect(READING_TYPE_META[type].title).toContain(READING_TYPE_LABEL[type]);
    }
  });

  it("description 이 서로 다르다", () => {
    const seen = new Set(READING_TYPES.map((type) => READING_TYPE_META[type].description));
    expect(seen.size).toBe(READING_TYPES.length);
  });

  it("카드 설명과 같은 문장을 쓰지 않는다", () => {
    // 링크만 보고 판단하는 사람이 읽는 글이라, 무엇을 넣어야 하는지까지 말해야 한다.
    for (const type of READING_TYPES) {
      expect(READING_TYPE_META[type].description).not.toBe(READING_TYPE_DESCRIPTION[type]);
      expect(READING_TYPE_META[type].description).toContain("생년월일시");
    }
  });

  it("title 이 검색 결과에서 잘리지 않을 길이다", () => {
    for (const type of READING_TYPES) {
      expect(READING_TYPE_META[type].title.length).toBeLessThanOrEqual(40);
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

  /**
   * 예전 계약은 "기본값 = 첫 유형" 이었는데, 노출 구분(TASK-41)이 생기면서 첫 유형이
   * 내부 유형이 될 수 있게 됐다. **기본값은 사용자가 실제로 요청할 수 있는 것**이어야
   * 한다 — 유형을 생략한 요청이 화면에서 고를 수 없는 유형으로 가면 안 된다.
   */
  it("스키마 기본 유형은 공개 유형이다", () => {
    const parsed = sajuInputSchema.parse({ birthDate: "1990-05-17" });
    expect(READING_TYPE_VISIBILITY[parsed.readingType]).toBe("public");
  });
});

describe("노출 구분 (TASK-41)", () => {
  it("모든 유형에 노출 구분이 있다", () => {
    for (const type of READING_TYPES) {
      expect(["public", "internal"]).toContain(READING_TYPE_VISIBILITY[type]);
    }
  });

  it("공개 유형이 최소 하나는 있다", () => {
    // 전부 internal 이 되면 메인 화면에 고를 것이 없다.
    expect(PUBLIC_READING_TYPES.length).toBeGreaterThan(0);
  });

  it("공개와 내부가 겹치지 않고 둘을 합치면 전체가 된다", () => {
    // 파생 목록이 손으로 유지되는 두 번째 목록이 되지 않게 막는다.
    expect([...PUBLIC_READING_TYPES, ...INTERNAL_READING_TYPES].sort()).toEqual(
      [...READING_TYPES].sort(),
    );
  });

  /** 내부 유형도 라벨·설명·메타 문구가 있어야 한다 — `/admin` 과 그 페이지가 쓴다. */
  it("내부 유형도 문구가 비어 있지 않다", () => {
    for (const type of INTERNAL_READING_TYPES) {
      expect(READING_TYPE_LABEL[type]).toBeTruthy();
      expect(READING_TYPE_DESCRIPTION[type].length).toBeGreaterThan(10);
      expect(READING_TYPE_META[type].description.length).toBeGreaterThan(10);
    }
  });
});
