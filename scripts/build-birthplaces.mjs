/**
 * 출생지 경도표 생성기 (TASK-37).
 *
 * `lib/form/birthplaces.ts` 를 만든다. **결과물을 커밋하므로 배포에 이 스크립트가 필요 없다**
 * — `scripts/render-icons.mjs` 와 같은 방식이다. 표를 다시 만들 때만 실행한다.
 *
 *   node scripts/build-birthplaces.mjs
 *
 * ## 출처
 *
 * 통계청(KOSTAT) **센서스용 행정구역경계 2013** 을 GeoJSON 으로 옮긴 공개 저장소에서 받는다.
 *   https://github.com/southkorea/southkorea-maps  (kostat/2013, 라이선스: "Free to share or remix")
 *   kostat/2013/json/skorea_municipalities_geo_simple.json  (시군구 251개)
 *
 * 경도는 **행정구역 경계의 면적가중 중심점**에서 계산한다. 시청 좌표를 손으로 옮기지
 * 않는 이유는 그것이 곧 눈대중이기 때문이다 — 경계에서 계산하면 출처 하나로 전부 설명된다.
 *
 * ## 묶는 단위 — 시/군 + 광역시는 구만 통째
 *
 * 광역시·특별시는 **구를 합치고 군(郡)은 따로 둔다.** 구만 보면 동서 폭이 0.14~0.32°
 * (0.6~1.3분)라 나눌 값이 없지만, 군은 시가지에서 멀리 떨어져 있어 이야기가 다르다 —
 * **인천은 군까지 합치면 폭이 1.25°(5.0분)로 벌어진다** (옹진군이 백령도까지 품는다).
 * 군을 떼면 0.25°(1분)로 다른 광역시와 같아진다.
 *
 * 도(道) 지역은 시/군까지 남기되, 통합시의 구(`수원시장안구` 같은 이름)는 모(母)시로
 * 합친다. 근거 표는 `docs/saju-validation.md`.
 */
import { writeFileSync } from "node:fs";

const SOURCE_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json";

const SOURCE_LABEL = "통계청 센서스용 행정구역경계 2013 (southkorea-maps, kostat/2013)";

/**
 * 시/도 코드 → 표시 이름. **좌표가 아니라 이름이므로 여기 적는다.**
 * 코드는 위 자료의 `code` 앞 두 자리이며, 아래 검사가 자료의 코드 집합과 대조한다.
 */
const SIDO = {
  11: { name: "서울", wide: true },
  21: { name: "부산", wide: true },
  22: { name: "대구", wide: true },
  23: { name: "인천", wide: true },
  24: { name: "광주", wide: true },
  25: { name: "대전", wide: true },
  26: { name: "울산", wide: true },
  29: { name: "세종", wide: true },
  31: { name: "경기", wide: false },
  32: { name: "강원", wide: false },
  33: { name: "충북", wide: false },
  34: { name: "충남", wide: false },
  35: { name: "전북", wide: false },
  36: { name: "전남", wide: false },
  37: { name: "경북", wide: false },
  38: { name: "경남", wide: false },
  // 제주는 광역이지만 제주시·서귀포시로 나눈다 — 섬 동서 폭이 0.75°(3분)라 합치면 손해다.
  39: { name: "제주", wide: false },
};

/** 링 하나의 면적과 면적가중 중심 x (신발끈 공식). 구멍(hole)은 무시한다 — 오차가 무의미하다. */
function ringCentroid(ring) {
  let twiceArea = 0;
  let cx = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
  }
  const area = twiceArea / 2;
  if (area === 0) return null;
  return { area: Math.abs(area), x: cx / (6 * area) };
}

/** 피처 하나의 (면적, 면적×중심경도) 누적값 */
function featureWeight(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let area = 0;
  let weighted = 0;
  for (const rings of polygons) {
    const centroid = ringCentroid(rings[0]);
    if (!centroid) continue;
    area += centroid.area;
    weighted += centroid.area * centroid.x;
  }
  return { area, weighted };
}

/**
 * 통합시의 구를 모시로 합친다 — `수원시장안구` → `수원시`.
 * 게으른 수량자라 `고양시일산서구` 도 `고양시` 로 잘린다 (탐욕적이면 `고양시일산서` 가 된다).
 */
function baseName(name) {
  const match = /^(.+?시)(.+구)$/.exec(name);
  return match ? match[1] : name;
}

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`자료를 받지 못했습니다: ${response.status} ${SOURCE_URL}`);
}
const geo = await response.json();

