import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMPTY_BIRTH_INPUT,
  birthplaceApplies,
  birthplaceLongitude,
  canSubmit,
  describeBirthInput,
  describeBirthplace,
  findBirthplace,
  hasIncompleteTime,
  placesInSido,
  type BirthInput,
} from "./birth-input";
import { BIRTHPLACES, BIRTHPLACE_SIDO } from "./birthplaces";
import { birthInputSignature, keyMatchesInput, readingCacheKey } from "./reading-cache";
import { READING_TYPES } from "../saju/schema";

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

  it("출생지는 넣는다 — 계산에 쓰이므로 확인이 필요하다", () => {
    const summary = describeBirthInput(
      make({
        birthDate: "1999-12-09",
        birthHour: "22",
        birthMinute: "12",
        gender: "female",
        birthplaceSido: "부산",
        birthplaceName: "부산",
      }),
    );
    expect(summary).toBe("1999-12-09 · 22:12 · 여성 · 부산");
  });

  it("반영되지 않는 상태면 요약에도 적지 않는다", () => {
    // 시각 미상이면 보정이 꺼진다. 적어 두면 반영된 줄 안다.
    const summary = describeBirthInput(
      make({ birthDate: "1999-12-09", timeUnknown: true, birthplaceSido: "부산", birthplaceName: "부산" }),
    );
    expect(summary).not.toContain("부산");
  });
});

/**
 * 출생지 경도 (TASK-37). 표 자체(`birthplaces.ts`)는 자동 생성이고 출처가 통계청
 * 행정구역 경계이므로, 여기서는 **표의 불변식과 조회 규칙**을 본다.
 */
