import { describe, expect, it } from "vitest";
import {
  GAN_KO,
  JI_KO,
  ganOhaeng,
  ganjiToKorean,
  hourGanIndex,
  hourToJiIndex,
  isRootedIn,
  isSupportingSipsin,
  isYang,
  jiAnimal,
  jiBongi,
  jiJanggan,
  jiOhaeng,
  jiSipsin,
  parseGanjiHanja,
  pillarOhaeng,
  seasonOf,
  seasonalStates,
  sexagenaryIndex,
  shiftSexagenary,
  fromSexagenary,
  sipsinOf,
  type Ohaeng,
} from "./ganji";

describe("간지 테이블", () => {
  it("천간 10개, 지지 12개", () => {
    expect(GAN_KO).toHaveLength(10);
    expect(JI_KO).toHaveLength(12);
  });

  it("한자 간지를 인덱스로 파싱한다", () => {
    expect(parseGanjiHanja("甲子")).toEqual({ gan: 0, ji: 0 });
    expect(parseGanjiHanja("庚午")).toEqual({ gan: 6, ji: 6 });
    expect(parseGanjiHanja("癸亥")).toEqual({ gan: 9, ji: 11 });
  });

  it("파싱 실패는 조용히 넘기지 않고 던진다", () => {
    // 라이브러리 출력 형식이 바뀌면 즉시 드러나야 한다
    expect(() => parseGanjiHanja("XY")).toThrow();
    expect(() => parseGanjiHanja("")).toThrow();
    expect(() => parseGanjiHanja("甲")).toThrow();
  });

  it("인덱스를 한글 간지로 바꾼다", () => {
    expect(ganjiToKorean({ gan: 6, ji: 6 })).toBe("경오");
    expect(ganjiToKorean({ gan: 0, ji: 0 })).toBe("갑자");
  });

  it("60갑자 한자 전수를 왕복 변환한다", () => {
    const ganHanja = "甲乙丙丁戊己庚辛壬癸";
    const jiHanja = "子丑寅卯辰巳午未申酉戌亥";
    for (let i = 0; i < 60; i += 1) {
      const gan = i % 10;
      const ji = i % 12;
      const parsed = parseGanjiHanja(`${ganHanja[gan]}${jiHanja[ji]}`);
      expect(parsed).toEqual({ gan, ji });
      expect(ganjiToKorean(parsed)).toBe(`${GAN_KO[gan]}${JI_KO[ji]}`);
    }
  });

  it("오행 배정이 문헌과 일치한다", () => {
    const ganExpected: Ohaeng[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
    ganExpected.forEach((element, gan) => expect(ganOhaeng(gan)).toBe(element));

    const jiExpected: Ohaeng[] = [
      "수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수",
    ];
    jiExpected.forEach((element, ji) => expect(jiOhaeng(ji)).toBe(element));
  });

  it("기둥 오행은 천간오행 + 지지오행", () => {
    expect(pillarOhaeng({ gan: 6, ji: 6 })).toBe("금화"); // 경오
    expect(pillarOhaeng({ gan: 8, ji: 6 })).toBe("수화"); // 임오
  });

  it("음양은 짝수 인덱스가 양", () => {
    for (let gan = 0; gan < 10; gan += 1) {
      expect(isYang(gan)).toBe(gan % 2 === 0);
    }
  });

  it("띠 12개가 지지 순서와 맞는다", () => {
    expect(jiAnimal(0)).toBe("쥐");
    expect(jiAnimal(6)).toBe("말");
    expect(jiAnimal(11)).toBe("돼지");
  });
});

describe("십신 (일간 10 × 대상 10 전수)", () => {
  it("같은 천간은 항상 비견", () => {
    for (let gan = 0; gan < 10; gan += 1) {
      expect(sipsinOf(gan, gan)).toBe("비견");
    }
  });

  it("십신 10종이 모두 산출된다", () => {
    const seen = new Set<string>();
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let target = 0; target < 10; target += 1) {
        seen.add(sipsinOf(ilgan, target));
      }
    }
    expect(seen.size).toBe(10);
  });

  it("일간마다 10종이 정확히 한 번씩 나온다", () => {
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      const counts = new Map<string, number>();
      for (let target = 0; target < 10; target += 1) {
        const sipsin = sipsinOf(ilgan, target);
        counts.set(sipsin, (counts.get(sipsin) ?? 0) + 1);
      }
      expect(counts.size).toBe(10);
      expect([...counts.values()].every((count) => count === 1)).toBe(true);
    }
  });

  it("실측 사례와 일치한다 (일간 임)", () => {
    // 1990-05-17 14:30 사주: 경오 신사 임오 정미, 일간 임(8)
    const ilgan = 8;
    expect(sipsinOf(ilgan, 6)).toBe("편인"); // 경: 금생수, 양양
    expect(sipsinOf(ilgan, 7)).toBe("정인"); // 신: 금생수, 양음
    expect(sipsinOf(ilgan, 3)).toBe("정재"); // 정: 수극화, 양음
    expect(sipsinOf(ilgan, 2)).toBe("편재"); // 병: 수극화, 양양
  });

  it("일간을 돕는 십신은 비겁·인성뿐", () => {
    expect(isSupportingSipsin("비견")).toBe(true);
    expect(isSupportingSipsin("겁재")).toBe(true);
    expect(isSupportingSipsin("편인")).toBe(true);
    expect(isSupportingSipsin("정인")).toBe(true);
    for (const sipsin of ["식신", "상관", "편재", "정재", "편관", "정관"] as const) {
      expect(isSupportingSipsin(sipsin)).toBe(false);
    }
  });
});

