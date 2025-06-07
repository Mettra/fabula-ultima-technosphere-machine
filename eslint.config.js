import js from "@eslint/js";
import noFloatingPromise from "eslint-plugin-no-floating-promise";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["scripts/**/*.{js,ts,tsx}", "scripts/*.{js,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "no-floating-promise": noFloatingPromise
    },
    rules: {
      "no-floating-promise/no-floating-promise": "error"
      // Add TypeScript-specific rules here if needed
    }
  }
];
