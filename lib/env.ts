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

/** 디버깅용. 앞 4자리만 남기고 마스킹한다. 전체 키는 어디에도 출력하지 않는다. */
export function maskedApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "(unset)";
  return `${key.slice(0, 4)}${"*".repeat(8)}(len:${key.length})`;
}
