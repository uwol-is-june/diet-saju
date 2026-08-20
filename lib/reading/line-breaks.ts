/**
 * 문장 묶음 단위 줄바꿈. 본문이 벽처럼 읽히는 것과 한 문장짜리 문단이 목록처럼 읽히는 것
 * **사이**를 잡는다 — 문장 경계에서 가르되 덩어리가 일정 길이를 넘었을 때만 가른다.
 *
 * **프롬프트로 풀 수 없다.** `react-markdown` 은 CommonMark 라 단일 개행을 줄바꿈으로
 * 렌더하지 않으므로 모델이 개행을 넣어도 화면은 그대로다. 형식은 **렌더 직전에 코드가**
 * 만들고, 그래서 모델이 어떻게 쓰든 같은 모양이 나온다.
 *
 * **`<br>`(hard break)이 아니라 문단이다.** 줄 간격이 본문과 같으면 모바일에서 한 문장이
 * 여러 줄로 접히는 순간 경계가 사라진다(390px 에서 한국어 한 문장은 보통 두세 줄이다).
 *
 * **묶는 규칙은 길이 문턱 하나다.** 규칙 하나로 둘이 함께 풀린다 — 모델이 이미 넣은 문단
 * 경계가 살고(변환이 줄 단위라 빈 줄을 넘지 않는다), 긴 문단만 갈린다.
 *
 * **문장 수로 세지 않는다** — 같은 두 문장이라도 길이가 세 배씩 흔들린다. 읽는 사람이
 * 느끼는 것은 문장 수가 아니라 줄 수다.
 *
 * **마침표가 문장 끝이 아닌 자리**(`3.5kg` · `1. 항목` · `e.g.`)는 종결 부호 **앞 글자가
 * 한글이거나 닫는 괄호·따옴표일 때만** 가르는 것으로 걸러진다 — 예외 목록이 필요 없다.
 *
 * **스트리밍 중에 줄이 튀지 않는다.** 종결 부호 뒤에 공백과 다음 글자가 모두 도착했을
 * 때만 가르고, **왼쪽부터 훑는 그리디**라 뒤에 글이 붙어도 이미 내린 결정이 바뀌지 않는다.
 * (균등 분할이었다면 마지막 문장이 도착할 때마다 앞쪽 경계가 움직여 읽던 자리가 튄다.)
 */

/** 코드 울타리. 모델이 쓸 일은 없지만 들어오면 안쪽을 건드리지 않는다. */
const FENCE = /^\s*(?:```|~~~)/;

/**
 * 문장을 가르지 않는 줄 — 제목, 목록 항목, 인용, 표.
 * 목록 줄을 가르면 항목 하나가 여러 문단으로 쪼개져 목록 구조가 깨진다.
 */
const STRUCTURAL_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||:?-{3,})/;

/**
 * 종결 부호 + 공백 + 다음 글자.
 *
 * 앞 글자를 `[가-힣]` 과 닫는 괄호·따옴표로 한정해 `3.5` · `1. 항목` · `e.g.` 를 피한다.
 * 종결 부호를 `+` 로 받는 것은 `…?!` 처럼 겹쳐 쓰는 경우 때문이다.
 */
const SENTENCE_END = /([가-힣)\]』」”’"'])([.!?]+)[ \t]+(?=\S)/g;

/**
 * 한 덩어리의 길이 문턱(글자). **우리 관례이고 근거는 390px 실측이다** — 이 폭에서 한 줄이
 * 24자 안팎, 풀이 한 문장이 50~65자라 문턱 80이면 덩어리가 대개 두 문장 · 4~5줄이 된다.
 * 내리면 한 문장짜리 문단이 섞이고 올리면 벽이 돌아온다.
 *
 * 이 값을 넘긴 뒤 처음 만나는 문장 끝에서 가르므로 실제 덩어리는 문턱보다 길어질 수 있고
 * (문장을 쪼개지 않는다) 짧아지지는 않는다.
 */
const CHUNK_MIN_CHARS = 80;

/** 문단 사이 빈 줄이 셋 이상 겹치면 하나로 줄인다 (모델이 이미 넣은 것과 겹칠 수 있다). */
const EXTRA_BLANK_LINES = /\n{3,}/g;

/**
 * 한 줄(= 모델이 낸 문단 하나)을 문장 묶음으로 가른다.
 *
 * 왼쪽부터 그리디로 훑는다 — 쌓인 길이가 문턱을 넘은 뒤 처음 만나는 문장 끝이 경계다.
 */
function chunkLine(line: string): string {
  SENTENCE_END.lastIndex = 0;

  let result = "";
  let chunkStart = 0;
  let match: RegExpExecArray | null;

  while ((match = SENTENCE_END.exec(line)) !== null) {
    // 문장이 끝나는 자리 = 종결 부호 뒤. 뒤따르는 공백은 경계가 되면 버린다.
    const sentenceEnd = match.index + match[1].length + match[2].length;
    if (sentenceEnd - chunkStart < CHUNK_MIN_CHARS) continue;

    result += `${line.slice(chunkStart, sentenceEnd)}\n\n`;
    chunkStart = match.index + match[0].length;
  }

  return result + line.slice(chunkStart);
}

/**
 * 마크다운 본문을 문장 묶음 단위로 끊는다.
 *
 * 순수 함수이고 클라이언트에서 import 되므로 `server-only` 를 붙이지 않는다
 * (`lib/reading/sections.ts` 와 같은 이유).
 */
export function breakSentences(markdown: string): string {
  if (!markdown) return markdown;

  let inFence = false;
  const lines = markdown.split("\n").map((line) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence || STRUCTURAL_LINE.test(line)) return line;
    return chunkLine(line);
  });

  return lines.join("\n").replace(EXTRA_BLANK_LINES, "\n\n");
}