describe("지장간 본기와 지지 십신", () => {
  it("본기 12건이 문헌과 일치한다", () => {
    const expected: Record<string, string> = {
      자: "계", 축: "기", 인: "갑", 묘: "을", 진: "무", 사: "병",
      오: "정", 미: "기", 신: "경", 유: "신", 술: "무", 해: "임",
    };
    JI_KO.forEach((jiName, ji) => {
      expect(GAN_KO[jiBongi(ji)]).toBe(expected[jiName]);
    });
  });

  it("지지 십신은 본기 천간의 십신과 같다 (10 × 12 전수)", () => {
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let ji = 0; ji < 12; ji += 1) {
        expect(jiSipsin(ilgan, ji)).toBe(sipsinOf(ilgan, jiBongi(ji)));
      }
    }
  });
});

/**
 * 지장간 전체 표는 여기서 **독립으로 다시 적어** 대조한다 (TASK-32).
 * 소스의 숫자 인덱스를 그대로 베끼면 검증이 아니라 복사가 된다.
 */
describe("지장간 전체 (여기·중기·정기)", () => {
  /** 문헌 표 — 여기 → 중기 → 정기 순. 중기가 없는 지지는 두 글자다. */
  const LITERATURE: Record<string, string[]> = {
    자: ["임", "계"],
    축: ["계", "신", "기"],
    인: ["무", "병", "갑"],
    묘: ["갑", "을"],
    진: ["을", "계", "무"],
    사: ["무", "경", "병"],
    오: ["병", "기", "정"],
    미: ["정", "을", "기"],
    신: ["무", "임", "경"],
    유: ["경", "신"],
    술: ["신", "정", "무"],
    해: ["무", "갑", "임"],
  };

  it("12지지의 지장간이 문헌 표와 일치한다", () => {
    JI_KO.forEach((jiName, ji) => {
      const actual = jiJanggan(ji).map((gan) => GAN_KO[gan]);
      expect(actual).toEqual(LITERATURE[jiName]);
    });
  });

  it("정기(마지막 글자)가 본기와 같다", () => {
    // 표를 두 벌로 두지 않는다는 불변식. 어긋나면 십신 표시가 조용히 틀어진다.
    for (let ji = 0; ji < 12; ji += 1) {
      const hidden = jiJanggan(ji);
      expect(hidden[hidden.length - 1]).toBe(jiBongi(ji));
    }
  });

  it("사왕지(자·묘·유)는 두 글자, 나머지는 세 글자다", () => {
    // 오(午)는 중기 기(己)를 넣는 판본을 따랐으므로 세 글자다.
    const twoChars = [0, 3, 9]; // 자·묘·유
    for (let ji = 0; ji < 12; ji += 1) {
      expect(jiJanggan(ji)).toHaveLength(twoChars.includes(ji) ? 2 : 3);
    }
  });

  it("한 지지 안에 같은 천간이 두 번 들지 않는다", () => {
    for (let ji = 0; ji < 12; ji += 1) {
      const hidden = jiJanggan(ji);
      expect(new Set(hidden).size).toBe(hidden.length);
    }
  });

  it("정기의 오행은 지지 자체의 오행과 같다 (진술축미 제외)", () => {
    // 토(진술축미)는 잡기(雜氣)라 본기가 토이면서 지지 오행도 토다 — 같은 규칙에 든다.
    for (let ji = 0; ji < 12; ji += 1) {
      expect(ganOhaeng(jiBongi(ji))).toBe(jiOhaeng(ji));
    }
  });
});

