import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    /**
     * 만세력 테스트는 1900~2100 을 전수 대조하므로 개별 테스트가 수 초씩 걸린다
     * (로컬에서 월주 대조 약 3.9초). 기본값 5초로 두면 병렬 실행 시 CPU 경합만으로
     * 타임아웃이 나 **플래키 테스트**가 된다. CI 러너는 더 느리므로 넉넉히 준다.
     */
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      // `import "server-only"` 는 기본 조건에서 예외를 던진다. Next 는 번들러가 이를
      // 빈 모듈로 치환하는데, 테스트에서도 같은 처리가 필요하다.
      // (조건부 export 를 건드리는 대신 명시적으로 별칭을 준다)
      "server-only": `${projectRoot}node_modules/server-only/empty.js`,
      "@": projectRoot.replace(/\/$/, ""),
    },
  },
});
