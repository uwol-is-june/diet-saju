# 화면 규칙 (components · app)

`app/` 아래 화면이나 `app/globals.css` 를 고칠 때도 이 파일을 읽는다.
전체 구조·경계는 루트 `CLAUDE.md`, 판정·프롬프트는 `lib/CLAUDE.md`.

## 모바일이 기본값

주 사용자는 모바일이다. **좁은 화면이 기본이고 넓은 화면이 파생**이다 (Tailwind `sm:` 를 파생으로 쓴다).
기준 폭은 **390px**. 레퍼런스는 `docs/ui_ref/`.

```bash
npm run dev                                                              # 다른 터미널에서
node scripts/screenshot.mjs http://localhost:3000/ out.png --full        # 기본 390×844 · DPR 2
node scripts/screenshot.mjs http://localhost:3000/ out.png --width 1280 --dpr 1 --desktop
node scripts/measure-load.mjs http://localhost:3100/                     # FCP·LCP (프로덕션 빌드로 잰다)
```

- **`chrome --headless --window-size=...` 로 재지 말 것.** PNG 만 잘리고 레이아웃 뷰포트는 넓게 잡힌다.
  진짜 모바일 폭은 CDP 의 `Emulation.setDeviceMetricsOverride` 로만 만들어진다.
- 한 화면에 맞추는 구성에는 `dvh` 를 쓴다. 하단 고정 요소에는 `env(safe-area-inset-bottom)`.
- **다크 모드는 도입하지 않는다.**

### 받지 않는 것

햄버거 메뉴 · 전역 헤더 · 하단 탭바 · 유형 아이콘 줄 · 유형별 캐릭터 · 유형별 전면 배경 테마.

**되붙이려면 `/` 를 정적으로 두는 성질을 어떻게 지킬지 먼저 답할 것** — `usePathname()` 이나
열림 상태를 들이면 `/` 에 클라이언트 JS 가 들어간다.

## 색과 부품 규격

**색은 `app/globals.css`, 부품 규격은 `components/ui/` 가 단일 소스다.**

`globals.css` 는 2층이다. 원시 팔레트 `--raw-*`(`:root`) → 시맨틱 토큰 `--color-*`(`@theme inline`).
**컴포넌트는 시맨틱 토큰만 쓴다.** `@theme inline` 의 `inline` 을 빼면 `var(--raw-*)` 참조가 깨진다.

- 이름에 `text`/`border` 를 쓰지 않는다 — 텍스트는 **`ink`**, 선은 **`line`**.
- **초록은 용도가 둘이다.** 글자가 올라가는 면은 `brand-solid` + `text-on-brand-solid`(흰 글씨).
  **`green500`(`brand`)은 글자 없는 면으로만 쓴다** — 막대·커서·링·hover 테두리. 대비는 넉넉하지만
  밝고 채도가 높아 어두운 글리프의 가장자리가 물러 보인다 (`text-on-brand` 는 소비처가 없다).
  **`green500` 위에 흰 글씨를 올리지 말 것.**
- **중간 밝기 초록에는 어느 글씨색도 대비를 통과하지 않는 사각지대가 있다.** "조금만 어둡게" 로
  타협하지 말 것 — 연한 면이나 충분히 어두운 면 둘 중 하나로 간다.
- **비활성 채운 버튼을 회색으로 채우지 말 것** — 면을 비운다 (`bg-brand-solid-disabled`).
- 대비비와 "컴포넌트에 raw 색상 없음" 은 `lib/design/tokens.test.ts` 가 `globals.css` 를 파싱해
  검증한다. **토큰을 추가하면 그 테스트에 조합도 추가한다.**
- 사진(래스터)은 토큰 검사 밖이다. 그래서 **사진 위에 글자를 얹지 않고**, 카드 면·글자·화살표는
  전부 토큰이다.

### 부품

| 부품 | 파일 | 규격 |
| --- | --- | --- |
| 버튼 | `ui/Button.tsx` | 48px · radius 12px · 누를 때 1px · variant 넷 |
| 아이콘 버튼 | 같은 파일 `size="icon"` | **44px 원형** · radius 는 `SIZE` 안에 둔다 |
| 사진 위 버튼 | 같은 파일 `variant="surface"` | 면(`canvas`)을 들고 간다 |
| 입력 | `ui/field.ts` 의 `FIELD_BASE` | 48px · radius 12px |
| 칩(선택지 둘) | `ui/ChoiceChips.tsx` | 48px · radius 12px · 라디오 그룹 · 선택된 면은 `brand-solid` |
| 라벨 | `ui/FormField.tsx` (`Field` · `LABEL_CLASS`) | 폼과 `계산 기준` 카드가 공유 |
| 드롭다운 껍데기 | `ui/SelectShell.tsx` | `.select-shell` 화살표 |

