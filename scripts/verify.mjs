/**
 * 작업 중 검증 게이트를 한 번에 돌린다 (TASK-105).
 *
 * ## 왜 스크립트인가
 *
 * `lint` 12초 + `test` 17초를 순차로 돌리면 29초인데 둘은 서로를 기다릴 이유가 없다.
 * 겹치면 18초다. npm 스크립트에 `&`·`wait` 을 쓰면 Windows 에서 cmd.exe 가 받아
 * 깨지므로(이 저장소의 `script-shell` 은 비어 있다) 자식 프로세스로 띄운다.
 *
 * ## 쓰는 법
 *
 * ```bash
 * npm run verify        # lint + test  (작업 중)
 * npm run verify -- --all   # + typecheck + build  (커밋 직전 한 번)
 * ```
 *
 * `--all` 을 작업 중에 돌리지 말 것 — `build` 하나가 26초이고, 실행 중인
 * `next start` 가 사라진 CSS 청크를 가리키게 되어 속도 측정을 무의미하게 만든다.
 */

import { spawn } from "node:child_process";

const all = process.argv.includes("--all");

/** 작업 중 게이트. 서로 독립이라 병렬로 돈다. */
const CONCURRENT = ["lint", "test"];

/** 커밋 직전 게이트. `build` 가 `.next` 를 쓰므로 순차로 돈다. */
const SEQUENTIAL = ["typecheck", "build"];

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(script) {
  return new Promise((resolve) => {
    const started = Date.now();
    // 인자를 배열로 넘기면서 `shell: true` 를 켜면 Node 가 DEP0190 을 낸다.
    // 스크립트 이름은 이 파일 안의 상수뿐이라 한 문장으로 합쳐 넘긴다.
    const child = spawn(`${npm} run ${script}`, { shell: true });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`${code === 0 ? "✔" : "✘"} ${script} (${seconds}초)`);
      resolve({ script, code, output });
    });
  });
}

/** 실패한 것만 로그를 편다 — 통과한 게이트의 출력은 읽을 이유가 없다. */
function report(results) {
  const failed = results.filter((r) => r.code !== 0);
  for (const r of failed) {
    console.log(`\n${"─".repeat(60)}\n${r.script}\n${"─".repeat(60)}`);
    console.log(r.output.trimEnd());
  }
  return failed.length;
}

const results = await Promise.all(CONCURRENT.map(run));

if (all) {
  for (const script of SEQUENTIAL) results.push(await run(script));
}

process.exit(report(results) > 0 ? 1 : 0);
