import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "./prompt";
import { BODY_AXIS } from "./saju/constitution";
import { calculateSajuChart } from "./saju/pillars";
import { sajuInputSchema, type SajuInput } from "./saju/schema";

/**
 * 프롬프트 조립 검증.
 *
 * 여기서 보는 것은 문장의 품질이 아니라 **경계**다.
 *  - 코드가 정한 판정이 실제로 프롬프트에 실리는가 (실리지 않으면 LLM 이 즉흥으로 판정한다)
 *  - 내보내면 안 되는 것(장부 이름·관례 눈금 숫자)이 새지 않는가
 *  - `general` 유형이 `diet` 작업으로 오염되지 않는가 (두 유형 유지가 확정 사항)
 */

/** 세운이 현재 연도에 의존하므로 결과를 고정한다 */
const FIXED_NOW = { now: new Date("2026-08-13T00:00:00Z") };

function makeInput(partial: Partial<SajuInput> & { birthDate: string }): SajuInput {
  return sajuInputSchema.parse(partial);
}

const DIET_INPUT = makeInput({
  birthDate: "1990-05-17",
  birthTime: "14:30",
  gender: "female",
  readingType: "diet",
});
const GENERAL_INPUT = makeInput({ ...DIET_INPUT, readingType: "general" });

const chart = calculateSajuChart(DIET_INPUT, FIXED_NOW);
const dietPrompt = buildUserPrompt(DIET_INPUT, chart);
const generalPrompt = buildUserPrompt(GENERAL_INPUT, chart);

describe("체질 판정 블록", () => {
  it("diet 유형에만 실린다", () => {
    expect(dietPrompt).toContain("## 체질 판정 (계산 완료 · 수정 금지)");
    expect(generalPrompt).not.toContain("체질 판정");
  });

  it("코드가 정한 판정 네 축이 그대로 들어간다", () => {
    const { constitution } = chart;
    expect(dietPrompt).toContain(constitution.thermal);
    expect(dietPrompt).toContain(constitution.metabolism);
    expect(dietPrompt).toContain(constitution.gainPattern);
    expect(dietPrompt).toContain(constitution.dominantGroup);
  });

  it("과다·부족 오행과 그 관리 축이 들어간다", () => {
    const { constitution } = chart;
    for (const item of constitution.focus) {
      expect(dietPrompt).toContain(item.axis);
      expect(dietPrompt).toContain(item.diet);
      expect(dietPrompt).toContain(item.exercise);
    }
    expect(constitution.focus.length).toBeGreaterThan(0);
  });

  it("한열 식습관·움직임 항목이 들어간다", () => {
    expect(dietPrompt).toContain(chart.constitution.thermalDiet);
    expect(dietPrompt).toContain(chart.constitution.thermalExercise);
  });

  it("다시 판정하지 말라고 지시한다", () => {
    expect(dietPrompt).toContain("다시 판정하지 말고");
  });
});

describe("내보내지 않는 것", () => {
  it("장부 이름이 프롬프트에 없다", () => {
    // 오행-장부 배속은 배속의 출처일 뿐이다. 프롬프트에 넣으면 진단처럼 서술될 위험이 있다.
    for (const element of ["목", "화", "토", "금", "수"] as const) {
      expect(dietPrompt).not.toContain(BODY_AXIS[element].classical);
    }
  });

  it("한열 눈금 점수를 숫자로 내보내지 않는다", () => {
    // 우리 관례에서 나온 눈금이라 절대 수치가 아니다. 오행 점수와 같은 이유로 감춘다.
    expect(dietPrompt).not.toContain(`thermalScore`);
    expect(dietPrompt).not.toContain(`한열 점수`);
  });

  it("점수를 숫자로 인용하지 말라는 지시가 남아 있다", () => {
    expect(dietPrompt).toContain("숫자를 그대로 인용하지 말고");
    expect(generalPrompt).toContain("숫자를 그대로 인용하지 말고");
  });
});

describe("표현 규칙", () => {
  it("효능 주장·장기 진단·의학 용어를 금지한다", () => {
    expect(dietPrompt).toContain("효능을 주장하지 않는다");
    expect(dietPrompt).toContain("장기 이름으로 상태를 말하지 않는다");
    expect(dietPrompt).toContain("한의학의 사상체질");
  });

  it("전문가 상담 권고를 요구한다", () => {
    // app/disclaimer/page.tsx 가 같은 내용을 약속하고 있다.
    expect(dietPrompt).toContain("전문가와 상의하도록 권하는 한 문장");
  });
});

describe("general 유형은 그대로", () => {
  it("기존 절 구성이 유지된다", () => {
    for (const heading of [
      "## 한눈에 보기",
      "## 타고난 기질",
      "## 오행 균형",
      "## 관계와 일",
      "## 지금의 흐름",
      "## 지금 신경 쓰면 좋은 것",
    ]) {
      expect(generalPrompt).toContain(heading);
    }
  });

  it("원국 데이터는 두 유형이 같다", () => {
    // 상담 유형 줄만 다르고 그 아래 사실 블록은 동일해야 한다 (체질 판정 앞까지).
    const facts = (text: string) =>
      text.slice(text.indexOf("## 사주팔자"), text.indexOf("## 신강 / 신약"));
    expect(facts(dietPrompt)).toBe(facts(generalPrompt));
    expect(facts(dietPrompt)).toContain("## 오행 분포");
  });
});
