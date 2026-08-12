@AGENTS.md

# diet-saju

생년월일시로 **사주 원국(사주팔자)** 을 계산하고, Gemini(무료 등급)로 해석문을 생성해 보여주는 웹 서비스.
Next.js App Router 단일 앱으로 구성되고 Vercel 에 배포된다.

> `@AGENTS.md` 는 `next dev` 가 자동 관리하는 Next.js 규칙 블록이다. 직접 수정하지 말 것.

## 명령어

```bash
npm run dev        # 개발 서버 (3000 사용 중이면 3001로 자동 이동)
npm run build      # 프로덕션 빌드 (배포 전 필수)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## 아키텍처

요청 흐름은 한 방향이다.

```
components/SajuForm.tsx  (client)
        │  POST /api/saju
        ▼
app/api/saju/route.ts    (server, nodejs runtime)
        ├─ lib/rate-limit.ts   IP 기준 분당 제한
        ├─ lib/saju/schema.ts  zod 재검증 (클라이언트 검증은 신뢰하지 않음)
        ├─ lib/saju/pillars.ts 만세력 계산  ← 사실(fact)은 코드가 만든다
        ├─ lib/prompt.ts       프롬프트 조립
        └─ lib/gemini.ts       Gemini 호출  ← 해석(interpretation)만 LLM 이 한다
