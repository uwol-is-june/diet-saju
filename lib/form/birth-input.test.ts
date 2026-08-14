import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMPTY_BIRTH_INPUT,
  canSubmit,
  describeBirthInput,
  hasIncompleteTime,
  type BirthInput,
} from "./birth-input";

function make(patch: Partial<BirthInput> = {}): BirthInput {
  return { ...EMPTY_BIRTH_INPUT, ...patch };
}

/**
 * 소스를 **주석을 걷어내고** 읽는다. 아래 구조 검사는 "코드가 무엇을 하는가" 를 보는데,
 * 주석은 대개 "무엇을 하지 않기로 했는가" 를 설명하느라 같은 낱말을 쓴다
 * (예: 프로바이더 주석의 "localStorage 를 쓰지 않는다"). 그대로 훑으면 설명이 위반으로 잡힌다.
 */
function readCode(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `://`(URL)은 남긴다 — 줄 주석만 지운다.
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("시각 한쪽만 고른 상태", () => {
  it("시만 고르면 미완성이다", () => {
    expect(hasIncompleteTime(make({ birthHour: "22" }))).toBe(true);
  });

  it("분만 고르면 미완성이다", () => {
    expect(hasIncompleteTime(make({ birthMinute: "12" }))).toBe(true);
  });

  it("둘 다 고르면 완성이다", () => {
    expect(hasIncompleteTime(make({ birthHour: "22", birthMinute: "12" }))).toBe(false);
  });

  it("둘 다 안 고르면 미완성이 아니다 (시각 미상으로 넘어간다)", () => {
    expect(hasIncompleteTime(make())).toBe(false);
  });

  it("시각을 모른다고 하면 남은 선택은 무시한다", () => {
    // 체크 전에 시만 골라 둔 상태가 남아 있어도 제출을 막지 않는다.
    expect(hasIncompleteTime(make({ timeUnknown: true, birthHour: "22" }))).toBe(false);
  });
});

describe("제출 가능 여부", () => {
  it("생년월일이 없으면 제출할 수 없다", () => {
    expect(canSubmit(make())).toBe(false);
  });

  it("생년월일만 있어도 제출할 수 있다 (시각 미상 해석)", () => {
    expect(canSubmit(make({ birthDate: "1999-12-09" }))).toBe(true);
  });

  it("시각이 반쪽이면 제출할 수 없다", () => {
    expect(canSubmit(make({ birthDate: "1999-12-09", birthHour: "22" }))).toBe(false);
  });
});

describe("접힌 폼의 요약 한 줄", () => {
  it("생년월일 · 시각 · 성별 순으로 적는다", () => {
    const summary = describeBirthInput(
      make({
        birthDate: "1999-12-09",
        birthHour: "22",
        birthMinute: "12",
        gender: "female",
      }),
    );
    expect(summary).toBe("1999-12-09 · 22:12 · 여성");
  });

  it("시각을 모르면 그렇게 적는다", () => {
    const summary = describeBirthInput(
      make({ birthDate: "1999-12-09", timeUnknown: true, gender: "male" }),
    );
    expect(summary).toBe("1999-12-09 · 시각 미상 · 남성");
  });

  it("시각을 안 골랐어도 미상으로 적는다", () => {
    const summary = describeBirthInput(make({ birthDate: "1999-12-09" }));
    expect(summary).toBe("1999-12-09 · 시각 미상 · 성별 미지정");
  });

  it("음력이면 앞에 밝힌다", () => {
    // 양력으로 착각하면 원국이 통째로 달라진다.
    expect(describeBirthInput(make({ birthDate: "1999-12-09", calendar: "lunar" }))).toBe(
      "음력 · 1999-12-09 · 시각 미상 · 성별 미지정",
    );
    expect(
      describeBirthInput(make({ birthDate: "1999-12-09", calendar: "lunar", isLeapMonth: true })),
    ).toBe("음력 윤달 · 1999-12-09 · 시각 미상 · 성별 미지정");
  });

  it("양력이면 달력 표기를 붙이지 않는다", () => {
    expect(describeBirthInput(make({ birthDate: "1999-12-09" }))).not.toContain("음력");
  });

  it("이름을 넣지 않는다", () => {
    // 옆에 사람이 있을 때 생년월일 옆의 이름은 그 자체로 신원이 된다.
    const summary = describeBirthInput(make({ birthDate: "1999-12-09", name: "홍길동" }));
    expect(summary).not.toContain("홍길동");
  });
});

/**
 * 입력값이 프로세스 밖으로 나가면 `app/privacy/page.tsx` 의 "저장하지 않습니다" 가
 * 무너진다 (TASK-30 결정 2). 저장소는 디스크에, 쿼리스트링은 방문 기록과 **Vercel
 * 액세스 로그**에 생년월일을 남긴다. 소스에서 막는다 — 리뷰로는 놓친다.
 *
 * `FirstVisitNotice` 는 검사 대상이 아니다. 거기 쓰는 localStorage 는 안내를 닫았는지
 * 여부뿐이고 처리방침이 그 하나를 명시하고 있다.
 */
describe("입력값은 메모리에만 둔다", () => {
  const sources = [
    "components/BirthInputProvider.tsx",
    "components/SajuForm.tsx",
    "app/reading/[type]/page.tsx",
    "app/page.tsx",
    "lib/form/birth-input.ts",
  ];

  it.each(sources)("%s 가 브라우저 저장소를 쓰지 않는다", (path) => {
    expect(readCode(path)).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  });

  it.each(sources)("%s 가 입력값을 URL 에 싣지 않는다", (path) => {
    expect(readCode(path)).not.toMatch(/useSearchParams|URLSearchParams|searchParams/);
  });

  it("프로바이더가 루트 레이아웃에 있다", () => {
    // `app/reading/layout.tsx` 로 내리면 `/` 를 거쳐 갈 때 언마운트되어 값이 날아간다.
    expect(readCode("app/layout.tsx")).toContain("BirthInputProvider");
    expect(() => readCode("app/reading/layout.tsx")).toThrow();
  });
});

/**
 * 유형은 **라우트 하나**가 정한다 (TASK-30). 폼 안에도 선택 컨트롤을 두면 두 곳에서
 * 고를 수 있게 되고 반드시 어긋난다.
 */
describe("유형은 라우트가 정한다", () => {
  it("폼에 유형 선택 컨트롤이 없다", () => {
    const form = readCode("components/SajuForm.tsx");
    expect(form).not.toContain("풀이 유형");
    expect(form).not.toContain("READING_TYPES");
    expect(form).not.toContain("READING_TYPE_LABEL");
  });

  it("폼이 유형을 prop 으로만 받는다", () => {
    const form = readCode("components/SajuForm.tsx");
    expect(form).toContain("readingType }: { readingType: ReadingType }");
    // 요청 시점 유형을 따로 붙들던 상태는 필요 없어졌다 — 라우트가 정하므로 바뀌지 않는다.
    expect(form).not.toContain("resultType");
  });

  it("첫 화면에 생년월일 입력이 없다", () => {
    const home = readCode("app/page.tsx");
    expect(home).not.toContain("SajuForm");
    expect(home).not.toMatch(/type="date"/);
  });

  it("첫 화면의 카드가 링크다", () => {
    // 버튼 + router.push 로 하면 새 탭·가운데 클릭·크롤러가 다 죽는다.
    const home = readCode("app/page.tsx");
    expect(home).toContain("next/link");
    expect(home).not.toContain("useRouter");
  });

  it("잘못된 세그먼트는 404 다", () => {
    const page = readCode("app/reading/[type]/page.tsx");
    expect(page).toContain("notFound");
    expect(page).toContain("generateStaticParams");
  });
});

/**
 * 결과 뒤 동선 (TASK-31) — 다른 유형으로 **평범한 라우트 이동**으로 넘어간다.
 * `router.replace` 로 URL 과 화면을 따로 맞추면 URL 과 보이는 결과가 어긋난다.
 */
describe("결과 뒤 동선", () => {
  it("다른 유형 링크가 next/link 로 이동한다", () => {
    const links = readCode("components/OtherReadingLinks.tsx");
    expect(links).toContain("next/link");
    expect(links).not.toContain("useRouter");
    expect(links).not.toContain("replace");
  });

  it("현재 유형은 목록에서 빠진다", () => {
    const links = readCode("components/OtherReadingLinks.tsx");
    expect(links).toContain("READING_TYPES.filter((type) => type !== current)");
  });

  it("결과 화면이 그 링크를 낸다", () => {
    expect(readCode("components/SajuForm.tsx")).toContain("OtherReadingLinks");
  });

  it("유형별 메타데이터가 붙어 있다", () => {
    const page = readCode("app/reading/[type]/page.tsx");
    expect(page).toContain("generateMetadata");
    expect(page).toContain("READING_TYPE_META");
  });

  it("og:image 는 / 와 같은 고정 카드 하나를 가리킨다", () => {
    // 파일 규약(app/opengraph-image.png)은 하위 세그먼트로 상속되지 않는다.
    // 이 줄이 없으면 사람들이 실제로 공유하는 URL 에서 이미지 없는 카드가 나간다.
    const page = readCode("app/reading/[type]/page.tsx");
    expect(page).toContain('"/opengraph-image.png"');
    // 유형별 카드를 만들면 원본 HTML 과 팔레트 검사가 세 벌이 된다.
    expect(page).not.toMatch(/opengraph-image-(?:general|diet|yearly)/);
  });
});
