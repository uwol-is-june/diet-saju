# diet-saju

생년월일시로 **사주 원국(사주팔자)** 을 계산하고, Gemini 로 해석문을 생성하는 웹 서비스.

🔗 https://diet-saju.vercel.app

- 사주 계산(간지·오행·십신)은 **코드**가 한다 — `lunar-javascript` 절기 기반
- 해석문 생성만 **LLM**이 한다 — Google Gemini (무료 등급)
- 배포: Vercel

## 시작하기

```bash
npm install
cp .env.example .env.local     # 키를 채운다 (아래 참고)
npm run dev                    # http://localhost:3000
```

### API 키 발급

1. https://aistudio.google.com/apikey 에서 API 키를 만든다 (무료 등급으로 충분하다)
2. `.env.local` 의 `GEMINI_API_KEY=` 뒤에 붙여넣는다
3. 개발 서버를 재시작한다

> `.env.local` 은 `.gitignore` 되어 있어 커밋되지 않는다. 커밋되는 env 파일은 `.env.example` 하나뿐이다.
> 키는 서버(`/api/saju`)에서만 사용되며 브라우저로 내려가지 않는다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest 전체 |
| `npm run test:watch` | 감시 모드 |
| `npm run validate:saju` | 사주 계산 테스트만 ([검증 내용](docs/saju-validation.md)) |

## 구조

```
app/
  page.tsx              입력 화면
  api/saju/route.ts     계산 + LLM 호출 (서버 전용, Node 런타임)
components/
  SajuForm.tsx          입력 폼
  ResultView.tsx        원국 + 풀이 렌더
lib/
  env.ts                환경변수 검증 (시크릿 / 런타임 설정 분리)
  gemini.ts             Gemini 호출 + 에러 정규화
  prompt.ts             프롬프트 전량
  rate-limit.ts         IP 기준 분당 제한
  saju/
    schema.ts           입력 스키마(zod) + 도메인 타입
    pillars.ts          만세력 계산 → 원국
    time-correction.ts  진태양시·서머타임·표준자오선 보정
    ganji.ts            간지 테이블·십신·시주 규칙 (순수 함수)
    analysis.ts         오행 강약·신강신약·대운·세운 (순수 함수)
    *.test.ts           계산 교차검증 (Vitest)
docs/
  TASK.md               태스크 보드
  saju-validation.md    만세력 검증 결과와 한계
```

## 환경변수

| 이름 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | ✅ | — | Google AI Studio 키. 서버 전용 |
| `GEMINI_MODEL` | | `gemini-3.5-flash-lite` | 사용 모델. 무료 등급 일일 한도가 모델마다 25배까지 다름 (Lite 500, Flash 20) |
| `RATE_LIMIT_PER_MINUTE` | | `5` | IP 당 분당 요청 수 |

## 배포 (Vercel)

1. GitHub 저장소를 Vercel 에 임포트
2. Settings > Environment Variables 에 위 변수를 등록 (Production / Preview / Development)
3. `main` 푸시 → 자동 배포

## 면책

이 서비스의 풀이는 명리학 해석을 참고한 오락·참고용 콘텐츠이며, 의학적·법률적 조언이 아닙니다.

## 개발 규칙

`CLAUDE.md` 참고. 특히 **사주 계산을 LLM 에게 맡기지 않는다**는 경계와 키 취급 규칙을 지킬 것.
할 일은 [docs/TASK.md](docs/TASK.md) 에서 `[TASK-NN]` 단위로 관리한다.
