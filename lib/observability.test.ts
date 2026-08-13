import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SAJU_REQUEST_EVENT,
  recordSajuRequest,
  startTimer,
  type SajuRequestMetrics,
} from "./observability";

/**
 * 계측 검증 (TASK-13).
 *
 * 여기서 지키는 것은 두 가지다.
 *  1. **개인정보가 로그로 새지 않는다** — 개인정보 처리방침 3항이 생년월일을 "서버 로그에도
 *     기록하지 않는다" 고 약속한다. 타입으로 막지만 타입은 캐스팅으로 우회되므로
 *     직렬화 단계의 허용 목록까지 검사한다.
 *  2. **한 줄에 JSON 하나** — 여러 줄로 쪼개지면 로그 수집기가 별개 항목으로 읽는다.
 */

let logged: string[] = [];
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logged = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
});

afterEach(() => {
  logSpy.mockRestore();
});

const parseOnly = (): Record<string, unknown> => {
  expect(logged.length).toBe(1);
  return JSON.parse(logged[0]!) as Record<string, unknown>;
};

describe("로그 한 줄 형식", () => {
  it("줄바꿈 없는 JSON 한 줄이다", () => {
    recordSajuRequest({ outcome: "ok", status: 200 });
    expect(logged[0]).not.toContain("\n");
    expect(parseOnly().event).toBe(SAJU_REQUEST_EVENT);
  });

  it("undefined 필드는 실리지 않는다", () => {
    recordSajuRequest({ outcome: "rate_limited", status: 429 });
    expect(Object.keys(parseOnly()).sort()).toEqual(["event", "outcome", "status"]);
  });

  it("지정한 값은 그대로 실린다", () => {
    recordSajuRequest({
      outcome: "ok",
      status: 200,
      readingType: "diet",
      model: "gemini-3.5-flash-lite",
      ttfbMs: 1300,
      durationMs: 4400,
      chars: 1500,
      timeUnknown: false,
      genderKnown: true,
    });
    expect(parseOnly()).toEqual({
      event: SAJU_REQUEST_EVENT,
      outcome: "ok",
      status: 200,
      readingType: "diet",
      model: "gemini-3.5-flash-lite",
      ttfbMs: 1300,
      durationMs: 4400,
      chars: 1500,
      timeUnknown: false,
      genderKnown: true,
    });
  });
});

describe("개인정보가 새지 않는다", () => {
  /** 타입을 우회해 개인정보를 밀어 넣어 본다 — 실제 사고는 이런 모양으로 난다. */
  const leaky = {
    outcome: "ok",
    status: 200,
    birthDate: "1990-05-17",
    birthTime: "14:30",
    name: "홍길동",
    gender: "female",
    ip: "203.0.113.7",
    prompt: "생년월일 1990-05-17 ...",
    reading: "고객님은 ...",
  } as unknown as SajuRequestMetrics;

  it.each([
    "birthDate",
    "birthTime",
    "name",
    "gender",
    "ip",
    "prompt",
    "reading",
  ])("허용 목록에 없는 %s 는 버려진다", (field) => {
    recordSajuRequest(leaky);
    expect(parseOnly()).not.toHaveProperty(field);
  });

  it("값 자체가 로그 문자열에 남지 않는다", () => {
    recordSajuRequest(leaky);
    for (const value of ["1990-05-17", "14:30", "홍길동", "203.0.113.7"]) {
      expect(logged[0], `${value} 가 로그에 남았다`).not.toContain(value);
    }
  });

  it("성별은 값이 아니라 지정 여부만 남는다", () => {
    recordSajuRequest({ outcome: "ok", status: 200, genderKnown: true });
    const payload = parseOnly();
    expect(payload.genderKnown).toBe(true);
    expect(payload).not.toHaveProperty("gender");
  });
});

describe("200 안의 실패도 집계된다", () => {
  it("reading_failed 는 상태 200 과 함께 기록된다", () => {
    // 이 조합이 이 태스크의 핵심이다. 상태 코드만 세면 성공으로 잡힌다.
    recordSajuRequest({
      outcome: "reading_failed",
      status: 200,
      failure: "quota_day",
      chars: 0,
    });
    const payload = parseOnly();
    expect(payload.outcome).toBe("reading_failed");
    expect(payload.status).toBe(200);
    expect(payload.failure).toBe("quota_day");
  });

  it("부분 결과가 남은 실패는 chars 로 구분된다", () => {
    recordSajuRequest({ outcome: "reading_failed", status: 200, failure: "unknown", chars: 830 });
    expect(parseOnly().chars).toBe(830);
  });
});

describe("계측이 요청을 깨뜨리지 않는다", () => {
  it("직렬화가 불가능해도 예외를 던지지 않는다", () => {
    const circular = { outcome: "ok", status: 200 } as unknown as Record<string, unknown>;
    circular.model = circular; // JSON.stringify 가 던진다
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => recordSajuRequest(circular as unknown as SajuRequestMetrics)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("소요 시간 측정", () => {
  it("주입한 시계로 경과 시간을 낸다", () => {
    let clock = 1_000;
    const elapsed = startTimer(() => clock);
    clock = 1_250;
    expect(elapsed()).toBe(250);
    clock = 5_400;
    expect(elapsed()).toBe(4_400);
  });
});
