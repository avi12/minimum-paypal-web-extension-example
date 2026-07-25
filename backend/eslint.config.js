import stylistic from "@stylistic/eslint-plugin";
import perfectionist from "eslint-plugin-perfectionist";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tsEslint from "typescript-eslint";

export default [
  globalIgnores(["convex/_generated/", "node_modules/"]),
  {
    files: ["**/*.{ts,js}"],
    languageOptions: {
      parser: tsEslint.parser,
      globals: globals.node
    },
    plugins: {
      "@stylistic": stylistic,
      perfectionist
    },
    rules: {
      "@stylistic/brace-style": "error",
      "@stylistic/comma-dangle": ["error", "never"],
      "@stylistic/eol-last": ["error", "always"],
      "@stylistic/indent": ["error", 2],
      "@stylistic/max-len": ["error", { code: 120, ignoreUrls: true }],
      "@stylistic/object-curly-spacing": ["error", "always"],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/semi": "error",
      "perfectionist/sort-imports": ["error", { type: "alphabetical", order: "asc", newlinesBetween: "ignore" }],
      "perfectionist/sort-named-imports": ["error", { type: "alphabetical", order: "asc", ignoreCase: true }]
    }
  }
];
