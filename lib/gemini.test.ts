import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiError, toGeminiError, toSafeLogMessage } from "./gemini";

/**
 * 실패 분류와 로그 마스킹 검증 (TASK-13).
 *
 * 이 두 경로는 조용히 틀리면 위험하다.
 *  - **분류**: 사용자 문구("내일 다시" vs "1분 후 다시")와 지표가 같은 판별에서 나온다.
 *    일일 소진에 "1분 후" 라고 하면 거짓말이 된다.
 *  - **마스킹**: API 키가 로그로 새면 폐기·재발급까지 해야 한다.
 *
 * SDK 예외 모양을 실물에 가깝게 흉내 내 대조한다 (Google 은 상태를 `status` 나 `code` 에
 * 담고, 쿼터 정보는 메시지 문자열의 `quotaId` 에 담는다).
 */

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // toGeminiError 는 서버 로그를 남긴다. 테스트 출력이 지저분해지지 않게 막는다.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

/** SDK 예외 흉내 */
function apiError(message: string, status?: number): Error {
  const error = new Error(message);
  if (status !== undefined) Object.assign(error, { status });
  return error;
}

describe("실패 분류", () => {
  it("일일 쿼터 소진 → quota_day, 내일 다시 안내", () => {
    const error = toGeminiError(
      apiError(
        'RESOURCE_EXHAUSTED: quota exceeded, quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "500"',
        429,
      ),
      "test",
    );
    expect(error.kind).toBe("quota_day");
    expect(error.status).toBe(429);
    expect(error.message).toContain("내일");
    expect(error.message).not.toContain("1분");
  });

  it("분당 쿼터 → quota_minute, 1분 후 안내", () => {
    const error = toGeminiError(
      apiError(
        'RESOURCE_EXHAUSTED: quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"',
        429,
      ),
      "test",
    );
    expect(error.kind).toBe("quota_minute");
    expect(error.status).toBe(429);
    expect(error.message).toContain("1분");
    expect(error.message).not.toContain("내일");
  });

  it("상태 코드 없이 RESOURCE_EXHAUSTED 만 와도 쿼터로 분류한다", () => {
    // SDK 버전에 따라 상태가 실리지 않는 경우가 있다.
    expect(toGeminiError(apiError("RESOURCE_EXHAUSTED"), "test").kind).toBe("quota_minute");
  });

  it("잘못된 키 → auth, 상태는 500 (서버 설정 문제다)", () => {
    // Google 은 401 이 아니라 400 INVALID_ARGUMENT / API_KEY_INVALID 를 준다.
    const error = toGeminiError(apiError("INVALID_ARGUMENT: API_KEY_INVALID", 400), "test");
    expect(error.kind).toBe("auth");
    expect(error.status).toBe(500);
  });

  it("401·403 도 auth 로 분류한다", () => {
    for (const status of [401, 403]) {
      expect(toGeminiError(apiError("permission denied", status), "test").kind).toBe("auth");
    }
  });

  it("안전 정책 차단 → safety, 422", () => {
    const error = toGeminiError(apiError("blocked by SAFETY settings"), "test");
    expect(error.kind).toBe("safety");
    expect(error.status).toBe(422);
  });

  it("분류되지 않는 실패 → unknown, 502", () => {
    const error = toGeminiError(apiError("socket hang up"), "test");
    expect(error.kind).toBe("unknown");
    expect(error.status).toBe(502);
  });

  it("이미 GeminiError 면 분류를 유지한다", () => {
    // streamText 의 빈 응답 오류가 이 경로로 지나간다.
    const original = new GeminiError("빈 응답", 502, "empty");
    expect(toGeminiError(original, "test")).toBe(original);
    expect(toGeminiError(original, "test").kind).toBe("empty");
  });

  it("사용자에게 보내는 문구에 원문 오류가 섞이지 않는다", () => {
    const error = toGeminiError(apiError("Error: connect ECONNREFUSED 10.1.2.3:443"), "test");
    expect(error.message).not.toContain("ECONNREFUSED");
    expect(error.message).not.toContain("10.1.2.3");
  });
});

describe("로그 마스킹", () => {
  const KEY = "AIzaSyTESTKEY_do_not_use_1234567890";

  it("메시지에 섞인 API 키를 가린다", () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = KEY;
    try {
      const masked = toSafeLogMessage(new Error(`request failed with key=${KEY}`));
      expect(masked).not.toContain(KEY);
      expect(masked).toContain("[REDACTED]");
    } finally {
      if (previous === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previous;
    }
  });

  it("키가 여러 번 나와도 전부 가린다", () => {
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = KEY;
    try {
      const masked = toSafeLogMessage(new Error(`${KEY} then ${KEY}`));
      expect(masked).not.toContain(KEY);
    } finally {
      if (previous === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previous;
    }
  });

  it("키가 설정돼 있지 않아도 던지지 않는다", () => {
    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect(toSafeLogMessage(new Error("boom"))).toContain("boom");
    } finally {
      if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
    }
  });

  it("Error 가 아닌 값도 문자열로 다룬다", () => {
    expect(toSafeLogMessage("just a string")).toContain("just a string");
    expect(toSafeLogMessage(undefined)).toBe("undefined");
  });
});
