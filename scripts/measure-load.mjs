/**
 * 느린 회선에서 첫 화면이 언제 그려지는지 잰다 (TASK-87).
 *
 * ## 왜 스크립트인가
 *
 * 웹폰트를 잴 때(TASK-75)는 손으로 쟀고, 그래서 **다시 재려면 조건을 기억해야 했다.**
 * `/` 에 사진 다섯 장이 붙은 뒤로 같은 질문이 되풀이될 자리라 수단을 남긴다 —
 * 조건이 코드에 있으면 다음 사람이 **같은 조건으로** 잰다.
 *
 * ## 쓰는 법
 *
 * ```bash
 * npm run build && npx next start -p 3100        # 다른 터미널에서 (프로덕션 빌드여야 한다)
 * node scripts/measure-load.mjs http://localhost:3100/
 * node scripts/measure-load.mjs <url> --dpr 3 --runs 3 --warm
 * ```
 *
 * **dev 서버로 재지 말 것.** 개발 빌드는 번들이 다르고 이미지 최적화도 요청마다 돌아
 * 숫자가 서비스와 무관해진다.
 *
 * 기본 조건은 **390×844 · DPR 2 · 1.6Mbps · RTT 150ms · 캐시 없음**이다. 앞의 둘은
 * `screenshot.mjs` 와 같고(모바일이 기본값), 뒤의 셋은 TASK-75 의 웹폰트 실측과 같다 —
 * **조건이 같아야 예전 값과 견줄 수 있다.**
 */

import { launch } from "./lib/cdp.mjs";

/** 1.6Mbps · RTT 150ms — TASK-75 에서 쓴 조건 그대로. */
const THROUGHPUT = (1.6 * 1024 * 1024) / 8;
const LATENCY = 150;

function parseArgs(argv) {
  const [url, ...rest] = argv;
  if (!url) {
    throw new Error(
      "사용법: node scripts/measure-load.mjs <url> [--width N] [--dpr N] [--runs N] [--warm] [--fast]",
    );
  }
  const flag = (name, fallback) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(rest[i + 1]);
  };
  return {
    url,
    width: flag("width", 390),
    height: flag("height", 844),
    dpr: flag("dpr", 2),
    runs: flag("runs", 3),
    /** 캐시를 살려 재방문을 잰다 (기본은 첫 방문). */
    warm: rest.includes("--warm"),
    /** 회선 조임을 끄고 잰다 — 조임이 원인인지 아닌지 가를 때. */
    fast: rest.includes("--fast"),
  };
}

/**
 * 페이지가 열리기 **전에** 심는다. `PerformanceObserver` 를 나중에 붙이면 이미 지나간
 * LCP 후보를 놓친다 (`buffered: true` 로도 일부만 잡힌다).
 */
const PROBE = `
  window.__perf = { lcp: null };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const el = entry.element;
      window.__perf.lcp = {
        time: entry.startTime,
        size: entry.size,
        url: entry.url || null,
        tag: el ? el.tagName : null,
        // 무엇이 LCP 인지 사람이 알아볼 수 있게 — 사진이면 파일 이름이, 글이면 앞머리가 남는다.
        hint: el ? (el.currentSrc || (el.textContent || "").trim().slice(0, 40)) : null,
      };
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
`;

const COLLECT = `
  (() => {
    const paint = performance.getEntriesByType("paint");
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = paint.find((e) => e.name === "first-contentful-paint");
    return JSON.stringify({
      fcp: fcp ? fcp.startTime : null,
      lcp: window.__perf.lcp,
      load: nav ? nav.loadEventEnd : null,
      resources: performance.getEntriesByType("resource").map((r) => ({
        name: r.name,
        end: r.responseEnd,
        transfer: r.transferSize,
        bytes: r.encodedBodySize,
      })),
    });
  })()
`;

const options = parseArgs(process.argv.slice(2));
const { send, close } = await launch();

function ms(value) {
  return value === null || value === undefined ? "—" : `${(value / 1000).toFixed(2)}초`;
}

function kb(value) {
  return `${Math.round(value / 1024)}KB`;
}

try {
  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.dpr,
    mobile: true,
  });

  const runs = [];
  for (let i = 0; i < options.runs; i += 1) {
    await send("Network.setCacheDisabled", { cacheDisabled: !options.warm });
    /* 첫 방문을 재는 회차마다 캐시를 비운다 — 안 그러면 2회차부터 재방문을 재게 된다. */
    if (!options.warm) await send("Network.clearBrowserCache");
    await send("Network.emulateNetworkConditions", {
      offline: false,
      latency: options.fast ? 0 : LATENCY,
      downloadThroughput: options.fast ? -1 : THROUGHPUT,
      uploadThroughput: options.fast ? -1 : THROUGHPUT / 2,
    });

    await send("Page.navigate", { url: "about:blank" });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
    await send("Page.navigate", { url: options.url });

    /*
     * `load` 를 기다리는 대신 **조용해질 때까지** 기다린다. 사진이 늦게 와도 잡히고,
     * 이벤트를 놓쳐 영원히 기다리는 경우가 없다. 1.6Mbps 에서 5초면 첫 화면 자산이 다 온다.
     */
    await new Promise((resolve) => setTimeout(resolve, options.fast ? 2500 : 8000));

    const { result } = await send("Runtime.evaluate", {
      expression: COLLECT,
      returnByValue: true,
    });
    runs.push(JSON.parse(result.value));
  }

  const label = [
    `${options.width}px · DPR ${options.dpr}`,
    options.fast ? "회선 조임 없음" : "1.6Mbps · RTT 150ms",
    options.warm ? "재방문(캐시 살림)" : "첫 방문(캐시 없음)",
  ].join(" · ");
  console.log(`\n${options.url}  —  ${label}  ·  ${options.runs}회\n`);

  for (const [i, run] of runs.entries()) {
    console.log(
      `${i + 1}회차  FCP ${ms(run.fcp)}  LCP ${ms(run.lcp?.time)}  load ${ms(run.load)}` +
        `  ← LCP: ${run.lcp?.tag ?? "?"} ${run.lcp?.hint ?? ""}`,
    );
  }

  const median = (values) => {
    const sorted = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  };
  console.log(
    `\n중앙값  FCP ${ms(median(runs.map((r) => r.fcp)))}` +
      `  LCP ${ms(median(runs.map((r) => r.lcp?.time)))}`,
  );

  /* 마지막 회차의 자산만 본다 — 회차마다 같은 목록이고 여러 벌 찍으면 읽기만 나빠진다. */
  const last = runs.at(-1);
  const assets = last.resources
    .filter((r) => /\/(cards|fonts)\/|_next\/image/.test(r.name))
    .sort((a, b) => b.end - a.end);
  if (assets.length) {
    console.log("\n사진·폰트 (도착 순 역순)");
    for (const asset of assets) {
      const name = decodeURIComponent(asset.name).replace(/^https?:\/\/[^/]+/, "");
      console.log(`  ${ms(asset.end).padStart(7)}  ${kb(asset.transfer).padStart(6)}  ${name.slice(0, 90)}`);
    }
    console.log(
      `  합계 ${kb(assets.reduce((sum, a) => sum + a.transfer, 0))} · ${assets.length}개`,
    );
  }
  console.log();
} finally {
  await close();
}
