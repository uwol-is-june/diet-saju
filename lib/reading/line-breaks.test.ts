import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { breakSentences } from "./line-breaks";

/**
 * 문장 묶음 단위 줄바꿈 (TASK-28 → TASK-80).
 *
 * 완료 기준 네 가지를 본다
 *  1. 긴 문단이 갈린다 — 문단으로(`<br>` 은 모바일에서 경계가 안 보인다)
 *  2. **짧은 문단은 갈리지 않는다** — 한 문장짜리 문단의 나열이 되면 목록처럼 읽힌다
 *  3. 소수점·순서 목록·영문 약어가 깨지지 않는다
 *  4. 스트리밍 중 줄이 튀지 않는다 (누적 문자열을 한 글자씩 늘려도 단조롭게 는다)
 *
 * 길이가 판정 기준이라 **길이를 정확히 아는 문장**을 만들어 쓴다. 실제 풀이 문장을
 * 베껴 오면 문장 하나를 고칠 때마다 판정이 바뀌어 무엇을 재는 시험인지 흐려진다.
 */

/** `length` 자짜리 문장 하나 (종결 부호 포함). 문턱은 80자다. */
function sentence(length: number, end = "."): string {
  return "가".repeat(length - end.length) + end;
}

describe("문장 묶기", () => {
  it("문턱을 넘긴 뒤 처음 만나는 문장 끝에서 가른다", () => {
    // 50 + 50 = 101자에서 처음으로 80자를 넘는다 → 두 문장이 한 덩어리.
    const text = `${sentence(50)} ${sentence(50)} ${sentence(50)}`;
    expect(breakSentences(text)).toBe(
      `${sentence(50)} ${sentence(50)}\n\n${sentence(50)}`,
    );
  });

  it("문턱보다 짧으면 여러 문장이어도 가르지 않는다", () => {
    // 여기서 갈랐다면 한 문장짜리 문단이 다시 생긴다 — TASK-80 이 없애려던 모양이다.
    const text = `${sentence(30)} ${sentence(30)}`;
    expect(breakSentences(text)).toBe(text);
  });

  it("짧은 문장은 서너 개가 한 덩어리로 묶인다", () => {
    // 20자씩 넷이면 83자라 거기서 갈리고, 남은 하나가 다음 문단이 된다.
    const short = sentence(20);
    const text = [short, short, short, short, short].join(" ");
    expect(breakSentences(text)).toBe(
      `${[short, short, short, short].join(" ")}\n\n${short}`,
    );
  });

  it("문턱보다 긴 문장은 혼자 문단이 된다 — 문장을 쪼개지 않는다", () => {
    const text = `${sentence(120)} ${sentence(50)}`;
    expect(breakSentences(text)).toBe(`${sentence(120)}\n\n${sentence(50)}`);
  });

  it("물음표·느낌표에서도 가른다", () => {
    const text = `${sentence(90, "?")} ${sentence(50)}`;
    expect(breakSentences(text)).toBe(`${sentence(90, "?")}\n\n${sentence(50)}`);
  });

  it("겹쳐 쓴 종결 부호를 하나로 본다", () => {
    const text = `${sentence(90, "?!")} ${sentence(50)}`;
    expect(breakSentences(text)).toBe(`${sentence(90, "?!")}\n\n${sentence(50)}`);
  });

  it("닫는 괄호·따옴표 뒤에서도 가른다", () => {
    const text = `${sentence(88)}(요약). ${sentence(50)}`;
    expect(breakSentences(text)).toBe(`${sentence(88)}(요약).\n\n${sentence(50)}`);
  });

  it("모델이 이미 나눈 문단 경계를 그대로 살린다", () => {
    // 변환이 줄 단위라 빈 줄을 넘지 않는다 — 짧은 문단 둘이 하나로 합쳐지지 않는다.
    const text = `${sentence(50)}\n\n${sentence(50)}`;
    expect(breakSentences(text)).toBe(text);
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
    // 문턱을 이미 넘긴 자리에 두어, 규칙이 느슨해지면 여기서 갈리도록 해 둔다.
    const text = `${"가".repeat(90)}는 3.5 배쯤 됩니다.`;
    expect(breakSentences(text)).toBe(text);
  });

  it("영문 약어를 가르지 않는다", () => {
    const text = `${"가".repeat(90)}, 예를 들어 e.g. 이런 것입니다.`;
    expect(breakSentences(text)).toBe(text);
  });

  it("순서 목록 줄을 건드리지 않는다", () => {
    const list = `1. ${sentence(90)} ${sentence(50)}\n2. ${sentence(90)}`;
    expect(breakSentences(list)).toBe(list);
  });

  it("글머리 목록 줄을 건드리지 않는다", () => {
    const list = `- ${sentence(90)} ${sentence(50)}\n- ${sentence(50)}`;
    expect(breakSentences(list)).toBe(list);
  });

  it("제목 줄을 건드리지 않는다", () => {
    const heading = `### ${sentence(90)} ${sentence(50)}`;
    expect(breakSentences(heading)).toBe(heading);
  });

  it("코드 울타리 안을 건드리지 않는다", () => {
    const fenced = `\`\`\`\n${sentence(90)} ${sentence(50)}\n\`\`\``;
    expect(breakSentences(fenced)).toBe(fenced);
  });

  it("빈 문자열을 그대로 돌려준다", () => {
    expect(breakSentences("")).toBe("");
  });
});

describe("스트리밍 중 줄이 튀지 않는다", () => {
  /** 50자 문장 넷 — 두 문장씩 두 문단이 된다. 셋째 문장에 소수점을 섞어 둔다. */
  const FULL = [
    sentence(50),
    sentence(50),
    `${"가".repeat(40)}는 3.5 배입니다.`,
    sentence(50),
  ].join(" ");

  it("종결 부호만 도착한 순간에는 아직 가르지 않는다", () => {
    // 공백과 다음 글자가 모두 와야 가른다. 안 그러면 커서 앞에서 줄이 접혔다 펴진다.
    const two = `${sentence(50)} ${sentence(50)}`;
    expect(breakSentences(two)).toBe(two);
    expect(breakSentences(`${two} `)).toBe(`${two} `);
    expect(breakSentences(`${two} 가`)).toBe(`${sentence(50)} ${sentence(50)}\n\n가`);
  });

  it("한 글자씩 늘려도 문단 수가 줄지 않는다", () => {
    // 줄어드는 순간이 있으면 화면에서 줄이 튄다.
    let previous = 0;
    for (let length = 1; length <= FULL.length; length += 1) {
      const count = breakSentences(FULL.slice(0, length)).split("\n\n").length;
      expect(count, `${length}자에서 줄었다`).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
    // 문장 넷이 두 문단으로 묶인다 (3.5 는 갈리지 않는다).
    expect(previous).toBe(2);
  });

  it("한 번 갈린 앞부분은 이후에도 그대로다", () => {
    // 앞 문단이 다시 합쳐지거나 경계가 움직이면 이미 읽던 위치가 흔들린다.
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
