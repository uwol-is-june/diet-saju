import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COUNTER_KEYS,
  COUNTER_KINDS,
  counterKey,
  readCounters,
  snapshotFromMget,
} from "./counters";
import { resolveCounterStore } from "./env";
import { READING_TYPES } from "./saju/schema";

/**
 * 카운터 저장소 (TASK-51).
 *
 * 네트워크를 타는 부분은 테스트하지 않는다 — 대신 그 앞뒤의 **순수한 두 조각**(키 목록,
 * 응답 파싱)과 **저장소가 없을 때의 동작**을 고정한다. 진짜 연결 확인은 `/admin` 이 한다.
 */

describe("키", () => {
  it("모든 유형 × 종류를 덮는다", () => {
    expect(COUNTER_KEYS).toHaveLength(READING_TYPES.length * COUNTER_KINDS.length);
    expect(new Set(COUNTER_KEYS).size).toBe(COUNTER_KEYS.length);
    for (const type of READING_TYPES) {
      for (const kind of COUNTER_KINDS) {
        expect(COUNTER_KEYS).toContain(counterKey(kind, type));
      }
    }
  });

  /**
   * 생년월일에서 나온 값이 키에 섞이면 결과를 저장하는 것이 되어 개인정보 처리방침의
   * "저장하지 않습니다" 가 죽는다. 키에 들어갈 수 있는 것은 종류와 유형 id 뿐이다.
   */
  it("종류와 유형 id 말고는 아무것도 담지 않는다", () => {
    for (const key of COUNTER_KEYS) {
      const [kind, ...rest] = key.split(":");
      expect(COUNTER_KINDS).toContain(kind);
      expect(READING_TYPES).toContain(rest.join(":"));
    }
  });
});

describe("MGET 응답 파싱", () => {
  it("키 순서대로 되돌린다", () => {
    const values = COUNTER_KEYS.map((_, index) => String(index + 1));
    const snapshot = snapshotFromMget(values);
    COUNTER_KEYS.forEach((key, index) => {
      const [kind, type] = key.split(":") as [(typeof COUNTER_KINDS)[number], string];
      expect(snapshot[type as keyof typeof snapshot][kind]).toBe(index + 1);
    });
  });

  /** 없는 키는 Redis 가 null 을 준다 — 아직 아무도 안 본 유형이라는 뜻이다. */
  it("null 은 0 이다", () => {
    const snapshot = snapshotFromMget(COUNTER_KEYS.map(() => null));
    for (const type of READING_TYPES) {
      expect(snapshot[type]).toEqual({ views: 0, likes: 0 });
    }
  });

  /**
   * 값이 이상해도 던지지 않는다. 여기서 던지면 화면 하나가 통째로 죽는데, 카운터는
   * 없어도 되는 값이라 그럴 이유가 없다.
   */
  it("숫자가 아니거나 음수면 0 으로 떨어뜨린다", () => {
    const snapshot = snapshotFromMget(COUNTER_KEYS.map(() => "nope"));
    expect(snapshot[READING_TYPES[0]!].views).toBe(0);
    expect(snapshotFromMget(COUNTER_KEYS.map(() => "-5"))[READING_TYPES[0]!].views).toBe(0);
    expect(snapshotFromMget([])[READING_TYPES[0]!].views).toBe(0);
  });
});

describe("저장소가 없을 때", () => {
  /** 테스트 환경에는 환경변수가 없다 — 그 상태가 정상 동작이어야 한다. */
  it("던지지 않고 unconfigured 를 돌려준다", async () => {
    await expect(readCounters()).resolves.toEqual({ state: "unconfigured" });
  });
});

/**
 * 환경변수 이름이 두 벌인 것이 실제로 문제를 냈다 — Vercel 마켓플레이스 연동은
 * `KV_REST_API_*` 로 주입하는데 앱이 `UPSTASH_*` 만 읽어서, 대시보드에서는 연결됐는데
 * 앱에서는 "설정 없음" 으로 보였다. 그걸 다시 겪지 않도록 고정한다.
 */
