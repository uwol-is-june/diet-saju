import "server-only";
import { getRuntimeConfig } from "./env";

/**
 * 인메모리 슬라이딩 윈도우 레이트 리미터.
 *
 * 목적: Gemini 무료 등급 한도(분당 요청 수)를 우리 쪽에서 먼저 막는 것.
 *
 * 한계: Vercel 서버리스는 인스턴스마다 메모리가 분리되므로 전역 한도가 아니다.
 * 트래픽이 붙으면 Upstash Redis 로 교체할 것 (docs/TASK.md TASK-07).
 */

const WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  const limit = getRuntimeConfig().RATE_LIMIT_PER_MINUTE;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const recent = (buckets.get(identifier) ?? []).filter((t) => t > windowStart);

  if (recent.length >= limit) {
    const oldest = recent[0]!;
    buckets.set(identifier, recent);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
    };
  }

  recent.push(now);
  buckets.set(identifier, recent);

  // 메모리 누수 방지: 버킷이 많아지면 만료된 것부터 정리한다.
  if (buckets.size > 5_000) {
    for (const [key, timestamps] of buckets) {
      if (timestamps.every((t) => t <= windowStart)) buckets.delete(key);
    }
  }

  return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
}

/** 프록시 뒤(Vercel)에서 클라이언트 IP 를 얻는다. 실패 시 공용 버킷으로 묶는다. */
export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
