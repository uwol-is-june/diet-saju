/**
 * 라벨 + 컨트롤 한 묶음 (TASK-101 에서 `SajuForm` 밖으로 뺐다).
 *
 * `htmlFor` 를 주면 `label`, 라디오 그룹처럼 연결할 컨트롤이 없으면 `labelId` 를 주고
 * `span` 으로 낸다 (`aria-labelledby` 가 그 id 를 가리킨다).
 *
 * **파일 이름이 `Field.tsx` 가 아닌 이유는 `field.ts` 와 대소문자만 다르기 때문이다.**
 * 윈도우·맥 파일 시스템에서 두 이름이 같은 파일로 취급돼 `tsc` 가 TS1149 로 멈춘다
 * (실제로 겪었다). 둘을 한 파일로 합치지도 않았다 — 그쪽은 JSX 가 없는 `.ts` 이고
 * 규격 문자열만 든다.
 *
 * **규격은 `field.ts` 의 `FIELD_BASE` 와 짝이다** — 그쪽이 컨트롤의 높이·radius 를,
 * 이쪽이 그 위 라벨을 정한다. 라벨 클래스를 호출부에 다시 적지 말 것: 폼과 결과 화면
 * 두 곳에서 쓰이므로 문자열이 갈리면 같은 종류의 줄이 서로 달라 보인다.
 */
export const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-ink-soft";

export function Field({
  label,
  htmlFor,
  labelId,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={LABEL_CLASS}>
          {label}
        </label>
      ) : (
        <span id={labelId} className={LABEL_CLASS}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
