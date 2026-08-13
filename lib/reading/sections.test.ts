import { describe, expect, it } from "vitest";
import { READING_TYPES } from "../saju/schema";
import { READING_SECTION_IDS, SECTION_SPECS, parseReadingSections } from "./sections";

/**
 * 섹션 계약과 파서 검증 (TASK-06).
 *
 * 파서는 스트림 중간 상태를 계속 받는다. 그래서 "완성된 입력" 만 보는 테스트로는 부족하고,
 * **한 글자씩 늘려 가며** 어느 지점에서도 깨지지 않는지를 봐야 한다.
 *
 * 또 하나 지키는 것: 모델 출력을 잃는 경로가 없어야 한다. 계약을 어긴 제목도, 제목 앞에
 * 온 내용도 버리지 않는다.
 */

const DIET_FULL = `## 한눈에 보기
요약 문장입니다.

## 오행으로 본 체질
체질 설명입니다.

### 소제목은 섹션 경계가 아니다
이어지는 내용.

## 살이 붙는 패턴
패턴 설명입니다.

## 잘 맞는 다이어트 방법
접근 순서 설명입니다.

## 잘 맞는 식습관
- 항목 하나
- 항목 둘

## 잘 맞는 움직임
움직임 설명입니다.

## 올해의 몸 흐름
흐름 설명입니다.

## 이번 달 실천 3가지
실천 설명입니다.`;