- **규격 문자열은 `buttonClass()` 가 만든다.** `<button>` 이 아닌 요소(링크)는 문자열만 가져간다 —
  호출부에서 44px 원형을 다시 스타일링하면 규격이 두 벌이 된다.
- **호출부에 유틸리티를 덧대지 말 것.** 특히 radius 는 특정도가 같아 **스타일시트 순서**가 이긴다.
- 아이콘 버튼의 이름은 `aria-label` 이 만든다 (아이콘은 `aria-hidden`).
- **부품만 만들고 호출부를 안 바꾸면 규격이 두 벌이 된다.** 예외는 `LikeButton`·`SelectShell` 뿐이고
  이유가 주석에 있다.
- **`variant="surface"` 는 대비를 보증할 수 없는 면 위에 얹히는 꼴이다** (지금은 히어로 사진 위의
  뒤로가기 하나). 사진 위에 무엇을 얹을 일이 또 생기면 이 꼴을 쓰고 **글자로는 넓히지 말 것.**
- 타이포는 `globals.css` 의 `title-lg/md/sm` × `title-bold/extrabold` 세 단계. **임의값을 쓰지 않는다.**
  **`title-sm` 과 `.reading h2` 는 같은 값이어야 한다.**
- **포커스 링은 전역 `:focus-visible` 하나다.** 컴포넌트에 `focus:ring-*` 을 붙이지 말 것
  (같은 클래스의 `outline-none` 이 전역 규칙을 조용히 덮는다). 색은 `brand-hover` — 초점 표시도 3:1 이다.
- **모든 `select` 가 `SelectShell` 을 쓴다.** 하나만 빠지면 그 칸에 브라우저 기본 화살표가 남는다.
  `birth-input.test.ts` 가 **select 를 그리는 파일마다** `<select` 개수와 껍데기 개수를 대조한다 —
  **새 파일에서 select 를 그리기 시작하면 그 목록에 더할 것.**
  삼각형은 `clip-path` 로 그린다(data URI 에 색을 박으면 팔레트 밖 색이 하나 생긴다).
  `.select-shell > select` 에 **`min-width: 0`** 이 필요하다.
- **가로 스크롤바는 `.scroller-x`.** 표준 속성(`scrollbar-width`·`scrollbar-color`)과
  `::-webkit-scrollbar` 를 **둘 다** 두고 값을 맞춘다(`tokens.test.ts` 가 막대 색을 대조한다).
  여백은 스크롤러의 `padding-bottom` 이 만든다. **트랙에 색을 주지 않고, 숨기지 않는다.**

dasii 에서 무엇을 가져오고 무엇을 버렸는지는 `docs/design-tokens.md`.
**shadcn 시맨틱 층(`--background`·`--ring`)은 쓰지 않는다.**

웹폰트는 **제목 자리에만 굵기 800 한 벌**이다 (`public/fonts/README.md`).
**본문으로 넓히거나 굵기를 더하지 말 것** — 2,000자 스트리밍이 폰트 로드에 묶인다.

## `/` — 유형 선택 리스트 카드

한 줄에 한 장. 왼쪽에 글(묻는 것 · 제목 · 설명 · 조회수), 오른쪽에 사진, 오른쪽 아래에 원형 화살표.
기준 레퍼런스는 `docs/ui_ref/list_reference.jpg`.

- **`/` 에는 클라이언트 컴포넌트가 없다.** 정적(ISR 5분)을 유지하는지 빌드 표로 확인한다.
- **폭은 글 `58%` + 사진 `42%` 이고 합이 100% 를 넘으면 안 된다.** 두 %의 기준이 다르다 —
  글은 카드 콘텐츠 폭(패딩 안쪽), 사진은 카드 폭이다. `lib/form/birth-input.test.ts` 가 합을 본다.
  **사진 마스크를 더 흐리게 해서 덮는 쪽으로 풀지 말 것** (사진 색은 토큰 검사 밖이다).
- 글 묶음에 **`break-keep`** 을 준다 (없으면 한글이 낱말 가운데서 끊긴다).
- 설명은 `line-clamp-3` 으로 자르되 **지우지 않는다**. **`line-clamp-*` 에 `block` 을 함께 주지 말 것**
  (`display: -webkit-box` 를 덮어 잘림이 통째로 죽는다).
