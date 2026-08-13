import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getRuntimeConfig, getSecrets } from "./env";

/**
 * Gemini 호출 지점. 이 파일과 lib/env.ts 밖에서 GEMINI_API_KEY 를 읽지 않는다.
 * 클라이언트 컴포넌트에서 import 하면 server-only 가 빌드를 막는다.
 */

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getSecrets().GEMINI_API_KEY });
  }
  return client;
}

export class GeminiError extends Error {
  readonly name = "GeminiError";
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
  }
}

export interface GenerateOptions {
  systemInstruction: string;
  prompt: string;
  /** 기본 0.9 — 해석문이라 약간 높게 둔다. */
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * 추론(thinking) 예산. 기본 MINIMAL.
   *
   * 사주 해석은 이미 계산된 사실을 서술하는 작업이라 깊은 추론이 필요하지 않다.
   * 실측(gemini-3.5-flash): MINIMAL 6.9s / LOW 12.6s / MEDIUM 11.4s.
   * Vercel 함수 타임아웃(maxDuration=30)을 지키려면 MINIMAL 이 안전하다.
   */
  thinkingLevel?: ThinkingLevel;
}

/**
 * 호출 준비가 됐는지 확인한다 (API 는 부르지 않는다).
 *
 * 키 누락 같은 **서버 설정 오류는 500 이어야** 하므로, 스트림을 열기 전에 여기서 걸러낸다.
 * 스트림이 시작된 뒤에는 상태 코드를 바꿀 수 없다.
 */
export function assertGeminiReady(): { model: string } {
  const { GEMINI_MODEL } = getRuntimeConfig();
  getClient(); // 키가 없으면 EnvError
  return { model: GEMINI_MODEL };
}

/**
 * 스트리밍 생성. 텍스트 조각을 순서대로 내보낸다.
 *
 * 실패는 예외로 던져진다. 호출자는 그때까지 받은 부분 결과를 살리고 에러를 알린다.
 * 첫 조각조차 오지 않은 실패(쿼터 소진 등)도 마찬가지다 — 원국을 먼저 보내기 위해
 * 응답을 이미 시작한 상태이기 때문이다. 자세한 배경은 app/api/saju/route.ts 참고.
 */
export async function* streamText(options: GenerateOptions): AsyncGenerator<string> {
  const { GEMINI_MODEL } = getRuntimeConfig();
  const ai = getClient();

  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: options.prompt,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature ?? 0.9,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
      thinkingConfig: {
        thinkingLevel: options.thinkingLevel ?? ThinkingLevel.MINIMAL,
      },
    },
  });

  let produced = false;
  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      produced = true;
      yield text;
    }
  }

  if (!produced) {
    throw new GeminiError("모델이 빈 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * SDK 예외를 사용자에게 보여줄 수 있는 형태로 정규화한다.
 * 원문에는 요청 정보가 섞일 수 있으므로 서버 로그에만 남긴다.
 */
export function toGeminiError(error: unknown, context: string): GeminiError {
  if (error instanceof GeminiError) return error;

  const raw = toSafeLogMessage(error);
  console.error(`[gemini] ${context} failed:`, raw);

  const status = extractStatus(error);

  if (status === 429 || raw.includes("RESOURCE_EXHAUSTED")) {
    // 분당 한도와 일일 한도는 대응이 다르다. "1분 후 다시" 는 일일 소진 때 거짓말이 된다.
    // Google 은 quotaId 에 PerDay / PerMinute 를 담아 준다.
    const isDailyQuota = raw.includes("PerDay");
    return new GeminiError(
      isDailyQuota
        ? "오늘 사용 가능한 무료 사용량을 모두 소진했습니다. 내일 다시 시도해 주세요."
        : "요청이 몰리고 있습니다. 1분 후 다시 시도해 주세요.",
      429,
    );
  }
  // Google 은 잘못된 키에 대해 401 이 아니라 400 INVALID_ARGUMENT/API_KEY_INVALID 를 준다.
  if (status === 401 || status === 403 || raw.includes("API_KEY_INVALID")) {
    return new GeminiError("API 키 인증에 실패했습니다. 서버 설정을 확인해 주세요.", 500);
  }
  if (raw.includes("SAFETY") || raw.includes("blocked")) {
    return new GeminiError(
      "생성이 안전 정책으로 차단되었습니다. 입력을 바꿔 다시 시도해 주세요.",
      422,
    );
  }
  return new GeminiError("사주 풀이 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
}

/** 로그에 API 키가 섞여 들어가는 것을 막는다. */
function toSafeLogMessage(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const key = process.env.GEMINI_API_KEY;
  return key ? raw.replaceAll(key, "[REDACTED]") : raw;
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.code === "number") return candidate.code;
  return undefined;
}