describe("섹션 계약", () => {
  it("모든 유형의 섹션 id 가 선언 목록 안에 있다", () => {
    for (const type of READING_TYPES) {
      for (const spec of SECTION_SPECS[type]) {
        expect(READING_SECTION_IDS).toContain(spec.id);
      }
    }
  });

  it("한 유형 안에서 제목이 중복되지 않는다", () => {
    // 파서가 제목으로 id 를 찾으므로 중복되면 뒤쪽 섹션을 영원히 못 잡는다.
    for (const type of READING_TYPES) {
      const titles = SECTION_SPECS[type].map((spec) => spec.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it("모든 유형이 요약 섹션으로 시작한다", () => {
    for (const type of READING_TYPES) {
      const first = SECTION_SPECS[type][0]!;
      expect(first.id).toBe("summary");
      expect(first.emphasis).toBe("summary");
    }
  });

  it("강조는 유형마다 하나뿐이다", () => {
    for (const type of READING_TYPES) {
      const emphasized = SECTION_SPECS[type].filter((spec) => spec.emphasis);
      expect(emphasized.length).toBe(1);
    }
  });
});

describe("완성된 풀이 파싱", () => {
  const parsed = parseReadingSections(DIET_FULL, "diet", false);

  it("계약된 섹션을 순서대로 전부 잡는다", () => {
    expect(parsed.sections.map((s) => s.id)).toEqual(
      SECTION_SPECS.diet.map((spec) => spec.id),
    );
    expect(parsed.recognized).toBe(true);
  });

  it("생성이 끝났으면 모든 섹션이 complete 다", () => {
    expect(parsed.sections.every((s) => s.complete)).toBe(true);
  });

  it("### 소제목은 섹션을 가르지 않는다", () => {
    const body = parsed.sections.find((s) => s.id === "constitution")!.body;
    expect(body).toContain("### 소제목은 섹션 경계가 아니다");
    expect(body).toContain("이어지는 내용.");
  });

  it("본문 앞뒤 공백을 정리한다", () => {
    for (const section of parsed.sections) {
      expect(section.body).toBe(section.body.trim());
      expect(section.body.length).toBeGreaterThan(0);
    }
  });

  it("요약만 강조된다", () => {
    expect(parsed.sections.filter((s) => s.emphasis === "summary").map((s) => s.id)).toEqual([
      "summary",
    ]);
  });
});

describe("스트리밍 도중 파싱", () => {
  it("한 글자씩 늘려도 어느 지점에서도 예외가 없고 섹션이 줄지 않는다", () => {
    let previousCount = 0;
    for (let length = 1; length <= DIET_FULL.length; length += 1) {
      const parsed = parseReadingSections(DIET_FULL.slice(0, length), "diet", true);
      // 섹션 수는 단조 증가한다. 줄어들면 화면에서 카드가 사라진다.
      expect(parsed.sections.length).toBeGreaterThanOrEqual(previousCount);
      previousCount = parsed.sections.length;
    }
    expect(previousCount).toBe(SECTION_SPECS.diet.length);
  });

  it("마지막 섹션만 미완이고 나머지는 완결이다", () => {
    const partial = DIET_FULL.slice(0, DIET_FULL.indexOf("## 잘 맞는 움직임") + 30);
    const parsed = parseReadingSections(partial, "diet", true);
    const last = parsed.sections[parsed.sections.length - 1]!;
    expect(last.complete).toBe(false);
    expect(parsed.sections.slice(0, -1).every((s) => s.complete)).toBe(true);
  });

  it("잘린 제목도 계약과 맞춰 잡는다 (카드 깜빡임 방지)", () => {
    // "## 한눈에" 까지만 도착한 순간
    const parsed = parseReadingSections("## 한눈에", "diet", true);
    expect(parsed.sections[0]!.id).toBe("summary");
    expect(parsed.sections[0]!.title).toBe("한눈에 보기");
  });

  it("제목이 도착하는 모든 중간 지점에서 id 가 잡힌다", () => {
    const heading = "## 이번 달 실천 3가지";
    for (let length = 4; length <= heading.length; length += 1) {
      const parsed = parseReadingSections(heading.slice(0, length), "diet", true);
      expect(parsed.sections[0]!.id, `"${heading.slice(0, length)}" 에서 실패`).toBe(
        "monthly-actions",
      );
    }
  });

  it("해시만 도착한 줄은 섹션을 열지 않는다", () => {
    // `### 소제목` 이 오는 중이면 `##` 까지는 섹션 제목과 구별할 수 없다.
    // 이걸 막지 않으면 빈 카드가 생겼다 사라진다.
    for (const hashes of ["#", "##", "###", "## ", "### "]) {
      const parsed = parseReadingSections(`## 한눈에 보기\n요약.\n\n${hashes}`, "diet", true);
      expect(parsed.sections.length, `"${hashes}" 에서 실패`).toBe(1);
      expect(parsed.sections[0]!.body).toBe("요약.");
    }
  });

  it("제목 글자가 오는 순간 단계가 확정된다", () => {
    const sub = parseReadingSections("## 한눈에 보기\n요약.\n\n### 소제목", "diet", true);
    expect(sub.sections.length).toBe(1);
    expect(sub.sections[0]!.body).toContain("### 소제목");

    const next = parseReadingSections("## 한눈에 보기\n요약.\n\n## 오", "diet", true);
    expect(next.sections.length).toBe(2);
    expect(next.sections[1]!.id).toBe("constitution");
  });

  it("제목만 있고 본문이 아직 없으면 빈 본문이다", () => {
    const parsed = parseReadingSections("## 한눈에 보기\n", "diet", true);
    expect(parsed.sections[0]!.body).toBe("");
    expect(parsed.sections[0]!.complete).toBe(false);
  });
});

describe("모델이 계약을 어겼을 때 — 출력을 잃지 않는다", () => {
  it("계약에 없는 제목은 id 없이 그대로 담는다", () => {
    const parsed = parseReadingSections(
      "## 한눈에 보기\n요약.\n\n## 내가 만든 제목\n버리면 안 되는 내용.",
      "diet",
      false,
    );
    expect(parsed.sections.map((s) => s.id)).toEqual(["summary", null]);
    expect(parsed.sections[1]!.title).toBe("내가 만든 제목");
    expect(parsed.sections[1]!.body).toBe("버리면 안 되는 내용.");
    expect(parsed.recognized).toBe(true);
  });

  it("제목이 하나도 없으면 recognized=false 로 원문 폴백을 알린다", () => {
    const parsed = parseReadingSections("제목 없이 그냥 쓴 풀이입니다.", "diet", false);
    expect(parsed.recognized).toBe(false);
    expect(parsed.sections).toEqual([]);
    expect(parsed.preamble).toBe("제목 없이 그냥 쓴 풀이입니다.");
  });

  it("계약에 없는 제목만 있으면 recognized=false 다", () => {
    const parsed = parseReadingSections("## 엉뚱한 제목\n내용.", "diet", false);
    expect(parsed.recognized).toBe(false);
    expect(parsed.sections[0]!.body).toBe("내용.");
  });

  it("첫 제목 앞에 온 내용도 버리지 않는다", () => {
    const parsed = parseReadingSections("서론입니다.\n\n## 한눈에 보기\n요약.", "diet", false);
    expect(parsed.preamble).toBe("서론입니다.");
    expect(parsed.sections[0]!.id).toBe("summary");
  });

  it("유형이 다르면 같은 제목도 계약 밖이다", () => {
    // diet 제목을 general 로 파싱하면 잡히지 않아야 한다 (계약이 유형별로 분리됨)
    const parsed = parseReadingSections("## 살이 붙는 패턴\n내용.", "general", false);
    expect(parsed.sections[0]!.id).toBeNull();
    expect(parsed.recognized).toBe(false);
  });

  it("빈 문자열은 빈 결과다", () => {
    const parsed = parseReadingSections("", "diet", true);
    expect(parsed.sections).toEqual([]);
    expect(parsed.preamble).toBe("");
    expect(parsed.recognized).toBe(false);
  });
});