- 제목 위에 **묻는 것 한 줄**(`READING_TYPE_QUESTION`)이 붙는다 — 라벨(무엇을 주는지)과 다른 일을
  하므로 겹치면 안 된다. `schema.test.ts` 가 겹침·금지 어휘·숫자·길이를 본다.
- **제목은 한 줄이고 `title-lg`.** `whitespace-nowrap` 을 붙이지 않는다.
- 카드는 **`next/link`** 다 (버튼 + `router.push` 금지 — 새 탭·가운데 클릭·크롤러가 죽는다).
- 화살표는 `aria-hidden` 장식이고 링크 이름은 제목이 만든다.
- `ul`/`li` 구조와 `aria-label` 은 `birth-input.test.ts` 가 소스에서 본다.
- 머리 부분은 강조색 윗줄 + 큰 제목 + 옅은 그라데이션. 띠는 음수 여백으로 **콘텐츠 열 끝까지** 펼친다.
  색은 시맨틱 토큰이고 **유형별로 갈지 않는다.**
- **첫 카드 사진에만 `priority` 를 준다** (다섯 장 전부에 주면 preload 가 서로를 밀어낸다).

## `/reading/[type]` — 히어로 사진

구조는 **히어로 사진(열 맨 위) → 제목 → 한 줄 → 폼**. 뒤로가기 `<` 는 사진 위 좌상단.

- 사진은 **콘텐츠 열의 맨 위·양 끝까지** 닿는다. 페이지가 `relative -mx-5 -mt-10` 으로 `main` 의
  여백을 되돌린다 (뷰포트 폭이 아니라 **열 폭**이다). **음수 여백과 `relative` 는 같은 요소에 있어야
  하고 펼치는 곳은 한 곳뿐이다** (`birth-input.test.ts` 가 본다). `ReadingHeroPhoto` 는 슬롯 높이와
  마스크만 맡는다.
- 슬롯 300px · 마스크 `.hero-photo` · 크롭 `object-position: 50% 100%`.
  **유형마다 다른 크롭 값을 주지 말 것** — 한 사진이 안 맞으면 배치가 아니라 고르기의 문제다.
- **슬롯 높이 · 마스크 · 제목의 음수 여백은 한 벌이다.** 페이드 꼬리가 슬롯 안에서 0 에 닿고
  제목은 그 아래에 앉는다 (지금은 꼬리가 271px 에서 끝나고 제목 상단이 272px). 하나만 고치면
  **가로 경계선이 아래로 옮겨 갈 뿐이다** — 근거 계산은 `globals.css` 의 `.hero-photo`.
- **히어로 사진에 `priority` 를 준다** (이 화면의 LCP 요소다).
- `<` 는 `variant="surface"` · `absolute left-5 top-3` · 44px 원형. **스크림을 깔지 않는다.**
- **글자를 사진 위에 얹지 않는다.** 제목·설명이 슬롯 안으로 올라오지만 그 구간의 마스크 알파는
  0 이라 뒤가 `canvas` 다 (그림 위가 아니다). 예외는 이 아이콘 하나뿐이다.
- **사진 위에 글자를 얹을 수 있는 조건은 하나다 — 스크림이 대비를 보증할 때.** 사진 안의 색은
  `tokens.test.ts` 가 닿지 않지만 스크림의 알파는 닿는다. 최악의 사진(흰 면)에서 계산해 알파를
  정하고 그 계산을 테스트가 다시 하게 한다 (지금 그렇게 하는 곳은 판정 콜아웃 하나뿐이다).
- 중앙 정렬은 제목과 한 줄 설명까지만. **본문 문단을 가운데로 놓지 않는다.**
- CTA 는 검정 면 · radius 12px. 모양·색·상태는 전부 `ui/Button.tsx` 가 정한다.

### 홈으로 돌아가는 동선

- `/reading/[type]` 은 맨 위 `<` 버튼(`BackIconLink`). **`history.back()` 이 아니라 `/` 로 가는 링크다**
  (검색·공유로 들어온 사람에게는 돌아갈 이력이 없다). `next/link` 여야 한다.
- `/privacy` · `/disclaimer` 는 `<BackLink />` 텍스트 꼴. **거기에 아이콘 꼴을 쓰지 않는다** —
  문서 상단에서는 어디로 가는지가 글자로 읽혀야 한다.
- 두 꼴을 `components/BackLink.tsx` 한 파일에서 정의한다.
- 푸터 링크 이름은 목적지를 말한다 (`처음으로`).
- **`aria-current` 처리를 하지 않는다** — `usePathname()` 이 `SiteFooter` 를 클라이언트로 만들고
  레이아웃에 있으므로 `/` 까지 동적이 된다. 테스트가 막는다.

