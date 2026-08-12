// eslint-config-next 16 은 flat config 배열을 그대로 내보낸다 (FlatCompat 불필요).
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescriptConfig,
];

export default eslintConfig;