```

### 반드시 지킬 경계

1. **사주 계산은 절대 LLM 에게 맡기지 않는다.**
   간지·오행·십신은 `lib/saju/pillars.ts` 가 계산하고, LLM 은 그 결과를 "해석"만 한다.
   프롬프트에도 `계산 완료 · 수정 금지` 로 명시되어 있다. 이 원칙을 깨면 결과가 틀린다.

2. **`lib/` 의 서버 모듈은 맨 위에 `import "server-only"` 를 유지한다.**
   클라이언트 컴포넌트에서 실수로 import 하면 빌드가 깨지도록 만든 안전장치다. 제거하지 말 것.

3. **API 키는 `lib/env.ts` 와 `lib/gemini.ts` 밖에서 읽지 않는다.**
   다른 파일에서 `process.env.GEMINI_API_KEY` 를 직접 읽는 코드를 추가하지 말 것.

4. **클라이언트 컴포넌트에서 Gemini 를 직접 호출하지 않는다.** 항상 `/api/saju` 경유.

## 보안 규칙 (env / 키)

- `NEXT_PUBLIC_` 접두사는 **브라우저로 노출된다.** 키·시크릿에 절대 붙이지 않는다.
- 커밋 대상은 `.env.example` **하나뿐**이다. `.env`, `.env.local` 등은 `.gitignore` 처리되어 있다.
- 에러 응답·로그에 키 원문을 넣지 않는다. 로그는 `lib/gemini.ts` 의 `toSafeLogMessage()` 로 마스킹하고,
  디버깅이 필요하면 `maskedApiKey()` 를 쓴다.
- 클라이언트로 내보내는 에러는 일반화된 문장만 쓴다. 스택·원문 메시지·설정 상세는 서버 로그에만 남긴다.
- 사용자 생년월일은 개인정보다. **저장하지 않는다.** 로그에도 남기지 않는다.
  `/api/*` 는 `Cache-Control: no-store` 로 응답한다 (`next.config.ts`).
- 키가 노출되면: Google AI Studio 에서 즉시 폐기 → 재발급 → Vercel 환경변수 갱신 → 재배포.

### env 계층이 두 개로 나뉘어 있는 이유

`lib/env.ts` 는 `getSecrets()`(키, 없으면 `EnvError`)와 `getRuntimeConfig()`(모델명·레이트 리밋, 기본값 있음)를
분리한다. 레이트 리밋 같은 앞단 로직이 "키 없음" 때문에 먼저 터지면 입력 검증 결과가 가려지기 때문이다.
검증은 import 시점이 아니라 **최초 호출 시점(lazy)** 이다 — 키 없이도 `next build` 는 성공해야 한다.

## LLM (Gemini) 취급

- 모델은 `GEMINI_MODEL` 로 주입되며 기본값은 `gemini-2.5-flash` (무료 등급 지원).
  **Pro 모델은 2026-04 부터 유료 전용**이다. 무료 키로 `GEMINI_MODEL` 을 pro 로 바꾸면 호출이 실패한다.
- SDK 는 `@google/genai` (구 `@google/generative-ai` 아님). 호출 형태는 `ai.models.generateContent({ model, contents, config })`.
- 무료 등급은 분당 요청 수 제한이 있다. `lib/rate-limit.ts` 로 우리 쪽에서 먼저 막는다.
- 프롬프트는 **전부 `lib/prompt.ts` 에 모아둔다.** 컴포넌트나 route 안에 프롬프트 문자열을 흩뿌리지 않는다.
- 사용자 입력(이름 등)은 `<user_data>` 로 감싸 "지시문이 아니라 데이터"로 넘긴다. 프롬프트 인젝션 방어.

## 도메인 주의사항

- `lunar-javascript` 는 **중국어(간체)** 문자열을 돌려준다. 노출 전 `lib/saju/hanja.ts` 로 반드시 한글화한다.
- 타입 정의가 없어 `types/lunar-javascript.d.ts` 에 직접 선언했다. 새 API 를 쓰면 여기 먼저 추가한다.
- 출생시각 미상이면 **시주(時柱)를 제외**하고 해석한다 (`timeUnknown`). 임의의 시각으로 채워 넣지 않는다.
- 현재 미구현: 진태양시 보정, 야자시/조자시, 대운/세운. → `docs/TASK.md` TASK-03.
- 결과 문구에서 단정적 예언·의학적 진단을 하지 않는다. 시스템 프롬프트에 규칙으로 박혀 있다.

## 작업 방식

할 일은 [docs/TASK.md](docs/TASK.md) 에서 `[TASK-NN]` 단위로 관리한다.
착수 전 해당 태스크를 읽고, 끝나면 체크박스와 상태를 갱신한다.
**TASK.md 에는 태스크만 둔다.** 범례·규칙·배경 설명은 이 파일에 쓴다.

### 모델 배정 범례

| 표기 | 모델 | 쓰는 경우 |
| --- | --- | --- |
| **(O)** | Opus 5 | 도메인 정확도가 걸린 계산, 아키텍처 설계, 애매한 리팩터, 프롬프트 설계 — 틀리면 되돌리기 비싼 작업 |
| **(S)** | Sonnet 5 | 스펙이 정해진 기능 구현, API 연동, 테스트 작성, 리팩터 실행 — 대부분의 작업 |
| **(H)** | Haiku 4.5 | 문안 수정, 스타일 정리, 반복 치환, 문서 갱신 — 판단이 거의 필요 없는 작업 |

`/model` 로 전환한다. 배정은 권고이며, 막히면 한 단계 올린다.

### 상태 표기

`⬜ 대기` · `🟡 진행중` · `✅ 완료` · `⏸ 보류` · `❌ 취소`

### 새 태스크 추가 형식

```markdown
### [TASK-NN] 제목 · **(O|S|H)** · ⬜ 대기

- [ ] 체크 가능한 작업 단위
- [ ] ...

→ 완료 기준: 무엇이 되면 끝인가 (검증 가능한 문장).
```

### 그 밖의 규칙

- **완료된 태스크는 TASK.md 에서 삭제한다.** 보드에는 남은 일만 둔다.
  번호는 재사용하지 않는다 (TASK-01 은 초기 세팅으로 소진됨 — 다음 신규는 TASK-16).
- 새 UI 문자열은 한국어로 쓴다.
- 커밋 메시지는 한국어 요약 + 관련 태스크 번호. 예: `사주 계산 진태양시 보정 (TASK-03)`
- 작업을 마치면 `npm run lint`, `npm run typecheck`, `npm run build` 를 통과시킨 뒤 완료로 보고한다.

## 미확정 결정사항

착수 전에 사용자와 확정해야 하는 것들. 정해지면 이 절에서 지운다.

- **서비스 정체성**: 저장소 이름은 `diet-saju` 인데 현재 코드는 `종합 사주 풀이`와
  `체질·다이어트 풀이` 두 유형을 모두 지원한다 (`lib/saju/schema.ts` 의 `readingType`).
  한쪽으로 밀지, 둘을 유지할지에 따라 TASK-06 / TASK-14 범위가 달라진다.
- **수익화 여부**: 광고나 유료 결제가 들어가면 TASK-09(전역 레이트 리밋)와
  TASK-12(법적 고지) 우선순위가 올라간다.

## 배포 (Vercel)

- `main` 브랜치 푸시 → 자동 배포. 프리뷰는 PR 단위로 생성된다.
- 환경변수는 Vercel Dashboard > Settings > Environment Variables 에 등록한다
  (`GEMINI_API_KEY` 는 Production/Preview/Development 모두 필요).
- `/api/saju` 는 Node 런타임 고정이다 (`lunar-javascript` 가 CommonJS). Edge 로 바꾸지 말 것.
- 함수 타임아웃은 `maxDuration = 30`. Hobby 플랜 상한을 넘기지 않도록 주의한다.