## 유형 사진 — 두 화면이 같은 그림을 쓴다

파일은 `public/cards/<type>.jpg`. **경로 표는 `lib/reading/type-photo.ts` 한 곳**
(`Record<ReadingType, …>`). 두 벌로 두면 `/` 에서 고른 카드와 들어간 화면의 그림이 달라진다.

| 자리 | 컴포넌트 | 모양 |
| --- | --- | --- |
| `/` 카드 오른쪽 면 | `ReadingCardPhoto` | 42% 폭 · `.card-photo` 로 **왼쪽**으로 흐려진다 |
| `/reading/[type]` 히어로 | `ReadingHeroPhoto` | 열 폭 · 300px · `.hero-photo` 로 **아래·좌우**로 풀린다 |

판정 사진은 표가 다르다 (`public/verdict/` · 축 값마다 한 장 · `.verdict-cover` 로 **카드 전면**).

- **피사체는 사람 없는 정물이다.** 사람 몸은 신체 평가가 되고, 특정 음식 한 접시는 `ELEMENT_FOOD`
  닫힌 목록을 판정 코드 밖에서 우회한다. **식사 도구까지가 경계**(그릇·냄비). **운동 기구는 쓴다.**
- 마스크는 `globals.css` 의 `.card-photo`(왼쪽으로) · `.hero-photo`(아래·좌우로). `-webkit-` 접두사를
  함께 둔다. **히어로 마스크는 레이어 하나로 끝낸다** — 두 겹 쌓으면 `mask-composite` 가 필요하고
  브라우저에 따라 사진이 통째로 사라진다.
- **`alt=""` 인 장식이다.** 링크 이름은 카드 제목이 만든다. 촬영자 표기는 `public/cards/CREDITS.md`.
- **자산은 우리 도메인에서 서빙한다** (Pexels URL 을 직접 물면 방문자가 제3자에 요청을 보낸다).
  파일은 커밋한다.

```bash
node --env-file=.env.local scripts/fetch-card-photos.mjs --count=6         # 후보
node --env-file=.env.local scripts/fetch-card-photos.mjs --only=exercise    # 한 유형만
node --env-file=.env.local scripts/fetch-card-photos.mjs --pick=exercise:3  # 확정
```

- 두 단계다 — 후보를 임시 디렉터리에 받아 **눈으로 고르고** 확정한다. 첫 장을 자동으로 물리지 않는다.
- `SIZE = 480`. Pexels 는 화질 파라미터를 무시한다. **`size=large` 를 걸지 말 것**
  (후보 풀이 줄어 검색어와 무관한 사진이 올라온다).
- 검색어에 사람이 섞이는 것이 기본값이다 — 정물이 나오는 낱말(신발·매트·기구)로 좁힌다.
- **`.next/dev/cache/images` 를 지워야 새 사진이 보인다** (`.next/cache/images` 가 아니다).

## 결과 화면

위에서부터 **판정 한 줄 → 풀이 → 좋아요 → 공유 → 근거 도식 넷 → 다른 유형 링크**.

- 근거 카드 넷은 `사주 원국` · `기운의 관계` · `대운 · 세운` · `계산 기준` 이고 **모두 `FoldCard`
  (`<details>` + `.fold`)로 접힌다.**
- **접는 기준: 스트리밍으로 채워지는 것은 접지 않는다.** 도식은 요청 즉시 확정되므로 접는다.
- 접힌 줄에 `note` 한 줄을 함께 둔다 (무엇이 들었는지 모르면 결국 전부 펴 보게 된다).
- 묶음 제목은 `내 사주`(`h2`) + 바로 아래 한 줄 `이 풀이는 아래 값에서 나왔습니다.`
  **둘 중 하나만 두지 말 것.** 카드 제목은 `h3`. **묶음 제목을 카드로 감싸지 않는다.**
- 좋아요와 공유는 `space-y-2` 한 묶음. `OtherReadingLinks` 는 따라오지 않는다 (그것은 화면을 다 본
  뒤의 동선이라 `SajuForm` 맨 아래가 제자리다). 셋 다 `!streaming` 이다.
- **`OtherReadingLinks` 는 평범한 라우트 이동이다** — `router.replace` 로 URL 과 화면을 따로 맞추는
  편법을 쓰지 않는다. 공개 유형이 하나뿐이면 아무것도 내지 않는다.
