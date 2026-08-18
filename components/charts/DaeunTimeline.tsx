import { findCurrentDaeunIndex } from "@/lib/saju/decade";
import type { SajuChart } from "@/lib/saju/schema";

/**
 * 대운 타임라인 (TASK-25).
 *
 * ## 아래 카드 목록을 대체하지 않는다
 *
 * 카드 목록은 대운마다 간지·십신을 읽는 곳이고, 여기는 **"지금 어디쯤인가"** 하나만
 * 말한다. 카드 8~10칸은 어느 화면에서도 가로로 넘쳐서 현재 대운이 뒤쪽이면 스크롤하기
 * 전까지 위치 감각이 없었다. 그 한 가지를 스크롤 없이 보여 주는 것이 이 도식의 전부다.
 *
 * ## SVG 가 아니라 div 인 이유
 *
 * 칸을 `flex-1` 로 두면 폭이 좁아질 때 칸이 균등하게 줄고 글자는 그대로 남는다. SVG
 * 뷰박스로 하면 좁은 화면에서 나이 글자까지 같이 작아져 읽을 수 없게 된다.
 *
 * 나이는 **첫 칸·현재 칸·마지막 칸에만** 적는다. 8~10개를 다 적으면 390px 에서 글자가 겹친다.
 */
export function DaeunTimeline({
  daeun,
  currentAge,
}: {
  daeun: NonNullable<SajuChart["daeun"]>;
  /** 세운 첫 해의 나이. 없으면 현재 위치를 표시하지 않는다. */
  currentAge: number | undefined;
}) {
  const periods = daeun.periods;
  // 현재 대운을 찾는 규칙은 `lib/saju/decade.ts` 한 곳에 있다 (TASK-45).
  const currentIndex = findCurrentDaeunIndex(daeun, currentAge);

  return (
    <div>
      <div className="flex gap-0.5" aria-hidden>
        {periods.map((period, index) => {
          const passed = currentIndex >= 0 && index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            // 칸을 겹쳐 감싸지 않는다 — `first:`/`last:` 는 형제 중 위치를 보므로
            // 안쪽에 한 겹 더 두면 모든 칸이 외톨이가 되어 양끝이 다 둥글어진다.
            <div
              key={period.startAge}
              className={`anim-grow-x h-2.5 flex-1 first:rounded-l-full last:rounded-r-full ${
                isCurrent ? "bg-brand-solid" : passed ? "bg-brand" : "bg-surface-inset"
              }`}
              style={{
                animationDelay: `${index * 45}ms`,
                animationDuration: "0.35s",
              }}
            />
          );
        })}
      </div>

      <div className="mt-1 flex text-[11px] text-ink-muted">
        {periods.map((period, index) => {
          const isCurrent = index === currentIndex;
          const isEdge = index === 0 || index === periods.length - 1;
          return (
            <div
              key={period.startAge}
              className={`flex-1 text-center ${isCurrent ? "font-bold text-brand-ink" : ""}`}
            >
              {isCurrent || isEdge ? `${period.startAge}세` : ""}
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-xs text-ink-muted">
        {currentIndex >= 0 ? (
          <>
            진한 칸이 현재 대운({periods[currentIndex]!.ganji} ·{" "}
            {periods[currentIndex]!.sipsin})이고, 연한 칸은 지나온 구간입니다.
          </>
        ) : (
          <>{daeun.direction === "forward" ? "순행" : "역행"} 대운 흐름입니다.</>
        )}
      </p>
    </div>
  );
}
