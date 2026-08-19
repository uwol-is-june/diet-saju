/**
 * 본문 강조 (TASK-65).
 *
 * 풀이에서 어디가 핵심인지 눈에 걸리게 한다. 강조를 만드는 주체는 **둘**이다.
 *
 * 1. **프롬프트** — 어디가 핵심인지 아는 것은 문장을 쓰는 쪽뿐이라 이쪽이 본류다.
 *    `SYSTEM_INSTRUCTION` 이 절마다 한두 곳까지로 상한을 준다.
 * 2. **코드** — 이 파일. 하지만 코드가 아는 것은 **판정 라벨뿐**이다. 라벨은 `constitution.ts`
 *    등이 정한 값이라 매번 같은 자리에서 확실히 굵어진다.
 *
 * 스타일은 `globals.css` 의 `.reading strong` 이 이미 정한다 — 굵기 600 + 본문(`ink-soft`)보다
 * 진한 `ink`. **색을 따로 주지 않는다.** `brand-ink` 를 얹으면 강조가 링크처럼 읽힌다.
 */

import type { SajuChart } from "@/lib/saju/schema";

/** 마크다운 강조 표시. 두 글자라 문자열 길이 계산이 자주 필요하다. */
const MARK = "**";

/**
 * 이 풀이에서 굵게 만들 판정 라벨을 모은다.
 *
 * **유형별로 나누지 않는다.** 라벨이 본문에 없으면 아무 일도 일어나지 않으므로, 유형마다
 * 목록을 따로 두면 `Record` 하나를 더 유지하면서 얻는 것이 없다. 반대로 유형이 늘 때
 * 목록을 빠뜨리면 그 유형만 조용히 강조가 사라진다.
 *
 * **긴 것부터 본다.** 짧은 라벨이 긴 라벨의 일부인 경우(예: 패턴 이름이 다른 문구에 포함)
 * 짧은 쪽이 먼저 걸리면 긴 쪽이 영영 잡히지 않는다.
 */
export function collectVerdictLabels(chart: SajuChart): string[] {
  const { constitution } = chart;
  const labels = [
    constitution.thermal,
    constitution.metabolism,
    constitution.gainPattern,
    constitution.gainLabel,
    constitution.gainSite,
    constitution.dietApproach,
    constitution.movementKind,
    constitution.movementPrimary,
    chart.yearly?.effect,
    chart.decade?.current.effect,
    chart.decade?.shift,
  ].filter(
    (label): label is string => typeof label === "string" && label.length > 1,
  );

  return [...new Set(labels)].sort((a, b) => b.length - a.length);
}

/**
 * 아직 닫히지 않은 `**` 를 지운다.
 *
 * 스트리밍 중에는 `**식욕형` 까지만 도착한 순간이 반드시 있고, 그때 `react-markdown` 은
 * 별표를 **글자 그대로** 그린다. 섹션 파서가 해시만 도착한 마지막 줄을 보류하는 것과 같은
 * 종류의 문제다 (`sections.ts`).
 *
 * **뒤 내용을 감추지 않고 표시만 지운다.** 감추면 쓰이고 있는 글이 사라졌다 나타난다.
 * 닫는 표시가 도착하면 그 구간이 굵어진다.
 */
export function dropUnclosedEmphasis(markdown: string): string {
  let count = 0;
  let last = -1;
  for (let i = 0; i + 1 < markdown.length; i += 1) {
    if (markdown[i] === "*" && markdown[i + 1] === "*") {
      count += 1;
      last = i;
      i += 1; // 표시 하나는 두 글자다. `***` 를 두 번 세지 않는다.
    }
  }
  if (count % 2 === 0) return markdown;
  return markdown.slice(0, last) + markdown.slice(last + MARK.length);
}

/**
 * 판정 라벨의 **첫 등장만** 굵게 만든다.
 *
 * - **모두 감싸지 않는다.** 라벨은 한 절에서 여러 번 나오므로 전부 굵히면 문단이 굵은 글자로
 *   뒤덮여 아무것도 강조되지 않는다.
 * - **이미 굵은 구간은 건드리지 않는다.** 모델이 스스로 감싼 라벨을 다시 감싸면 `****` 가
 *   되어 강조가 깨진다. 그래서 `**` 바깥 구간에서만 찾는다.
 * - **`#` 로 시작하는 줄은 건너뛴다.** 계약 제목은 파서가 이미 떼어 내지만 `###` 소제목은
 *   본문에 남아 있고, 제목 안에서 굵기를 바꾸면 제목 크기가 흔들려 보인다.
 */
export function emphasizeVerdictLabels(
  markdown: string,
  labels: readonly string[],
): string {
  if (labels.length === 0) return markdown;
  const remaining = new Set(labels);

  // `**` 를 경계로 잘라 홀수 번째 조각(= 강조 안쪽)은 그대로 두고 바깥만 손댄다.
  const parts = markdown.split(MARK);
  for (let i = 0; i < parts.length; i += 2) {
    if (remaining.size === 0) break;
    parts[i] = parts[i]!.split("\n")
      .map((line) => {
        if (line.trimStart().startsWith("#")) return line;
        for (const label of labels) {
          if (!remaining.has(label)) continue;
          const at = line.indexOf(label);
          if (at === -1) continue;
          remaining.delete(label);
          return `${line.slice(0, at)}${MARK}${label}${MARK}${line.slice(at + label.length)}`;
        }
        return line;
      })
      .join("\n");
  }
  return parts.join(MARK);
}