- 자동 스크롤은 `arrivedCount`(응답으로 원국이 도착한 횟수)에 걸린다. **`chart` 로 되돌리면 캐시
  적중으로 막 들어온 사람의 화면이 튄다.** `resultRef` 는 결과 묶음 전체를 감싼 `div` 에 붙는다.
- 맨 아래 전문가 상담 권유 문구는 **화면이 들고 프롬프트에는 없다.** `prompt.test.ts` 가 양쪽을
  검사한다 — **되돌리려면 두 곳을 같은 커밋에서 고칠 것.**

### 판정 한 줄 콜아웃 (`VerdictCallout`)

`chart` 값으로 **코드가 직접 그린다.** LLM 이 쓰지 않는다. 스트리밍 중에도 낸다.

- 어느 유형이 무엇을 내는지는 `Record<ReadingType, (chart) => Callout | null>`. **삼항으로 두지 말 것.**
- **모든 유형이 낸다.** 조건은 하나 — **라벨이 기존 판정에서 1:1 로 파생될 것**(새 동점 처리 금지).
- **라벨만 크게 띄우지 않는다** — 근거 한 줄을 함께 둔다. 라벨만 있으면 몸에 대한 확정 진술로 읽힌다.
- **그 한 줄은 판정 축의 이름을 대지 않고 라벨의 뜻을 생활어로 말한다.** 모르는 말로 출처를 대면
  범위 한정이 아니라 권위 신호가 된다 — 본문 첫 글자보다 먼저 뜨는 자리다. **용어를 괄호로 풀지도
  않는다**(글 폭이 좁아 줄이 자란다 · 용어 풀이는 본문의 일이다). 판정의 출처를 말하는 일은 자리
  셋이 맡는다 — 눈썹 줄(`이 사주에서 읽은 한 줄`) · 아래 `내 사주` 묶음 머리(`이 풀이는 아래 값에서
  나왔습니다`) · `ResultView` 하단 고정 문구.
- **근거 줄은 390px 에서 두 줄까지다.** 세 줄이 되면 큰 글자 라벨이 카드의 주인 자리를 잃는다.
- 라벨과 근거 줄 문구는 `lib/saju/constitution.ts` 와 `lib/CLAUDE.md` 가 정한다. **컴포넌트에 직접
  쓰지 않는다** — `constitution.test.ts` 의 금지 어휘·처방·숫자·효능 검사를 통째로 우회한다.
- 라벨마다 사진 한 장 (`public/verdict/<슬러그>.jpg`). **슬러그는 유형이 아니라 축 값에 붙는다**
  (`Record<MetabolismTendency, …>` 처럼). 피사체 규칙은 유형 사진과 같고, `element-*` 는 재료가
  아니라 **오행 자체의 상징**을 쓴다. `priority` 를 주지 않고 `loading="eager"` 로 지연 로드만 끈다.
  **유형 사진과 같은 장을 쓰지 않는다.** `lib/reading/verdict-photo.test.ts` 가 슬러그를 세
  곳(컴포넌트 · 스크립트 검색어 표 · `public/verdict/`)에서 대조하고 두 `photos.json` 의 id 중복도 본다.
- **모습이 둘이다.** 사진이 있으면 **사진 전면 + 어둠 + 흰 글씨**(`.verdict-cover`·`.verdict-photo` ·
  최소 높이 13rem · 글은 아래로 모임 · 크롭은 한 값 `50% 50%`)이고, 사진이 없는 내부 유형
  (`general`·`decade`)은 연한 브랜드 면 + `text-brand-ink` 다. **한 컴포넌트에 둔다** — 갈리는
  지점이 `Callout.photo` 하나뿐이다.
- **위계는 무게와 크기로만 만든다** (색은 흰색 하나). 사진 위 글의 폭을 좁히지 않는다 — 어둠이
  카드 전체에 깔리므로 라벨이 한 줄에 들어간다.

```bash
node --env-file=.env.local scripts/fetch-verdict-photos.mjs --count=6
node --env-file=.env.local scripts/fetch-verdict-photos.mjs --pick=<슬러그>:<번호>
```

### 도식 넷 (`components/charts/`)

`OhaengBars` · `OhaengCycle` · `ThermalScale` · `DaeunTimeline`. **차트 라이브러리를 넣지 않는다.**

- **좌표가 필요한 것만 SVG 다**(오각형 하나). 나머지는 div — 좁아질 때 칸만 줄고 글자는 남는다.
- **점수를 숫자로 찍지 않는다.** 배수가 우리 관례이므로 길이로만 쓰고, 화면에 적는 숫자는 사실인
  `count` 다.
