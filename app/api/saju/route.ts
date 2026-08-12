import { NextResponse } from "next/server";
import { EnvError } from "@/lib/env";
import { GeminiError, generateText } from "@/lib/gemini";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "@/lib/prompt";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { calculateSajuChart } from "@/lib/saju/pillars";
import { sajuInputSchema, type SajuReadingResponse } from "@/lib/saju/schema";

// lunar-javascript 가 CommonJS 이므로 Edge 대신 Node 런타임을 쓴다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  // 1) 레이트 리밋 (env 미설정이면 여기서 EnvError → 500)
  try {
    const identifier = getClientIdentifier(request.headers);
    const limit = checkRateLimit(identifier);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `요청이 너무 많습니다. ${limit.retryAfterSeconds}초 후 다시 시도해 주세요.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    return handleServerError(error);
  }

  // 2) 입력 검증 — 클라이언트 검증은 신뢰하지 않는다.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바른 JSON 이 아닙니다." }, { status: 400 });
  }

  const parsed = sajuInputSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "입력값을 확인해 주세요." },
      { status: 400 },
    );
  }

  // 3) 사주 계산(코드) → 해석(LLM)
  try {
    const chart = calculateSajuChart(parsed.data);
    const { text, model } = await generateText({
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: buildUserPrompt(parsed.data, chart),
    });

    const payload: SajuReadingResponse = { chart, reading: text, model };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleServerError(error);
  }
}

function handleServerError(error: unknown) {
  if (error instanceof GeminiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof EnvError) {
    // 서버 설정 문제. 상세 내용은 서버 로그에만 남긴다.
    console.error("[api/saju]", error.message);
    return NextResponse.json(
      { error: "서버 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요." },
      { status: 500 },
    );
  }
  console.error("[api/saju] unexpected error:", error);
  return NextResponse.json({ error: "알 수 없는 오류가 발생했습니다." }, { status: 500 });
}