describe("통근(通根) — 신강/신약 판정에만 쓴다", () => {
  it("본기가 이미 돕는 지지는 반드시 통근이다 (10 × 12 전수)", () => {
    // 판정이 약해지는 방향으로 움직이면 안 된다는 불변식.
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let ji = 0; ji < 12; ji += 1) {
        if (isSupportingSipsin(jiSipsin(ilgan, ji))) {
          expect(isRootedIn(ilgan, ji)).toBe(true);
        }
      }
    }
  });

  it("지장간에 비겁·인성이 하나라도 있으면 통근이다 (10 × 12 전수)", () => {
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let ji = 0; ji < 12; ji += 1) {
        const expected = jiJanggan(ji).some((gan) =>
          isSupportingSipsin(sipsinOf(ilgan, gan)),
        );
        expect(isRootedIn(ilgan, ji)).toBe(expected);
      }
    }
  });

  it("을(乙) 일간은 미(未)에 통근한다 — 본기만 보면 놓치는 자리", () => {
    const eul = 1;
    const mi = 7;
    expect(jiSipsin(eul, mi)).toBe("편재"); // 본기 기(己) 기준 표시는 그대로
    expect(isSupportingSipsin(jiSipsin(eul, mi))).toBe(false);
    expect(isRootedIn(eul, mi)).toBe(true); // 중기 을(乙)이 비견
  });

  it("을(乙) 일간이 통근하는 지지 목록이 지장간 표와 맞는다", () => {
    // 을을 돕는 천간: 갑·을(비겁), 임·계(인성)
    const eul = 1;
    const rooted = JI_KO.filter((_, ji) => isRootedIn(eul, ji));
    expect(rooted).toEqual(["자", "축", "인", "묘", "진", "미", "신", "해"]);
  });

  it("통근하지 않는 조합도 남아 있다 (판정이 늘 참이 되지 않는다)", () => {
    let none = 0;
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let ji = 0; ji < 12; ji += 1) {
        if (!isRootedIn(ilgan, ji)) none += 1;
      }
    }
    expect(none).toBeGreaterThan(0);
  });
});