- 색은 시맨틱 토큰만. SVG 의 `fill-*`·`stroke-*` 도 `tokens.test.ts` 검사 대상이다.
- **공유 카드와 시각 언어를 맞춘다** (화면이 막대면 카드도 막대).
- **`DaeunTable` 의 가로 가운데 맞춤은 `open` 을 의존성에 넣어야 한다** — 접힌 `<details>` 안은
  `display: none` 이라 `getBoundingClientRect()` 가 전부 0 이다.
- `summary` 에 `focus:ring-*` 을 붙이지 말 것. 화살표는 `.select-shell` 과 같은 `clip-path` 방식.

### 계산 기준 카드 (`CalculationBasis`)

폼에 있던 출생시각 보정 · 자시 기준이 여기 있다. **폼으로 되돌리지 말 것** — 이 설정을 만지고
싶어지는 순간은 폼을 채울 때가 아니라 결과가 다른 곳과 다를 때다. 23시대 출생자는 자시 기준에
따라 일주가 통째로 바뀌므로 **지우면 안 된다** (`app/disclaimer/page.tsx` 의 약속이 거짓이 된다).

- **`고급` 이라는 낱말을 쓰지 않는다** (`birth-input.test.ts` 가 폼과 카드 양쪽에서 0건을 본다).
- `note` 는 고른 값이 아니라 **실제로 적용된 값**이다. 시각 미상이면 `시각 미상 · 시주 제외`.
- **바꾸면 자동으로 다시 받지 않는다** — `이 기준으로 다시 보기` 버튼을 낸다. 제출 경로는
  `SajuForm.handleSubmit` 하나이고 카드는 `onReapply` 로 부른다. **두 번째 요청 경로를 만들지 말 것.**
- **바뀐 것이 없으면 버튼을 내지 않는다.** 비교는 실제로 쓰인 값과 한다.
- 시각 미상이면 숨기지 않고 **잠근다.**

## 풀이 렌더 (`ReadingSections`)

섹션 계약(제목 문자열·파서)은 `lib/reading/sections.ts` 가 단일 소스다 — `lib/CLAUDE.md` 를 함께 볼 것.

- **아코디언을 쓰지 않는다.** 요약만 카드로 띄우고 나머지는 한 카드 안에서 구분선으로 나눈다.
- **`<Markdown>` 을 직접 부르지 말고 `Prose` 를 쓴다** (호출부가 본문·프리앰블·**폴백** 셋이고
  폴백은 평소에 안 보인다). 테스트가 `<Markdown>` 이 한 곳에만 있는지 본다.
- **절 제목 규격은 `SECTION_TITLE` 한 값이고 요약 카드 제목도 같은 값을 쓴다**(`title-sm title-bold` ·
  `.reading h2` 와 같은 크기 · 색만 `text-brand-ink` 로 다르다). 요약이 위에 있는데 제목이 더 작으면
  위계가 뒤집힌다. **`tracking-wide` 를 붙이지 않는다** — `.title-sm` 의 음수 자간과 싸운다.
- 섹션 `key` 는 **`id-index`** 다 (id 만 쓰면 같은 제목이 두 번 올 때 겹친다).
- **`.reading` 클래스는 본문에만 붙인다** — `.reading h2` 는 `@layer` 밖이라 Tailwind 유틸리티를 이긴다.
- 제목 앞 아이콘은 계약이 아니라 화면에서 붙인다 (`SECTION_ICON` = `Record<ReadingSectionId, string>`).
  `aria-hidden` 이다. 이형자 선택자가 필요한 문자는 **선택자를 붙인 채로** 저장한다.
  **장기·특정 식품 그림을 쓰지 않는다.** 계약에 없는 절과 원문 폴백에는 붙이지 않는다.
  공유 카드에는 넣지 않는다 (캔버스 이모지는 OS 폰트에 따라 두부가 된다).
- 본문 강조는 프롬프트가 본류이고 코드는 판정 라벨의 **첫 등장만** 감싼다 (`lib/reading/emphasis.ts`).
  **닫히지 않은 `**` 는 표시만 지운다**(뒤 내용을 감추지 않는다). 라벨은 `Prose` 까지 **context** 로
  내린다(prop 으로 흘리면 폴백을 빠뜨린다). **색을 주지 않는다.**

### 문단 나누기 (`lib/reading/line-breaks.ts`)

렌더 직전에 문장 묶음마다 문단으로 가른다. **프롬프트로 풀 수 없다** — CommonMark 는 단일 개행을
줄바꿈으로 렌더하지 않는다. **`<br>`(hard break)이 아니라 문단이다.**