// 자료의 시/도 코드가 위 표와 정확히 일치하는지 먼저 본다. 어긋나면 자료가 바뀐 것이다.
const codesInData = new Set(geo.features.map((f) => Number(f.properties.code.slice(0, 2))));
const codesInTable = new Set(Object.keys(SIDO).map(Number));
const missing = [...codesInData].filter((c) => !codesInTable.has(c));
const extra = [...codesInTable].filter((c) => !codesInData.has(c));
if (missing.length || extra.length) {
  throw new Error(`시/도 코드가 어긋납니다 — 자료에만: ${missing} / 표에만: ${extra}`);
}

/** key = `${시도코드}:${표시명}` */
const groups = new Map();

for (const feature of geo.features) {
  const code = Number(feature.properties.code.slice(0, 2));
  const sido = SIDO[code];
  const raw = feature.properties.name;

  // 광역시라도 군(郡)은 합치지 않는다 — 위 주석의 인천 사례.
  const name = sido.wide && !raw.endsWith("군") ? sido.name : baseName(raw);
  const key = `${code}:${name}`;

  const { area, weighted } = featureWeight(feature.geometry);
  const group = groups.get(key) ?? { code, sido: sido.name, name, area: 0, weighted: 0 };
  group.area += area;
  group.weighted += weighted;
  groups.set(key, group);
}

const rows = [...groups.values()]
  .map((group) => ({
    sido: group.sido,
    name: group.name,
    // 소수 둘째 자리까지만 쓴다. 0.01° = 0.04분이고 보정은 분 단위로 반올림되므로
    // 그 아래는 없는 정확도를 있는 척하는 것이다.
    longitude: Math.round((group.weighted / group.area) * 100) / 100,
  }))
  .sort((a, b) => {
    const order = Object.values(SIDO).map((s) => s.name);
    const bySido = order.indexOf(a.sido) - order.indexOf(b.sido);
    return bySido !== 0 ? bySido : a.name.localeCompare(b.name, "ko");
  });

// 스키마가 받는 범위를 벗어나면 폼에서 고를 수 없는 항목이 생긴다.
const outOfRange = rows.filter((r) => r.longitude < 124 || r.longitude > 132);
if (outOfRange.length) {
  throw new Error(`경도 범위(124~132)를 벗어남: ${JSON.stringify(outOfRange)}`);
}

const sidoOrder = Object.values(SIDO).map((s) => s.name);
const body = rows
  .map((r) => `  { sido: "${r.sido}", name: "${r.name}", longitude: ${r.longitude} },`)
  .join("\n");

const output = `/**
 * 출생지별 경도표 — **자동 생성 파일이다. 손으로 고치지 말 것.**
 *
 *   node scripts/build-birthplaces.mjs
 *
 * 출처: ${SOURCE_LABEL}
 * ${SOURCE_URL}
 *
 * 경도는 행정구역 경계의 **면적가중 중심점**이며 소수 둘째 자리까지만 쓴다
 * (0.01° = 0.04분 · 보정은 분 단위로 반올림된다). 광역시·특별시는 구를 나누지 않고,
 * 도 지역은 시/군까지 두되 통합시의 구는 모시로 합쳤다. 근거는 \`docs/saju-validation.md\`.
 *
 * 클라이언트에서 import 하므로 \`server-only\` 를 붙이지 않는다.
 */

export interface Birthplace {
  /** 시/도 표시명 (2단계 선택의 1단계) */
  sido: string;
  /** 시/군 표시명. 광역시는 시/도 이름과 같다 */
  name: string;
  /** 면적가중 중심점의 경도(도) */
  longitude: number;
}

/** 시/도 표시 순서 — 자료 코드 순(서울→제주)이다. */
export const BIRTHPLACE_SIDO = [
${sidoOrder.map((n) => `  "${n}",`).join("\n")}
] as const;

export const BIRTHPLACES: readonly Birthplace[] = [
${body}
];
`;

writeFileSync(new URL("../lib/form/birthplaces.ts", import.meta.url), output, "utf8");

console.log(`${rows.length}개 항목을 lib/form/birthplaces.ts 에 썼습니다.`);
for (const sido of sidoOrder) {
  const count = rows.filter((r) => r.sido === sido).length;
  console.log(`  ${sido}: ${count}`);
}