describe("환경변수 이름 두 벌", () => {
  const URL = "https://example.upstash.io";
  const TOKEN = "x".repeat(40);

  it("Upstash 콘솔 이름을 받는다", () => {
    const lookup = resolveCounterStore({
      UPSTASH_REDIS_REST_URL: URL,
      UPSTASH_REDIS_REST_TOKEN: TOKEN,
    });
    expect(lookup).toMatchObject({ state: "configured", config: { url: URL, token: TOKEN } });
  });

  it("Vercel 마켓플레이스 이름(KV_REST_API_*)도 받는다", () => {
    const lookup = resolveCounterStore({ KV_REST_API_URL: URL, KV_REST_API_TOKEN: TOKEN });
    expect(lookup).toMatchObject({ state: "configured", config: { url: URL, token: TOKEN } });
  });

  /** 손으로 넣은 값이 자동 주입값을 덮어쓸 수 있어야 한다. */
  it("둘 다 있으면 UPSTASH_ 쪽이 이긴다", () => {
    const lookup = resolveCounterStore({
      UPSTASH_REDIS_REST_URL: URL,
      UPSTASH_REDIS_REST_TOKEN: TOKEN,
      KV_REST_API_URL: "https://other.upstash.io",
      KV_REST_API_TOKEN: "y".repeat(40),
    });
    expect(lookup).toMatchObject({ state: "configured", config: { url: URL, token: TOKEN } });
  });

  it("끝 슬래시를 떼어 낸다", () => {
    const lookup = resolveCounterStore({
      UPSTASH_REDIS_REST_URL: `${URL}//`,
      UPSTASH_REDIS_REST_TOKEN: TOKEN,
    });
    expect(lookup).toMatchObject({ state: "configured", config: { url: URL } });
  });

  it("아무것도 없으면 unset", () => {
    expect(resolveCounterStore({})).toEqual({ state: "unset" });
  });

  /** 한쪽만 있는 것은 "안 쓰기로 한 것" 이 아니라 설정 실수다 — 화면에서 구분해야 한다. */
  it("한쪽만 있으면 invalid 이고 들어온 이름을 알려준다", () => {
    expect(resolveCounterStore({ KV_REST_API_URL: URL })).toEqual({
      state: "invalid",
      names: ["KV_REST_API_URL"],
    });
  });

  it("값이 있어도 형식이 틀리면 invalid", () => {
    expect(
      resolveCounterStore({ UPSTASH_REDIS_REST_URL: "redis://x", UPSTASH_REDIS_REST_TOKEN: TOKEN }),
    ).toMatchObject({ state: "invalid" });
  });

  /** 진단용이라 이름만 나간다. 값이 섞이면 `/admin` 에 토큰이 찍힌다 (인증이 없는 화면이다). */
  it("invalid 응답에 값이 섞이지 않는다", () => {
    const lookup = resolveCounterStore({ KV_REST_API_TOKEN: TOKEN });
    expect(JSON.stringify(lookup)).not.toContain(TOKEN);
  });
});

describe("경계", () => {
  const source = readFileSync(new URL("./counters.ts", import.meta.url), "utf8");

  /** 클라이언트 컴포넌트에서 실수로 import 하면 빌드가 깨지도록 하는 안전장치다. */
  it("server-only 를 import 한다", () => {
    expect(source).toMatch(/^import "server-only";/m);
  });

  /**
   * 토큰은 시크릿이라 `lib/env.ts` 밖에서 읽지 않는다 (CLAUDE.md 보안 규칙).
   * 여기서 직접 읽기 시작하면 마스킹·검증이 두 벌이 된다.
   */
  it("process.env 를 직접 읽지 않는다", () => {
    expect(source).not.toMatch(/process\.env/);
  });
});