- 종결 부호 **앞 글자가 한글이거나 닫는 괄호·따옴표일 때만** 가른다 (`3.5`·`1. 항목`·`e.g.` 가
  애초에 안 걸린다 — 예외 목록을 관리하지 않는다).
- 종결 부호 **뒤에 공백과 다음 글자가 다 와야** 가른다 (쓰이는 중에 줄이 생겼다 사라지지 않게).
- 묶는 규칙은 **길이 문턱 하나**(`CHUNK_MIN_CHARS` 80자). **문장 수로 세지 않는다.**
- **왼쪽부터 훑는 그리디여야 한다** — 스트리밍 중 이미 내린 결정이 바뀌면 읽던 자리가 튄다.
- **문장을 쪼개지 않는다.**
- `.reading p` 여백은 그대로 둔다. **여백을 줄여 문단 수를 유지하는 쪽은 택하지 않는다.**

## 폼 (`SajuForm`)

- **유형 선택 컨트롤을 폼 안에 두지 않는다** (`birth-input.test.ts` 가 폼 안을 본다). 유형은 라우트
  세그먼트에서 온다. 폼 밖의 `next/link` 는 이 경계 밖이다.
- 값이 있으면 접고 **요약 한 줄 + 연필 아이콘 버튼을 같은 줄에** 둔다 (글 `min-w-0` + 버튼 `shrink-0`).
  **접힌 채로 바로 제출할 수 있어야 한다.** 요약에 **이름은 넣지 않는다.** 제출할 수 없는 값이면
  접지 않는다 (왜 버튼이 꺼져 있는지 볼 수 없게 된다).
- **컨트롤마다 붙는 보조 설명을 다시 늘리지 않는다.** 판단 기준은 "그 줄이 지금 할 일을 말하는가".
  조용히 적용되는 기본값은 문장이 아니라 **기본값을 눈에 보이게** 해서 푼다 (출생지 기본 `서울`).
- **막는 문구 둘은 남는다** — 반쪽 시각(`role="alert"`)과 지역이 잠긴 이유. `missingForType` 도
  그대로다. 지역 잠김 문구는 **어디서 풀 수 있는지**(계산 기준 카드)를 가리켜야 한다.
- **쓰이지 않을 값은 보내지 않는다** — 시각 미상·보정 없음이면 경도를 빼고 폼도 잠근다.
  고를 수 있게 두면 반영되는 줄 안다.
- **지역 이름은 서버로 보내지 않는다** — 가는 것은 경도뿐이다.
- 시각은 시·분 드롭다운 두 개이고 **분은 1분 단위**다. 한쪽만 고른 상태는 제출을 막는다.
- 성별은 칩 둘이고 `선택 안 함` 칩은 없다 (둘 다 비선택 = `unspecified`). **필수로 만들지 말 것.**
- `FirstVisitNotice` 는 `/reading/*` 에만 둔다 — "저장하지 않습니다" 는 정보를 넣기 직전에 보여야 한다.

## 공유 (`ShareActions`)

브라우저 캔버스에 1080×1350 카드를 그린다 (`lib/share/card-model.ts` 무엇을 · `draw-card.ts` 어떻게).
**서버를 거치지 않으므로 원국 데이터가 브라우저를 떠나지 않는다.** `next/og`(satori)를 쓰지 않는다
(한글 글리프 때문에 폰트 파일이 필요하다).

- **카드에 생년월일·나이를 찍지 않는다.** 띠·계절·간지·십신까지. 대운도 나이 구간을 뺀다
  (구간을 적으면 출생 연도가 좁혀진다). 테스트가 막는다.
- 버튼 둘은 어느 폭에서도 `grid-cols-2` 한 줄. 글자만 `text-sm`, 부품 규격(48px)은 그대로.
- **제목 아래 설명 줄은 없다.** 되살린다면 처리방침 쪽에 두는 편이 낫다.
- og:image 는 **고정 카드 하나**(`app/opengraph-image.png` · 원본 `docs/og-card.html` 을 1200×630 으로
  렌더). **유형별로 만들지 않는다.** 팔레트가 어긋나면 `tokens.test.ts` 가 실패한다.
- **파일 규약 이미지는 하위 세그먼트로 상속되지 않는다** — `app/reading/[type]/page.tsx` 의
  `generateMetadata` 가 같은 경로를 명시한다. **이 줄을 지우면 이미지 없는 카드가 나간다.**
