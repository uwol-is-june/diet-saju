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

/**
 * 실패 종류 — 사용자 문구와 지표를 **같은 분류에서** 만든다.
 *
 * 두 곳에서 따로 판별하면 반드시 어긋난다. 특히 일일/분당 쿼터 구분은 사용자에게
 * "내일 다시" 냐 "1분 후 다시" 냐로 나가므로 틀리면 거짓말이 된다.
 */
export type GeminiFailureKind =
  | "quota_day"
  | "quota_minute"
  | "auth"
  | "safety"
  | "empty"
  | "unknown";

export class GeminiError extends Error {
  readonly name = "GeminiError";
  constructor(
    message: string,
    readonly status: number = 502,
    readonly kind: GeminiFailureKind = "unknown",
  ) {
    super(message);
  }
}

export interface GenerateOptions {
  systemInstruction: string;
  prompt: string;
  /**
   * 기본 0.9 — 해석문이라 약간 높게 둔다. **낮춰도 일관성을 얻지 못한다**(0.6 과 대조한
   * 실측 결론이다). 변동은 온도가 아니라 자유 서술이라는 과제 성격에서 온다.
   * **같은 입력에 같은 문장이 필요하면 온도가 아니라 캐싱으로 푼다.**
   */
  temperature?: number;
  /**
   * 출력 토큰 상한. 한국어는 출력 토큰 1개당 약 1.7자라 4096 이 약 6,900자를 담는다.
   *
   * **추론 토큰이 이 예산을 함께 쓴다.** 예산이 마르면 본문이 문장 중간에서 잘리는데
   * **그때도 스트림이 `error` 가 아니라 `done` 으로 끝난다** — 잘린 글이 성공으로
   * 보고된다. **추론을 켜는 변경에는 이 상한을 함께 올려야 한다.**
   */
  maxOutputTokens?: number;
  /**
   * 추론(thinking) 예산. **MINIMAL 고정.**
   *
   * **lite 에서 MINIMAL·LOW·MEDIUM 은 같은 설정이다** (추론 토큰이 0 이고 필드 자체가
   * 오지 않는다). 실제 선택지는 MINIMAL 과 HIGH 뿐이고 HIGH 는 셋 때문에 탈락했다:
   *
   * 1. **첫 글자가 8~10배 늦다** — 원국을 먼저 보내고 스트리밍하는 설계 전체가 첫 글자
   *    1초를 위한 것이다.
   * 2. **추론 내용이 본문으로 샜다** — 섹션 계약이 깨져 사용자가 모델의 메모를 읽는다.
   * 3. **본문이 잘린다** — 위 `maxOutputTokens` 주석 참고.
   *
   * 서술이 좋아지지도 않았다. **밋밋함은 추론 예산에서 오지 않는다.**
   * **수치를 적을 때는 모델명과 측정일을 함께 적을 것.**
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
 * 스트리밍 생성. 실패는 예외로 던져지고 호출자가 그때까지 받은 부분 결과를 살린다 —
 * 첫 조각조차 오지 않은 실패도 마찬가지다(원국을 먼저 보내려 응답을 이미 시작했다).
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
    throw new GeminiError(
      "모델이 빈 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.",
      502,
      "empty",
    );
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
      isDailyQuota ? "quota_day" : "quota_minute",
    );
  }
  // Google 은 잘못된 키에 대해 401 이 아니라 400 INVALID_ARGUMENT/API_KEY_INVALID 를 준다.
  if (status === 401 || status === 403 || raw.includes("API_KEY_INVALID")) {
    return new GeminiError(
      "API 키 인증에 실패했습니다. 서버 설정을 확인해 주세요.",
      500,
      "auth",
    );
  }
  if (raw.includes("SAFETY") || raw.includes("blocked")) {
    return new GeminiError(
      "생성이 안전 정책으로 차단되었습니다. 입력을 바꿔 다시 시도해 주세요.",
      422,
      "safety",
    );
  }
  return new GeminiError(
    "사주 풀이 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    502,
    "unknown",
  );
}

/** 로그에 API 키가 섞여 들어가는 것을 막는다. */
export function toSafeLogMessage(error: unknown): string {
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
