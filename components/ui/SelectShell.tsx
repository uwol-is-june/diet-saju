/**
 * 드롭다운 화살표를 직접 그리기 위한 껍데기 (TASK-38 · TASK-101 에서 파일로 뺐다).
 *
 * **`select` 에는 `::after` 를 붙일 수 없어서** 감싸는 요소가 필요하다. 모양과 색은
 * `globals.css` 의 `.select-shell` 이 정한다 — 색을 이 파일에 적으면
 * `lib/design/tokens.test.ts` 의 raw 색상 검사에 걸린다.
 *
 * **`select` 를 그리는 곳이면 어디서든 이걸 쓴다.** 하나만 빠지면 그 칸만 브라우저 기본
 * 화살표가 남아 화면 안에 화살표가 두 종류가 된다 (실제로 넷만 감쌌을 때 그렇게 됐다).
 * `lib/form/birth-input.test.ts` 가 **select 를 그리는 파일 전부에서** `<select` 개수와
 * 껍데기 개수를 대조한다 — 그래서 이 부품이 `SajuForm` 안에 있으면 안 된다.
 * TASK-101 이 select 둘을 결과 화면으로 옮기면서 쓰는 파일이 둘이 됐다.
 */
export function SelectShell({ children }: { children: React.ReactNode }) {
  return <span className="select-shell">{children}</span>;
}