- `metadataBase` 를 지우지 말 것 (상대 경로로 나가면 카카오톡 크롤러가 못 읽는다).
- 파비콘·앱 아이콘은 `docs/icon.html` → `node scripts/render-icons.mjs` (`app/icon.png` 512 ·
  `app/apple-icon.png` 180 · `app/favicon.ico` 48). 결과물을 커밋하므로 배포에 스크립트가 필요 없다.
  - 문양은 dasii 로고에서 왔고 **벡터 좌표로 다시 그린 것이라 눈대중으로 고치지 말 것.**
  - 타일(면)은 없다. `apple-icon` 만 면을 채우고 **모서리는 둥글리지 않는다**(iOS 가 스스로 깎는다).
  - `--raw-mark-blue` 는 **장식 전용**이다. 글자 배경으로 쓰지 말 것.
  - playwright 는 상시 의존성이 아니다 (`PLAYWRIGHT_CORE_PATH`·`CHROMIUM_PATH`).
  - `.ico` 는 PNG 를 품는 22바이트 헤더로 만든다 (`pngToIco`).
  - **`/apple-touch-icon.png` 는 404 로 둔다** (Next 규약상 `/apple-icon.png` 로 나가고 `<link>` 가
    그쪽을 가리킨다).
  - 좌측 패널 로고 글자는 원본 PNG(`public/dasii/logo_text.png`)를 쓴다.

## 애니메이션과 전환

`lib/design/motion.test.ts` 가 아래를 소스에서 검사한다.

1. **키프레임은 `from` 만 쓴다.** 쉬는 상태가 최종 모습이고 애니메이션은 숨은 상태에서 출발하기만
   한다. `to` 로 최종값을 지정하면 `prefers-reduced-motion` 에서 **숨은 상태에 갇혀 화면이 비어
   보인다.** 그래서 모션 최소화 대응에 JS 분기가 필요 없다.
2. **재생이 한 번인 것도 CSS 에 맡긴다.** 대신 요소가 remount 되면 재생되므로 섹션 `key` 를
   안정적으로 유지해야 한다.

`anim-*` 클래스는 `globals.css` 에 키프레임과 나란히 정의한다. **Tailwind 임의값(`[animation:…]`)으로
흩뿌리지 말 것** — 테스트가 정의/사용 양쪽을 대조한다.

`chart-draw` 는 `stroke-dasharray` 가 **선 길이와 같아야** 한다 (`OhaengCycle` 이 좌표에서 계산해
`--draw-length` 로 넘긴다). **점선 자체가 의미인 선(상극)에는 쓸 수 없다.**

### 화면 사이 전환 (View Transitions)

`/` 의 카드를 누르면 상세가 오른쪽에서 밀려 들어오고 `<` 로 나가면 반대로 빠진다.

- **`/` 에 클라이언트 JS 를 들이지 않는 것이 이 구현의 축이다.** React 의 `<ViewTransition>`
  (서버 컴포넌트에서 그대로 쓰인다) + `globals.css` 로만 만든다. 빌드 표에서 `/` 가
  `○ (Static)` 인지 확인할 것.
- **감싸는 자리는 레이아웃이 아니라 페이지다** — 레이아웃은 이동에서 다시 렌더되지 않아
  `enter`/`exit` 가 아예 일어나지 않는다. 참여하는 페이지가 **각자** `PageTransition` 을 쓴다
  (한쪽만 감싸면 절반짜리 전환이 된다).
- **방향은 링크가 말한다** (`transitionTypes={[NAV_FORWARD]}` / `[NAV_BACK]`). 자동으로 정해지지 않는다.
- **세 곳이 같은 문자열을 써야 산다** — 링크 · `PageTransition` 의 유형 표 · `globals.css` 의
  `::view-transition-*(.nav-*)`. 어긋나면 오류가 아니라 **아무 일도 일어나지 않고** 스크린샷에도
  안 남는다. `motion.test.ts` 가 셋을 대조하고 방향이 서로 반대인지까지 본다.
- 두 고지 페이지의 `BackLink` 에는 방향을 달지 않는다 (그쪽은 `PageTransition` 밖이다).
- **셸(좌측 패널·푸터·흰 열)은 움직이지 않는다.**
- `::view-transition-*` 는 모션 최소화의 `*` 규칙에 잡히지 않는다 — 그 블록에 따로 적고
  `animation-delay` 도 함께 지운다. 여기서도 `from` 규칙이 값을 한다.
- **`::view-transition { pointer-events: none }`** 이 없으면 전환 중 클릭이 통째로 사라진다.
- `@types/react` 는 `ViewTransition` 타입을 `react/canary` 에 숨긴다 (`types/react-canary.d.ts`).
