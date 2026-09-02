import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/**/*.test.ts", "apps/desktop/src/**/*.test.{ts,tsx}"]
  }
});
