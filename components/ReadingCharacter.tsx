import type { ReadingType } from "@/lib/saju/schema";

/**
 * 유형별 캐릭터 (TASK-70).
 *
 * `docs/ui_ref/` 의 레퍼런스가 화면 가운데에 **표정 있는 캐릭터 하나**를 두는데, 우리는
 * 메인 캐릭터를 만들지 않고 **유형마다 소재를 달리한다.**
 *
 * ## 작은 썸네일과 다른 그림이다
 *
 * `thumbnails/ReadingThumbnail.tsx`(56px)와 **같은 그림을 키워 쓰지 않는다.** 작은 크기에서는
 * 도형 수를 줄이고 굵기를 키우는 쪽이 이기는데(`decade` 를 눈금 다섯 칸으로 그렸다가 바코드로
 * 읽혀 고쳤다), 그 그림을 키우면 반대로 성기고 밋밋해진다. 여기는 표정과 볼터치가 들어간다.
 *
 * ## 손그림 결이란 무엇인가
 *
 * 레퍼런스는 연필 스케치가 아니라 **손그림 느낌의 평면 벡터**다. 이 파일이 지키는 것:
 * 굵고 둥근 선(`strokeLinecap="round"`), 살짝 기울거나 비대칭인 윤곽, 점 두 개 눈,
 * 작은 볼터치, 파스텔 한 면. **그라데이션·그림자·여러 색을 쓰지 않는다.**
 *
 * ## 소재 규칙 — 그림이 본문보다 더 말하면 안 된다
 *
 * - **사람 몸을 그리지 않는다.** 신체 평가로 읽히는 것을 본문에서 막아 두고 그림으로 흘리면
 *   안 된다. 캐릭터는 전부 **사물**이다.
 * - **특정 식품을 그리지 않는다.** `ELEMENT_FOOD` 닫힌 목록을 그림으로 우회하는 셈이 된다
 *   (TASK-50 이 음식 사진을 뺀 이유). 그릇·수저 같은 **식사 도구**까지다.
 * - **아령은 쓴다.** TASK-50 은 "운동기구는 처방으로 읽힌다" 로 뺐는데, 그 뒤 TASK-48 이
 *   **대표 종목을 콕 집어 권하는 유형**을 열었다. 그림이 본문보다 더 말하는 상황이 아니므로
 *   경계가 풀린 것이다 — **근거가 바뀐 것이지 규칙을 어기는 것이 아니다.**
 *
 * ## `Record` 여야 한다
 *
 * 소재가 유형의 의미를 담으므로 배열이면 **새 유형이 남의 캐릭터를 달고 나간다**
 * (TASK-15 에서 공유 카드 칩이 그럴 뻔했던 것과 같은 함정).
 *
 * 면 색은 `--color-seat-*` 이고 **여기서만 쓴다.** 전면 배경으로 옮기면 그 위에 본문이 얹혀
 * 대비 조합이 다섯 벌이 된다 (`CLAUDE.md` "모바일이 기본값이다" 절).
 *
 * 장식이므로 `aria-hidden` 이고 `focusable="false"` 다 — 화면의 이름은 제목이 만든다.
 */

/** 점 두 개 눈 + 볼터치. 캐릭터마다 자리만 다르고 생김새는 같다. */
function Face({ x, y, gap = 11 }: { x: number; y: number; gap?: number }) {
  return (
    <>
      <circle cx={x - gap / 2} cy={y} r={2.6} className="fill-character-ink" />
      <circle cx={x + gap / 2} cy={y} r={2.6} className="fill-character-ink" />
      <ellipse cx={x - gap / 2 - 8} cy={y + 5} rx={3.6} ry={2.4} className="fill-character-blush" />
      <ellipse cx={x + gap / 2 + 8} cy={y + 5} rx={3.6} ry={2.4} className="fill-character-blush" />
    </>
  );
}

/** 굵고 둥근 윤곽선 — 손그림 결의 핵심이라 한 곳에서 정한다. */
const LINE = "fill-none stroke-character-ink";
const WEIGHT = 3.4;

