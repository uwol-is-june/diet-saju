import "server-only";
import { z } from "zod";

/**
 * 서버 전용 환경변수 접근 지점.
 *
 * 규칙
 * 1. 이 모듈은 `server-only` 를 import 하므로 클라이언트 컴포넌트에서 import 하면 빌드가 깨진다.
 *    (= 키가 브라우저 번들에 섞여 들어가는 사고를 컴파일 타임에 막는다)
 * 2. 검증은 import 시점이 아니라 최초 호출 시점(lazy)에 한다.
 *    키가 없는 환경에서도 `next build` 는 성공해야 하기 때문이다.
 * 3. 시크릿(getSecrets)과 일반 설정(getRuntimeConfig)을 분리한다.
 *    레이트 리밋 같은 앞단 로직이 "키 없음" 때문에 먼저 터지면 안 된다.
 * 4. 원본 키 값을 로그/응답/에러 메시지에 절대 넣지 않는다. 필요하면 maskedApiKey() 를 쓴다.
 */

export class EnvError extends Error {
  readonly name = "EnvError";
}

// ── 시크릿 (키가 반드시 필요한 지점에서만 호출) ────────────────────────────
const secretsSchema = z.object({
  GEMINI_API_KEY: z
    .string()
    .min(20, "GEMINI_API_KEY 형식이 올바르지 않습니다 (너무 짧음)"),
});

let cachedSecrets: z.infer<typeof secretsSchema> | null = null;

export function getSecrets(): z.infer<typeof secretsSchema> {
  if (cachedSecrets) return cachedSecrets;

  const parsed = secretsSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });

  if (!parsed.success) {
    // 필드명만 노출한다. 값은 절대 포함하지 않는다.
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
    throw new EnvError(
      `환경변수 설정이 필요합니다: ${fields}. .env.example 을 참고해 .env.local 을 채우거나 Vercel 환경변수를 등록하세요.`,
    );
  }

  cachedSecrets = parsed.data;
  return cachedSecrets;
}

