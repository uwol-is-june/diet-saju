import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { breakSentences } from "./line-breaks";

/**
 * 문장 단위 줄바꿈 (TASK-28).
 *
 * 완료 기준 세 가지를 본다
 *  1. 문장이 실제로 갈린다 (문단으로 — `<br>` 은 모바일에서 경계가 안 보인다)
 *  2. 소수점·순서 목록·영문 약어가 깨지지 않는다
 *  3. 스트리밍 중 줄이 튀지 않는다 (누적 문자열을 한 글자씩 늘려도 단조롭게 는다)
 */

describe("문장 가르기", () => {
  it("마침표 뒤에서 문단을 나눈다", () => {
    expect(breakSentences("첫 문장입니다. 둘째 문장입니다.")).toBe(
      "첫 문장입니다.\n\n둘째 문장입니다.",
    );
  });

  it("물음표·느낌표에서도 나눈다", () => {
    expect(breakSentences("그럴까요? 아마 그럴 겁니다!")).toBe("그럴까요?\n\n아마 그럴 겁니다!");
  });

  it("겹쳐 쓴 종결 부호를 하나로 본다", () => {
    expect(breakSentences("정말요?! 네 그렇습니다.")).toBe("정말요?!\n\n네 그렇습니다.");
  });

  it("닫는 괄호·따옴표 뒤에서도 나눈다", () => {
    expect(breakSentences("결론입니다(요약). 다음 이야기입니다.")).toBe(
      "결론입니다(요약).\n\n다음 이야기입니다.",
    );
  });

  it("이미 문단이 나뉘어 있으면 그대로 둔다", () => {
    expect(breakSentences("첫 문단입니다.\n\n둘째 문단입니다.")).toBe(
      "첫 문단입니다.\n\n둘째 문단입니다.",
    );
  });

  it("빈 줄이 셋 이상 겹치지 않는다", () => {
    expect(breakSentences("가나다입니다.\n\n\n\n라마바입니다.")).toBe(
      "가나다입니다.\n\n라마바입니다.",
    );
  });
});

describe("마침표가 문장 끝이 아닌 경우", () => {
  it("소수점을 가르지 않는다", () => {
    // 종결 부호 앞 글자를 한글·닫는 괄호로 한정했기 때문에 애초에 걸리지 않는다.
    expect(breakSentences("체중이 3.5 정도 늘었습니다.")).toBe("체중이 3.5 정도 늘었습니다.");
    expect(breakSentences("1.5배 늘어납니다. 그다음입니다.")).toBe(
      "1.5배 늘어납니다.\n\n그다음입니다.",
    );
  });

  it("순서 목록 줄을 건드리지 않는다", () => {
    const list = "1. 첫째 항목입니다. 이어지는 설명입니다.\n2. 둘째 항목입니다.";
    expect(breakSentences(list)).toBe(list);
  });

  it("글머리 목록 줄을 건드리지 않는다", () => {
    const list = "- 첫째입니다. 이어집니다.\n- 둘째입니다.";
    expect(breakSentences(list)).toBe(list);
  });

  it("제목 줄을 건드리지 않는다", () => {
    const heading = "### 소제목입니다. 이어짐";
    expect(breakSentences(heading)).toBe(heading);
  });

  it("영문 약어를 가르지 않는다", () => {
    expect(breakSentences("예를 들어 e.g. 이런 것입니다.")).toBe(
      "예를 들어 e.g. 이런 것입니다.",
    );
  });

  it("코드 울타리 안을 건드리지 않는다", () => {
    const fenced = "```\n가나다입니다. 라마바입니다.\n```";
    expect(breakSentences(fenced)).toBe(fenced);
  });

  it("빈 문자열을 그대로 돌려준다", () => {
    expect(breakSentences("")).toBe("");
  });
});

describe("스트리밍 중 줄이 튀지 않는다", () => {
  const FULL =
    "고객님은 여름에 태어난 사주입니다. 화 기운이 넉넉한 편이고요. 그래서 3.5배쯤 됩니다. 마지막 문장입니다.";

  it("종결 부호만 도착한 순간에는 아직 가르지 않는다", () => {
    // 공백과 다음 글자가 모두 와야 가른다. 안 그러면 커서 앞에서 줄이 접혔다 펴진다.
    expect(breakSentences("첫 문장입니다.")).toBe("첫 문장입니다.");
    expect(breakSentences("첫 문장입니다. ")).toBe("첫 문장입니다. ");
    expect(breakSentences("첫 문장입니다. 둘")).toBe("첫 문장입니다.\n\n둘");
  });

  it("한 글자씩 늘려도 문단 수가 줄지 않는다", () => {
    // 줄어드는 순간이 있으면 화면에서 줄이 튄다.
    let previous = 0;
    for (let length = 1; length <= FULL.length; length += 1) {
      const count = breakSentences(FULL.slice(0, length)).split("\n\n").length;
      expect(count, `${length}자에서 줄었다`).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
    // 3.5 는 갈리지 않으므로 문장 4개 = 문단 4개
    expect(previous).toBe(4);
  });

  it("한 번 갈린 앞부분은 이후에도 그대로다", () => {
    // 앞 문단이 다시 합쳐지면 이미 읽던 위치가 움직인다.
    let previousPrefix = "";
    for (let length = 1; length <= FULL.length; length += 1) {
      const paragraphs = breakSentences(FULL.slice(0, length)).split("\n\n");
      const settled = paragraphs.slice(0, -1).join("\n\n"); // 마지막(생성 중)을 뺀 부분
      if (previousPrefix) expect(settled.startsWith(previousPrefix)).toBe(true);
      previousPrefix = settled;
    }
  });
});

describe("모든 렌더 경로가 같은 변환을 거친다", () => {
  /**
   * 호출부가 여럿이라(섹션 본문 · 프리앰블 · **계약을 어겼을 때의 폴백**) 한 곳만 빠뜨리면
   * 경로에 따라 화면이 달라진다. 특히 폴백은 평소에 안 보여서 눈으로는 못 잡는다.
   */
  const SOURCE = readFileSync(
    new URL("../../components/ReadingSections.tsx", import.meta.url),
    "utf8",
  );

  it("`<Markdown>` 을 직접 쓰는 곳은 Prose 하나뿐이다", () => {
    expect([...SOURCE.matchAll(/<Markdown>/g)]).toHaveLength(1);
    expect(SOURCE).toMatch(/function Prose\b[\s\S]*?<Markdown>\{breakSentences\(/);
  });

  it("본문·프리앰블·폴백이 모두 Prose 를 거친다", () => {
    expect([...SOURCE.matchAll(/<Prose>/g)].length).toBeGreaterThanOrEqual(3);
  });
});