const SEAT: Record<ReadingType, string> = {
  general: "bg-seat-sand",
  diet: "bg-seat-sage",
  "gain-cause": "bg-seat-rose",
  "diet-method": "bg-seat-mist",
  "diet-food": "bg-seat-peach",
  exercise: "bg-seat-mist",
  decade: "bg-seat-sand",
};

const ART: Record<ReadingType, React.ReactNode> = {
  // 오각형 — 상생 오각형에서 온 어휘. 내부 유형이지만 `Record` 라 값이 필요하다.
  general: (
    <>
      <path
        d="M60 24 96 50 82 92H38L24 50z"
        className={LINE}
        strokeWidth={WEIGHT}
        strokeLinejoin="round"
      />
      <Face x={60} y={58} />
    </>
  ),
  // 잎사귀 — 오행·체질. 잎맥 하나를 비대칭으로 두어 손그림 결을 낸다.
  diet: (
    <>
      <path
        d="M84 28C52 28 28 50 28 78c0 6 4 10 10 10 28 0 50-24 50-52 0-4-1-8-4-8z"
        className={LINE}
        strokeWidth={WEIGHT}
        strokeLinejoin="round"
      />
      <path d="M76 38C62 50 52 64 44 80" className={LINE} strokeWidth={2.4} strokeLinecap="round" />
      <Face x={58} y={62} />
    </>
  ),
  // 돋보기 — 원인을 찾는 유형. 손잡이가 한쪽으로 나가 비대칭이다.
  "gain-cause": (
    <>
      <circle cx={54} cy={52} r={26} className={LINE} strokeWidth={WEIGHT} />
      <path d="M74 72 92 92" className={LINE} strokeWidth={WEIGHT} strokeLinecap="round" />
      <Face x={54} y={50} />
    </>
  ),
  // 메모지 — 무엇을 먼저 고정할지. 줄 두 개는 길이가 달라 대칭을 피한다.
  "diet-method": (
    <>
      <rect
        x={30}
        y={22}
        width={60}
        height={74}
        rx={10}
        className={LINE}
        strokeWidth={WEIGHT}
      />
      <path d="M44 74h34" className={LINE} strokeWidth={2.8} strokeLinecap="round" />
      <path d="M44 84h20" className={LINE} strokeWidth={2.8} strokeLinecap="round" />
      <Face x={60} y={50} />
    </>
  ),
  // 사다리꼴 그릇 + 김 한 줄기. 특정 식품이 아니라 식사 도구다.
  "diet-food": (
    <>
      <path
        d="M70 24c-6 8 6 12 0 20"
        className={LINE}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <path
        d="M26 54h68l-9 40H35z"
        className={LINE}
        strokeWidth={WEIGHT}
        strokeLinejoin="round"
      />
      <Face x={58} y={72} />
    </>
  ),
  // 아령 — TASK-48 이 종목 추천을 연 뒤라 처방 경계 밖이다.
  exercise: (
    <>
      <path d="M40 60h40" className={LINE} strokeWidth={WEIGHT} strokeLinecap="round" />
      <rect x={22} y={44} width={16} height={32} rx={6} className={LINE} strokeWidth={WEIGHT} />
      <rect x={82} y={44} width={16} height={32} rx={6} className={LINE} strokeWidth={WEIGHT} />
      <Face x={60} y={80} gap={13} />
    </>
  ),
  // 모래시계 — 10년. 내부 유형이지만 `Record` 라 값이 필요하다.
  decade: (
    <>
      <path
        d="M34 22h52L60 60l26 38H34l26-38z"
        className={LINE}
        strokeWidth={WEIGHT}
        strokeLinejoin="round"
      />
      <Face x={60} y={34} />
    </>
  ),
};

export function ReadingCharacter({ readingType }: { readingType: ReadingType }) {
  return (
    <div
      aria-hidden
      className={`mx-auto flex size-36 items-center justify-center rounded-full sm:size-44 ${SEAT[readingType]}`}
    >
      <svg viewBox="0 0 120 120" focusable="false" className="size-28 sm:size-32">
        {ART[readingType]}
      </svg>
    </div>
  );
}
