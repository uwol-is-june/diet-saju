/**
 * `<ViewTransition>` 의 타입을 켠다 (TASK-96).
 *
 * 앱 라우터는 React canary 채널로 돈다 — `next/dist/compiled/react` 에 `ViewTransition`
 * 이 실제로 들어 있다(react-server 빌드에도 있다). 그런데 **타입만 따로 논다**:
 * `@types/react` 는 canary 선언을 `react/canary` 라는 별도 진입점에 숨겨 두고,
 * `next-env.d.ts` 는 그것을 참조하지 않는다. 그래서 런타임에는 되는데 `tsc` 만 모른다.
 *
 * 이 한 줄이 그 선언을 끌어온다. **`@types/react` 를 올릴 때 함께 볼 것** — canary 것이
 * 정식 채널로 들어오면 이 파일은 필요 없어진다.
 */
/// <reference types="react/canary" />