describe("시주 (오서둔)", () => {
  it("자시는 23시에 시작해 01시에 끝난다", () => {
    expect(hourToJiIndex(23)).toBe(0);
    expect(hourToJiIndex(0)).toBe(0);
    expect(hourToJiIndex(1)).toBe(1);
    expect(hourToJiIndex(2)).toBe(1);
    expect(hourToJiIndex(22)).toBe(11);
  });

  it("24시간이 12시진에 두 시간씩 배정된다", () => {
    const counts = new Map<number, number>();
    for (let hour = 0; hour < 24; hour += 1) {
      const ji = hourToJiIndex(hour);
      counts.set(ji, (counts.get(ji) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
  });

  it("일간별 자시 천간이 오서둔과 일치한다", () => {
    // 갑기일→갑자시, 을경일→병자시, 병신일→무자시, 정임일→경자시, 무계일→임자시
    const jasiGanByIlgan = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
    jasiGanByIlgan.forEach((expectedGan, ilgan) => {
      expect(hourGanIndex(ilgan, 0)).toBe(expectedGan);
    });
  });

  it("시지가 순행하면 시간도 함께 순행한다 (10 × 12 전수)", () => {
    for (let ilgan = 0; ilgan < 10; ilgan += 1) {
      for (let ji = 0; ji < 12; ji += 1) {
        expect(hourGanIndex(ilgan, ji)).toBe(((ilgan % 5) * 2 + ji) % 10);
      }
    }
  });
});

describe("계절과 왕상휴수사", () => {
  it("월지로 계절을 정한다", () => {
    expect([2, 3, 4].map(seasonOf)).toEqual(["봄", "봄", "봄"]);
    expect([5, 6, 7].map(seasonOf)).toEqual(["여름", "여름", "여름"]);
    expect([8, 9, 10].map(seasonOf)).toEqual(["가을", "가을", "가을"]);
    expect([11, 0, 1].map(seasonOf)).toEqual(["겨울", "겨울", "겨울"]);
  });

  it("문헌 표와 일치한다 (지지 12 × 오행 5 = 60건)", () => {
    const literature: Record<string, Record<Ohaeng, string>> = {
      봄: { 목: "왕", 화: "상", 수: "휴", 금: "수", 토: "사" },
      여름: { 화: "왕", 토: "상", 목: "휴", 수: "수", 금: "사" },
      가을: { 금: "왕", 수: "상", 토: "휴", 화: "수", 목: "사" },
      겨울: { 수: "왕", 목: "상", 금: "휴", 토: "수", 화: "사" },
    };

    for (let monthJi = 0; monthJi < 12; monthJi += 1) {
      const states = seasonalStates(monthJi);
      const expectedForSeason = literature[seasonOf(monthJi)]!;
      for (const [element, expectedState] of Object.entries(expectedForSeason)) {
        expect(states[element as Ohaeng]).toBe(expectedState);
      }
    }
  });

  it("각 계절에 왕·상·휴·수·사가 하나씩", () => {
    for (let monthJi = 0; monthJi < 12; monthJi += 1) {
      const counts = new Map<string, number>();
      for (const state of Object.values(seasonalStates(monthJi))) {
        counts.set(state, (counts.get(state) ?? 0) + 1);
      }
      expect(counts.size).toBe(5);
      expect([...counts.values()].every((count) => count === 1)).toBe(true);
    }
  });
});

describe("60갑자 인덱스", () => {
  it("왕복 변환이 일치한다", () => {
    for (let i = 0; i < 60; i += 1) {
      expect(sexagenaryIndex({ gan: i % 10, ji: i % 12 })).toBe(i);
      expect(fromSexagenary(i)).toEqual({ gan: i % 10, ji: i % 12 });
    }
  });

  it("불가능한 조합은 던진다", () => {
    // 갑(0)은 짝수 지지와만 결합한다 — 갑축(0,1)은 60갑자에 없다
    expect(() => sexagenaryIndex({ gan: 0, ji: 1 })).toThrow();
  });

  it("순행·역행이 60 주기로 순환한다", () => {
    expect(shiftSexagenary(0, 1)).toBe(1);
    expect(shiftSexagenary(0, -1)).toBe(59);
    expect(shiftSexagenary(59, 1)).toBe(0);
    expect(shiftSexagenary(0, 60)).toBe(0);
    expect(shiftSexagenary(0, -60)).toBe(0);
  });
});
