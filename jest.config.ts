import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Map @/* path aliases to the project root (mirrors tsconfig paths)
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Only transform project TS/TSX files — not node_modules
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Use node module resolution for tests (jest doesn't support bundler)
          moduleResolution: "node",
          esModuleInterop: true,
        },
      },
    ],
  },
  // Test file patterns
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.spec.ts",
  ],
  // Exclude Next.js build output and node_modules
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  // Add test script to package.json separately
  collectCoverageFrom: [
    "lib/auth/**/*.ts",
    "!lib/auth/**/*.test.ts",
    "!lib/auth/__tests__/**",
  ],
};

export default config;
