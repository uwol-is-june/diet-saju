import { NextResponse } from "next/server";
import { EnvError } from "@/lib/env";
import { assertGeminiReady, streamText, toGeminiError } from "@/lib/gemini";
import { recordSajuRequest, startTimer, type SajuOutcome } from "@/lib/observability";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "@/lib/prompt";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { calculateSajuChart } from "@/lib/saju/pillars";
import { sajuInputSchema, type SajuStreamEvent } from "@/lib/saju/schema";

// lunar-javascript 가 CommonJS 이므로 Edge 대신 Node 런타임을 쓴다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 응답은 NDJSON 스트림이다 (한 줄에 이벤트 하나).
 *
 * 순서: chart → delta* → done
 *
 * ## 왜 원국을 먼저 보내는가
 *
 * 원국은 코드가 10ms 안에 계산한다. 반면 Gemini 의 첫 조각은 약 2.5초 뒤에 온다.
 * Gemini 응답을 기다려 상태 코드를 정하면 사용자는 자기 사주팔자를 보기까지
 * 2.5초를 기다려야 한다 — 이미 확정된 사실을 붙잡고 있는 셈이다.
 *
 * 그래서 원국을 즉시 보내고, **Gemini 실패는 200 안의 `error` 이벤트로** 알린다.
 * 상태 코드로 구분하지 못하는 대가를 치르지만, 원국은 LLM 실패와 무관하게 유효한
 * 결과이므로 사용자에게 보여주는 것이 맞다.
 *
 * 상태 코드가 필요한 실패는 스트림을 열기 **전에** 모두 걸러낸다.
 *  - 레이트 리밋 429 / 입력 검증 400 / 사주 계산 실패 400 / 서버 설정 오류 500
 *
 * ## 계측 (TASK-13)
 *
 * 모든 종료 경로가 `recordSajuRequest` 를 정확히 한 번 부른다. **상태 코드가 아니라
 * `SajuOutcome` 으로 집계하는 이유가 위 표에 있다** — Gemini 실패는 200 으로 나가므로
 * 상태 코드만 세면 실패율이 0 으로 보인다. 계측에는 개인정보를 싣지 않는다
 * (자세한 규칙은 `lib/observability.ts`).
 */
export async function POST(request: Request) {
  const elapsed = startTimer();

  /** 스트림 전 실패는 상태 코드와 결과를 함께 남긴다. */
  const failBefore = (
    outcome: SajuOutcome,
    message: string,
    status: number,
    headers: Record<string, string> = {},
  ) => {
    recordSajuRequest({ outcome, status, durationMs: elapsed() });
    return jsonError(message, status, headers);
  };

  // 1) 레이트 리밋
  const identifier = getClientIdentifier(request.headers);
  const limit = checkRateLimit(identifier);
  if (!limit.allowed) {
    return failBefore(
      "rate_limited",
      `요청이 너무 많습니다. ${limit.retryAfterSeconds}초 후 다시 시도해 주세요.`,
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  // 2) 입력 검증 — 클라이언트 검증은 신뢰하지 않는다.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failBefore("invalid_input", "요청 본문이 올바른 JSON 이 아닙니다.", 400);
  }

  const parsed = sajuInputSchema.safeParse(body);
  if (!parsed.success) {
    // 검증 메시지는 사용자에게 보내지만 **입력값 자체는 로그에 남기지 않는다.**
    return failBefore(
      "invalid_input",
      parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
      400,
    );
  }

  const input = parsed.data;
  // 계측에 실을 범주형 파생값. 생년월일·이름은 넣지 않는다.
  const shape = {
    readingType: input.readingType,
    timeUnknown: !input.birthTime,
    genderKnown: input.gender !== "unspecified",
  };

  // 3) 사주 계산(코드) — 즉시 끝난다
  let chart;
  try {
    chart = calculateSajuChart(input);
  } catch (error) {
    console.error("[api/saju] 사주 계산 실패:", error);
    recordSajuRequest({
      outcome: "chart_failed",
      status: 400,
      ...shape,
      durationMs: elapsed(),
    });
    return jsonError("사주를 계산하지 못했습니다. 입력을 확인해 주세요.", 400);
  }

  // 4) 서버 설정 확인 — API 는 부르지 않는다. 여기까지가 상태 코드로 응답할 수 있는 구간이다.
  let model: string;
  try {
    model = assertGeminiReady().model;
  } catch (error) {
    if (error instanceof EnvError) {
      console.error("[api/saju]", error.message);
      return failBefore(
        "config_error",
        "서버 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
        500,
      );
    }
    console.error("[api/saju] 예상치 못한 오류:", error);
    return failBefore("config_error", "알 수 없는 오류가 발생했습니다.", 500);
  }

  // 5) 여기서부터 200 이 확정이다. 이후 실패는 error 이벤트로 알린다.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SajuStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      // 원국을 먼저 보낸다 — 이미 계산이 끝난 사실이다.
      send({ type: "chart", chart, model });

      // 첫 글자까지 걸린 시간이 체감 속도를 결정한다. 첫 delta 에서 한 번만 찍는다.
      let ttfbMs: number | undefined;
      let chars = 0;

      try {
        for await (const text of streamText({
          systemInstruction: SYSTEM_INSTRUCTION,
          prompt: buildUserPrompt(input, chart),
        })) {
          ttfbMs ??= elapsed();
          chars += text.length;
          send({ type: "delta", text });
        }
        send({ type: "done" });
        recordSajuRequest({
          outcome: "ok",
          status: 200,
          model,
          ...shape,
          ttfbMs,
          chars,
          durationMs: elapsed(),
        });
      } catch (error) {
        // 부분 결과는 이미 클라이언트에 가 있다. 상태 코드는 못 바꾸므로 이벤트로 알린다.
        const failure = toGeminiError(error, "streamText");
        send({ type: "error", error: failure.message });
        // **상태는 200 이지만 실패다.** 상태 코드만 세면 이 건이 성공으로 집계된다.
        recordSajuRequest({
          outcome: "reading_failed",
          status: 200,
          model,
          failure: failure.kind,
          ...shape,
          ttfbMs,
          chars,
          durationMs: elapsed(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // 프록시가 스트림을 모아서 한 번에 보내지 않도록 한다.
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(message: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}