describe("출생지 표", () => {
  it("시/도가 17개이고 표의 시/도가 그 안에 있다", () => {
    expect(BIRTHPLACE_SIDO).toHaveLength(17);
    const known = new Set<string>(BIRTHPLACE_SIDO);
    expect(BIRTHPLACES.filter((place) => !known.has(place.sido))).toEqual([]);
  });

  it("모든 시/도에 항목이 하나 이상 있다", () => {
    // 하나라도 비면 그 시/도를 골랐을 때 시/군 목록이 빈 채로 잠긴다.
    for (const sido of BIRTHPLACE_SIDO) {
      expect(placesInSido(sido).length, sido).toBeGreaterThan(0);
    }
  });

  /**
   * 시/군 드롭다운은 고를 것이 둘 이상일 때만 나온다 (TASK-38). 그 조건이 뜻을 가지려면
   * **선택지가 하나인 시/도가 표에 실제로 있어야** 한다 — 없으면 조건이 죽은 코드다.
   * 목록을 하드코딩하지 않고 표에서 세는 이유는 표가 자동 생성이라 다음 갱신에서 개수가
   * 바뀔 수 있기 때문이다 (제주는 지금 2개다).
   */
  it("선택지가 하나인 시/도와 둘 이상인 시/도가 모두 있다", () => {
    const counts = BIRTHPLACE_SIDO.map((sido) => placesInSido(sido).length);
    expect(counts.filter((n) => n === 1).length).toBeGreaterThan(0);
    expect(counts.filter((n) => n > 1).length).toBeGreaterThan(0);
  });

  it("시/도를 고르지 않으면 시/군 후보가 없다", () => {
    // 이 값이 0 이라 초기 화면에 드롭다운이 하나만 보인다.
    expect(placesInSido("")).toHaveLength(0);
  });

  it("시/도 + 시/군 조합이 유일하다", () => {
    // 이름만으로는 유일하지 않다 — 고성군이 강원·경남에 하나씩 있다.
    const keys = BIRTHPLACES.map((place) => `${place.sido}|${place.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(BIRTHPLACES.filter((place) => place.name === "고성군")).toHaveLength(2);
  });

  it("경도가 스키마 범위(124~132) 안이다", () => {
    // 벗어나면 서버 검증에 걸려 고를 수 없는 항목이 된다.
    for (const place of BIRTHPLACES) {
      expect(place.longitude, `${place.sido} ${place.name}`).toBeGreaterThanOrEqual(124);
      expect(place.longitude, `${place.sido} ${place.name}`).toBeLessThanOrEqual(132);
    }
  });

  it("문헌값과 어긋나지 않는다 (대표 지점)", () => {
    // 경계 자료에서 계산한 중심점이므로 잘 알려진 좌표와 0.2도 안에 있어야 한다.
    const expected: [string, string, number][] = [
      ["서울", "서울", 126.98],
      ["부산", "부산", 129.03],
      ["대구", "대구", 128.6],
      ["강원", "강릉시", 128.9],
      ["경북", "울릉군", 130.9],
      ["제주", "제주시", 126.53],
    ];
    for (const [sido, name, literature] of expected) {
      const place = BIRTHPLACES.find((p) => p.sido === sido && p.name === name);
      expect(place, `${sido} ${name} 없음`).toBeDefined();
      expect(Math.abs(place!.longitude - literature), `${sido} ${name}`).toBeLessThan(0.2);
    }
  });

  it("광역시는 구를 합치고 군은 따로 둔다", () => {
    // 인천을 군까지 합치면 옹진군(백령도)이 중심을 5분어치 서쪽으로 끈다.
    const incheon = placesInSido("인천").map((p) => p.name);
    expect(incheon).toEqual(expect.arrayContaining(["인천", "강화군", "옹진군"]));
    expect(incheon.filter((name) => name.endsWith("구"))).toEqual([]);
    expect(placesInSido("서울")).toHaveLength(1);
  });

  it("도 지역 통합시의 구는 모시로 합쳐져 있다", () => {
    const gyeonggi = placesInSido("경기").map((p) => p.name);
    expect(gyeonggi).toContain("수원시");
    // `구` 로 **끝나는** 것만 본다 — `구리시` 는 시(市)다 (실제로 오탐이 났다).
    expect(gyeonggi.filter((name) => name.endsWith("구"))).toEqual([]);
  });
});

describe("출생지 조회와 적용 조건", () => {
  const busan = make({
    birthDate: "1999-12-09",
    birthHour: "22",
    birthMinute: "12",
    birthplaceSido: "부산",
    birthplaceName: "부산",
  });

  it("고른 조합을 찾는다", () => {
    expect(findBirthplace(busan)?.name).toBe("부산");
    expect(describeBirthplace(busan)).toBe("부산");
  });

  it("시/도가 다르면 못 찾는다 — 조용히 서울로 돌아가지 않게", () => {
    expect(findBirthplace({ ...busan, birthplaceSido: "강원" })).toBeNull();
  });

  it("시/군 이름이 시/도와 다르면 앞에 시/도를 붙인다", () => {
    const input = make({ birthplaceSido: "강원", birthplaceName: "고성군" });
    expect(describeBirthplace(input)).toBe("강원 고성군");
  });

  it("미선택이면 경도를 보내지 않는다 (서울 기본값 유지)", () => {
    expect(birthplaceLongitude(make({ birthDate: "1999-12-09" }))).toBeUndefined();
  });

  it("고르면 그 경도를 보낸다", () => {
    expect(birthplaceLongitude(busan)).toBe(
      BIRTHPLACES.find((p) => p.sido === "부산" && p.name === "부산")!.longitude,
    );
  });

  it("시각 미상이면 쓰이지 않으므로 보내지 않는다", () => {
    // pillars.ts 가 시각을 모를 때 보정을 강제로 끈다.
    expect(birthplaceApplies({ ...busan, timeUnknown: true })).toBe(false);
    expect(birthplaceLongitude({ ...busan, timeUnknown: true })).toBeUndefined();
  });

  it("보정 없음을 고르면 쓰이지 않으므로 보내지 않는다", () => {
    expect(birthplaceApplies({ ...busan, solarTimeMode: "standard" })).toBe(false);
    expect(birthplaceLongitude({ ...busan, solarTimeMode: "standard" })).toBeUndefined();
  });
});

/**
 * 이미 받은 풀이를 다시 만들지 않기 위한 캐시 키 (TASK-60).
 *
 * **키가 틀리면 다른 사람의 풀이가 나온다.** 그래서 프로바이더 안이 아니라 순수 함수로
 * 빼 두고 여기서 검사한다. 아래 첫 검사는 `EMPTY_BIRTH_INPUT` 을 순회하므로
 * **`BirthInput` 에 필드가 늘면 자동으로 그 필드까지 본다** — 손으로 나열하면 새 필드가
 * 생겼을 때 조용히 옛 결과가 나온다.
 */
describe("풀이 캐시 키 (TASK-60)", () => {
  /** 필드마다 "지금 값과 다른 값" 하나. 타입을 보고 뒤집는다. */
  function flip(value: BirthInput[keyof BirthInput]): BirthInput[keyof BirthInput] {
    if (typeof value === "boolean") return !value;
    return value === "달라진값" ? "또다른값" : "달라진값";
  }

  it.each(Object.keys(EMPTY_BIRTH_INPUT) as (keyof BirthInput)[])(
    "%s 가 달라지면 키도 달라진다",
    (field) => {
      const changed = make({ [field]: flip(EMPTY_BIRTH_INPUT[field]) } as Partial<BirthInput>);
      expect(birthInputSignature(changed)).not.toBe(birthInputSignature(EMPTY_BIRTH_INPUT));
    },
  );

  it("이름만 달라도 다른 키다", () => {
    // 호칭이 본문에 박히므로 이름만 바꿔도 다른 글이다.
    expect(readingCacheKey(make({ name: "가" }), "diet")).not.toBe(
      readingCacheKey(make({ name: "나" }), "diet"),
    );
  });

  it("유형이 다르면 키도 다르다", () => {
    const keys = READING_TYPES.map((type) => readingCacheKey(EMPTY_BIRTH_INPUT, type));
    expect(new Set(keys).size).toBe(READING_TYPES.length);
  });

  it("필드 순서가 달라도 같은 키다", () => {
    // 정렬해서 만드는 이유다 — 객체를 어떻게 조립했느냐가 키를 바꾸면 안 된다.
    const input = make({ name: "가", birthDate: "1990-05-17" });
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as BirthInput;
    expect(readingCacheKey(reordered, "diet")).toBe(readingCacheKey(input, "diet"));
  });

  it("요청 시점 키가 지금 입력값의 것인지 가려낸다", () => {
    // 스트리밍 중에 입력을 고치면 그 완성본은 바뀐 입력의 것이 아니다.
    const before = readingCacheKey(make({ birthDate: "1990-05-17" }), "diet");
    expect(keyMatchesInput(before, make({ birthDate: "1990-05-17" }))).toBe(true);
    expect(keyMatchesInput(before, make({ birthDate: "1991-05-17" }))).toBe(false);
  });

  it("유형이 달라도 같은 입력이면 통과시킨다", () => {
    // 키의 앞부분(입력 스냅샷)만 보는 함수다 — 유형은 요청이 정한다.
    const key = readingCacheKey(make({ birthDate: "1990-05-17" }), "gain-cause");
    expect(keyMatchesInput(key, make({ birthDate: "1990-05-17" }))).toBe(true);
  });
});

/**
 * **완료된 것만 담는다** (TASK-60). 중간까지 받은 글을 캐시하면 다음에 **완결된 풀이인 척**
 * 나온다. 판단은 `SajuForm` 이 하므로 소스에서 조건을 확인한다 — 조건이 느슨해지면
 * 사용자가 잘린 글을 완성본으로 읽는다.
 */
describe("캐시에 담는 조건 (TASK-60)", () => {
  const form = readCode("components/SajuForm.tsx");

  it("done 까지 왔고 error 이벤트가 없었을 때만 담는다", () => {
    expect(form).toMatch(/if \(finished && !failed && receivedChart/);
    // `done`·`error` 이벤트가 실제로 그 값을 세우는지.
    expect(form).toMatch(/case "done":\s*finished = true;/);
    expect(form).toMatch(/case "error":\s*failed = true;/);
  });

  it("중단·네트워크 오류는 catch 로 빠져 담기지 않는다", () => {
    // remember 호출이 try 안, catch 앞에 있어야 한다.
    expect(form.indexOf("remember(requestKey")).toBeGreaterThan(-1);
    expect(form.indexOf("remember(requestKey")).toBeLessThan(form.indexOf("} catch (caught)"));
  });

  it("캐시 적중에는 자동 스크롤을 걸지 않는다", () => {
    // `chart` 에 걸면 캐시로 채운 경우에도 돌아 화면이 튄다.
    expect(form).toContain("}, [arrivedCount]);");
    expect(form).not.toContain("}, [chart]);");
  });
});

/**
 * 입력값이 프로세스 밖으로 나가면 `app/privacy/page.tsx` 의 "저장하지 않습니다" 가
 * 무너진다 (TASK-30 결정 2). 저장소는 디스크에, 쿼리스트링은 방문 기록과 **Vercel
 * 액세스 로그**에 생년월일을 남긴다. 소스에서 막는다 — 리뷰로는 놓친다.
 *
 * `FirstVisitNotice` 와 `LikeButton` 은 검사 대상이 아니다. 거기 쓰는 localStorage 는
 * 안내를 닫았는지 · 좋아요를 눌렀는지 두 가지뿐이고 처리방침이 둘 다 명시하고 있다.
 * **둘 다 생년월일 경로가 아니다** — 아래 목록에 그 파일들이 없는 이유다.
 */
describe("입력값은 메모리에만 둔다", () => {
  const sources = [
    "components/BirthInputProvider.tsx",
    "components/SajuForm.tsx",
    "app/reading/[type]/page.tsx",
    "app/page.tsx",
    "lib/form/birth-input.ts",
    "lib/form/reading-cache.ts",
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
 * 드롭다운 정리 (TASK-38). 화면을 눈으로 봐야 아는 것이 많은 영역이라, **소스에서
 * 지킬 수 있는 것만** 고정한다 — 조건이 파생값에서 나오는지, 색이 컴포넌트에 새지 않는지.
 */
describe("출생지 드롭다운", () => {
  it("시/군 드롭다운을 파생값으로 조건부 렌더한다", () => {
    const form = readCode("components/SajuForm.tsx");
    expect(form).toContain("placesInChosenSido.length > 1 &&");
  });

  it("하나뿐인 시/도 이름을 코드에 박아 두지 않는다", () => {
    // 표는 자동 생성이라 다음 갱신에서 개수가 바뀔 수 있다. 파생값으로 판정해야 한다.
    const form = readCode("components/SajuForm.tsx");
    expect(form).not.toMatch(/["'](?:서울|광주|대전|세종)["']\s*[,)\]]/);
  });

  it("화살표 색을 컴포넌트에 적지 않는다", () => {
    // `lib/design/tokens.test.ts` 가 raw 색상을 막는다. 색은 globals.css 의 토큰이 정한다.
    const form = readCode("components/SajuForm.tsx");
    expect(form).toContain("select-shell");
    expect(form).not.toContain("clip-path");

    const css = readCode("app/globals.css");
    expect(css).toContain(".select-shell");
    // 삼각형을 data URI 로 그리면 팔레트에 없는 색이 하나 생긴다.
    expect(css).toContain("clip-path: polygon(0 0, 100% 0, 50% 100%)");
    expect(css).toContain("background-color: var(--color-ink-muted)");
  });

  /**
   * 성별·양력음력은 **칩 둘**이다 (TASK-85). 선택지가 사실상 둘인데 드롭다운이면 한 번 더
   * 눌러야 목록이 보인다. 되돌아가면 그 비용이 그대로 돌아온다.
   */
  it("성별과 양력/음력이 칩이다", () => {
    const form = readCode("components/SajuForm.tsx");
    expect(form).toContain("ChoiceChips");
    // 드롭다운으로 되돌아가면 이 문구가 함께 돌아온다.
    expect(form).not.toContain("선택 안 함");
  });

  /**
   * **`unspecified` 를 세 번째 칩으로 만들지 않는다.** 둘 다 비선택인 것이 곧 미지정이다 —
   * 값 셋을 화면에 그대로 옮기면 "고르지 않음" 이 하나의 선택지처럼 보인다.
   * `BirthInput["gender"]` 의 값 셋과 `sajuInputSchema` 는 그대로 둔다 (API 계약이다).
   */
  it("미지정이 칩으로 나오지 않는다", () => {
    const form = readCode("components/SajuForm.tsx");
    expect(form).toMatch(/GENDER_CHIPS = \[[^\]]*\]/);
    expect(form).not.toMatch(/value: "unspecified"/);
  });

  /**
   * 성별을 안 고르면 대운이 `null` 이 되어 근거 카드와 공유 카드 칩이 조용히 사라진다.
   * **폼이 그 대가를 말해야 한다** (TASK-85) — 예전에는 `decade`(내부 유형)에서만 말했다.
   */
  it("성별 미선택의 대가가 폼에 적혀 있다", () => {
    const form = readCode("components/SajuForm.tsx");
    expect(form).toMatch(/gender === "unspecified" &&/);
    expect(form).toContain("대운");
  });

  /**
   * 칩은 옆 칸의 입력과 **밑선이 맞아야** 한다 — 규격은 `field.ts`·`Button.tsx` 와 같은
   * 값이다(48px · radius 12px). 포커스 링은 전역 `:focus-visible` 이 건다.
   */
  it("칩 부품이 입력과 같은 규격을 쓴다", () => {
    const chips = readCode("components/ui/ChoiceChips.tsx");
    expect(chips).toContain("h-12");
    expect(chips).toContain("rounded-xl");
    expect(chips).not.toContain("focus:ring");
    // `<select>` 가 공짜로 주던 것을 직접 만들어야 한다.
    expect(chips).toContain('role="radiogroup"');
    expect(chips).toContain("aria-labelledby");
    expect(chips).toContain("ArrowRight");
  });

  it("모든 select 가 같은 껍데기를 쓴다", () => {
    // 하나만 빠지면 그 칸만 브라우저 기본 화살표가 남아 폼에 화살표가 두 종류가 된다.
    // **개수를 대조하므로** 나중에 select 를 추가하면서 껍데기를 빠뜨리면 여기서 걸린다.
    const form = readCode("components/SajuForm.tsx");
    const selects = form.match(/<select\b/g) ?? [];
    const shells = form.match(/<SelectShell>/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);
    expect(shells).toHaveLength(selects.length);
  });
});

/**
 * 홈으로 돌아가는 동선 (TASK-42). 홈으로 가는 길이 푸터 링크 하나뿐이었고, 긴 고지
 * 페이지에서는 끝까지 스크롤해야 나왔다.
 */
describe("홈으로 돌아가는 동선", () => {
  it("긴 고지 페이지 상단에 홈 링크가 있다", () => {
    for (const page of ["app/privacy/page.tsx", "app/disclaimer/page.tsx"]) {
      expect(readCode(page), page).toContain("<BackLink />");
    }
  });

  it("링크 문구와 모양이 한 곳에서만 정의된다", () => {
    // 두 페이지에 각각 적으면 문구와 모양이 갈라진다.
    const component = readCode("components/BackLink.tsx");
    expect(component).toContain('href="/"');
    for (const page of ["app/privacy/page.tsx", "app/disclaimer/page.tsx"]) {
      expect(readCode(page), page).not.toContain('href="/"');
    }
  });

  it("푸터 링크 이름이 목적지를 말한다", () => {
    // `사주 풀이` 는 어디로 가는지도, 지금 거기 있는지도 알려주지 않았다.
    const footer = readCode("components/SiteFooter.tsx");
    expect(footer).toContain("처음으로");
    expect(footer).not.toMatch(/>\s*사주 풀이\s*</);
  });

  it("고지 페이지와 푸터가 서버 컴포넌트로 남는다", () => {
    // 현재 페이지를 알려면 usePathname() 이 필요하고, 그러면 `/` 에도 클라이언트 JS 가
    // 들어가 `/` 를 통째로 정적으로 두는 성질이 깨진다.
    for (const file of [
      "components/BackLink.tsx",
      "components/SiteFooter.tsx",
      "app/privacy/page.tsx",
      "app/disclaimer/page.tsx",
    ]) {
      expect(readCode(file), file).not.toContain("use client");
      expect(readCode(file), file).not.toContain("usePathname");
    }
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

  it("카드가 이미 말하는 것을 문구로 되풀이하지 않는다 (TASK-34 · 35)", () => {
    const home = readCode("app/page.tsx");
    expect(home).not.toContain("무엇을 볼까요");
    expect(home).not.toContain("입력하는 화면으로 넘어갑니다");
    expect(home).not.toContain("입력한 정보는 저장하지 않습니다");
  });

  it("목록의 접근 가능한 이름은 남아 있다", () => {
    // 화면에서 제목만 지우면 스크린리더 사용자는 이 목록이 무엇인지 알 수 없다.
    expect(readCode("app/page.tsx")).toMatch(/<ul[^>]*aria-label=/);
  });

  it("\"저장하지 않는다\" 안내는 입력 화면에 그대로 있다", () => {
    // `/` 에서 지운 것은 중복이지 약속이 아니다.
    expect(readCode("components/FirstVisitNotice.tsx")).toContain("저장하지 않습니다");
    expect(readCode("components/SajuForm.tsx")).toContain("저장하지 않고");
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
