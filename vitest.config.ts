import path from "path";
import { defineConfig } from "vitest/config";

// solar-math.ts imports cost-defaults via the `@/` alias, so the test runner
// needs the same alias the app uses (tsconfig paths → project root).
export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