// ── 일반 설정 (없으면 기본값으로 동작) ─────────────────────────────────────
const runtimeConfigSchema = z.object({
  // 무료 등급 일일 한도(RPD)가 모델마다 25배까지 차이난다.
  // Flash Lite 계열만 500 RPD 이고 나머지 Flash 는 20 RPD 다. 근거는 CLAUDE.md 참고.
  // gemini-2.5-* 는 신규 API 키에 제공되지 않는다 (404 NOT_FOUND).
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = runtimeConfigSchema.safeParse({
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE || undefined,
  });

  // 잘못된 값이면 서버 로그에 남기고 기본값으로 계속 간다 (서비스 중단 방지).
  if (!parsed.success) {
    console.error(
      "[env] 잘못된 런타임 설정, 기본값으로 대체:",
      Object.keys(parsed.error.flatten().fieldErrors).join(", "),
    );
    cachedConfig = runtimeConfigSchema.parse({});
    return cachedConfig;
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

// ── 카운터 저장소 (있으면 켜지고 없으면 꺼진다) ────────────────────────────
/**
 * 유형별 조회수·좋아요 카운터가 쓰는 Upstash Redis 자격증명 (TASK-51).
 *
 * **위 둘 중 어느 갈래도 아닌 세 번째다.**
 *  - `getSecrets` 처럼 던지면 안 된다 — 저장소가 없다고 페이지가 죽으면 계측이 요청을
 *    깨뜨리는 것이다. `lib/observability.ts` 의 `emit` 이 어떤 예외도 밖으로 내보내지
 *    않는 것과 같은 원칙이다.
 *  - `getRuntimeConfig` 처럼 기본값을 줄 수도 없다 — 시크릿에 기본값이란 없다.
 *
 * 그래서 **없으면 `null`** 이고, 부르는 쪽이 "카운터 없음" 상태로 다룬다. 값이 들어오는
 * 순간 저절로 켜진다.
 *
 * 토큰은 시크릿이다. **이 파일 밖에서 `process.env` 로 직접 읽지 말 것** (CLAUDE.md 보안 규칙).
 */
export type CounterStoreConfig = { readonly url: string; readonly token: string };

/**
 * **이름이 두 벌이다.** Vercel 마켓플레이스에서 Upstash Redis 를 연결하면 `KV_REST_API_*`
 * 로 주입되고(옛 Vercel KV 시절 이름), Upstash 콘솔에서 직접 받으면 `UPSTASH_REDIS_REST_*`
 * 다. 둘 다 받는다 — 한쪽만 읽으면 대시보드에서 분명히 연결했는데 앱에서는 "설정 없음"
 * 으로 보이고, 그 사실이 화면 어디에도 안 나와서 원인을 찾는 데 배포 한 번을 쓴다.
 *
 * 앞에 적은 이름이 이긴다. 손으로 넣은 값이 자동 주입값을 덮어쓸 수 있어야 한다.
 */
const URL_VARS = ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"] as const;
const TOKEN_VARS = ["UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"] as const;

export type CounterStoreLookup =
  | { readonly state: "configured"; readonly config: CounterStoreConfig; readonly names: readonly string[] }
  /** 아무 이름도 없다 — 안 쓰기로 한 것이라 정상 상태다. */
  | { readonly state: "unset" }
  /** 한쪽만 있거나 형식이 틀리다 — 설정 실수다. 어떤 이름이 있었는지 함께 돌려준다. */
  | { readonly state: "invalid"; readonly names: readonly string[] };

const counterStoreSchema = z.object({
  url: z.string().startsWith("https://"),
  token: z.string().min(20),
});

/**
 * 순수 함수라 테스트가 직접 부른다 — `process.env` 를 건드리면 아래 캐시와 얽힌다.
 *
 * **이름만 돌려주고 값은 돌려주지 않는다**(`names`). 진단에 필요한 것은 "어느 이름이
 * 들어와 있나" 이지 값이 아니다.
 */
export function resolveCounterStore(env: Record<string, string | undefined>): CounterStoreLookup {
  const pick = (names: readonly string[]) => names.find((name) => env[name]?.trim());
  const urlName = pick(URL_VARS);
  const tokenName = pick(TOKEN_VARS);
  const names = [urlName, tokenName].filter((name): name is string => name !== undefined);

  if (!urlName && !tokenName) return { state: "unset" };

  const parsed = counterStoreSchema.safeParse({
    url: urlName ? env[urlName]?.trim() : undefined,
    token: tokenName ? env[tokenName]?.trim() : undefined,
  });
  if (!parsed.success) return { state: "invalid", names };

  return {
    state: "configured",
    // 끝 슬래시가 남으면 경로를 붙일 때 `//` 가 된다.
    config: { url: parsed.data.url.replace(/\/+$/, ""), token: parsed.data.token },
    names,
  };
}

/** 조회는 요청마다 일어나므로 결과를 캐시한다. "아직 안 봄" 을 `undefined` 로 구분한다. */
let cachedCounterStore: CounterStoreLookup | undefined;

export function getCounterStore(): CounterStoreLookup {
  if (cachedCounterStore !== undefined) return cachedCounterStore;

  const lookup = resolveCounterStore(process.env);
  // 설정 실수는 서버 로그에도 남긴다. 이름만 남기고 값은 절대 남기지 않는다.
  if (lookup.state === "invalid") {
    console.error(
      "[env] 카운터 저장소 설정이 올바르지 않아 카운터를 끕니다. 들어온 변수:",
      lookup.names.join(", ") || "(없음)",
    );
  }

  cachedCounterStore = lookup;
  return lookup;
}

/** 디버깅용. 앞 4자리만 남기고 마스킹한다. 전체 키는 어디에도 출력하지 않는다. */
export function maskedApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "(unset)";
  return `${key.slice(0, 4)}${"*".repeat(8)}(len:${key.length})`;
}
