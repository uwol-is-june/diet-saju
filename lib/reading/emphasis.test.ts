import { describe, expect, it } from "vitest";
import { dropUnclosedEmphasis, emphasizeVerdictLabels } from "./emphasis";

/**
 * 본문 강조 (TASK-65).
 *
 * 강조는 두 곳에서 온다 — 프롬프트(본류)와 이 코드(판정 라벨). 여기서는 코드 쪽만 본다.
 * **스트리밍이 이 파일의 진짜 시험대다**: 글자가 한 조각씩 늘어나는 동안 별표가 글자로
 * 새거나 강조가 깨지면 안 된다.
 */
describe("닫히지 않은 강조 표시를 지운다", () => {
  it("짝이 맞으면 그대로 둔다", () => {
    expect(dropUnclosedEmphasis("이것은 **식욕형** 입니다")).toBe("이것은 **식욕형** 입니다");
  });

  it("열린 채로 끝나면 그 표시를 지운다", () => {
    // `react-markdown` 은 닫히지 않은 `**` 를 글자 그대로 그린다.
    expect(dropUnclosedEmphasis("이것은 **식욕")).toBe("이것은 식욕");
  });

  it("뒤 내용을 감추지 않는다", () => {
    // 감추면 쓰이고 있는 글이 사라졌다 나타난다.
    expect(dropUnclosedEmphasis("**쓰는 중")).toContain("쓰는 중");
  });

  it("여러 짝 뒤에 열린 것이 있으면 마지막 것만 지운다", () => {
    expect(dropUnclosedEmphasis("**가** 나 **다")).toBe("**가** 나 다");
  });

  it("한 글자씩 늘어나는 동안 별표가 글자로 새지 않는다", () => {
    const full = "판정은 **식욕형**입니다. 그리고 **축적형**이기도 합니다.";
    for (let i = 1; i <= full.length; i += 1) {
      const held = dropUnclosedEmphasis(full.slice(0, i));
      const marks = held.match(/\*\*/g)?.length ?? 0;
      expect(marks % 2, `${i}자에서 짝이 안 맞음`).toBe(0);
    }
  });
});

describe("판정 라벨의 첫 등장만 굵게 만든다", () => {
  const labels = ["식욕형", "약간 서늘"];

  it("첫 등장만 감싼다", () => {
    const text = "식욕형입니다. 식욕형은 이렇습니다.";
    expect(emphasizeVerdictLabels(text, labels)).toBe("**식욕형**입니다. 식욕형은 이렇습니다.");
  });

  it("이미 굵은 라벨을 두 번 감싸지 않는다", () => {
    // `****` 가 되면 강조가 깨진다. 모델이 스스로 감싼 경우가 이 경로다.
    const text = "판정은 **식욕형**입니다.";
    expect(emphasizeVerdictLabels(text, labels)).toBe(text);
  });

  it("강조 안쪽에 있는 다른 라벨도 건드리지 않는다", () => {
    const text = "**식욕형과 약간 서늘** 이 함께 나옵니다.";
    expect(emphasizeVerdictLabels(text, labels)).toBe(text);
  });

  it("제목 줄에는 붙이지 않는다", () => {
    const text = "### 식욕형\n식욕형입니다.";
    expect(emphasizeVerdictLabels(text, labels)).toBe("### 식욕형\n**식욕형**입니다.");
  });

  it("라벨이 없으면 원문 그대로다", () => {
    expect(emphasizeVerdictLabels("아무 라벨도 없습니다.", labels)).toBe(
      "아무 라벨도 없습니다.",
    );
    expect(emphasizeVerdictLabels("식욕형입니다.", [])).toBe("식욕형입니다.");
  });

  it("한 줄에 라벨 하나까지만 감싼다", () => {
    // 한 줄을 굵은 글자로 뒤덮지 않기 위한 상한이다. 나머지는 다음 줄에서 잡힌다.
    const text = "식욕형이고 약간 서늘합니다.\n약간 서늘한 쪽입니다.";
    expect(emphasizeVerdictLabels(text, labels)).toBe(
      "**식욕형**이고 약간 서늘합니다.\n**약간 서늘**한 쪽입니다.",
    );
  });

  it("스트리밍 중에도 표시 짝이 깨지지 않는다", () => {
    const full = "이 사주는 식욕형이고 약간 서늘한 쪽입니다.";
    for (let i = 1; i <= full.length; i += 1) {
      const rendered = emphasizeVerdictLabels(dropUnclosedEmphasis(full.slice(0, i)), labels);
      const marks = rendered.match(/\*\*/g)?.length ?? 0;
      expect(marks % 2, `${i}자에서 짝이 안 맞음`).toBe(0);
    }
  });
});
