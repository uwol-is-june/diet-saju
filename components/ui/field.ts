/**
 * 입력 껍데기 규격 (TASK-75 · dasii 규격).
 *
 * 높이 48px · radius 12px · 좌우 여백 16px. `Button` 과 같은 값이라 폼 안에서
 * 입력과 버튼의 밑선·모서리가 맞는다.
 *
 * ## 왜 컴포넌트가 아니라 클래스 문자열인가
 *
 * 이 규격을 쓰는 것은 `input` · `select` · native `date` 셋인데 **셋 다 요구가 다르다** —
 * date 는 값이 없을 때 글자색을 낮춰야 하고(TASK-22), select 는 `.select-shell` 이
 * 감싸야 하며(TASK-38), 그 껍데기는 개수까지 테스트가 대조한다. 이걸 한 컴포넌트로
 * 감싸면 그 세 사정이 전부 prop 으로 새어 나온다. **규격만 한 곳에 두고 조립은 폼이 한다.**
 *
 * `SajuForm` 에 이미 있는 `Field` 는 **라벨 + 자식**을 감싸는 다른 물건이라 이름을
 * 나눴다. 그쪽을 이 파일로 옮기지 말 것 — 라벨 배치는 폼의 사정이다.
 *
 * ## `SelectShell` 을 여기로 흡수하지 않는다
 *
 * 화살표를 그리는 규칙은 `globals.css` 의 `.select-shell` 하나이고,
 * `lib/form/birth-input.test.ts` 가 `<select` 개수와 껍데기 개수를 **대조한다.**
 * 새 껍데기를 만들면 그 검사가 세는 대상이 갈린다.
 */

/**
 * `text-base sm:text-sm` 인 이유: iOS Safari 는 글자 크기가 16px 미만인 입력에 포커스가
 * 가면 화면을 확대한다. 확대되면 되돌아오지 않아 이후 입력이 전부 불편해진다.
 * 데스크톱에서는 14px 로 되돌린다.
 *
 * 높이는 `min-h-12`(48px)다. 예전 `min-h-11`(44px)은 **터치 타깃 최소 크기**였으므로
 * 올리는 것은 안전하다 — 다만 이 폼은 드롭다운이 여섯 줄이라 **폼 전체가 세로로
 * 길어진다.** 줄일 때는 44px 아래로 내려가지 않는지 볼 것.
 */
export const FIELD_BASE =
  "min-h-12 w-full rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-base transition placeholder:text-ink-placeholder focus:border-brand-hover sm:text-sm";
