import stylistic from "@stylistic/eslint-plugin";
import importNewlines from "eslint-plugin-import-newlines";
import perfectionist from "eslint-plugin-perfectionist";
import svelteEslint from "eslint-plugin-svelte";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import svelteParser from "svelte-eslint-parser";
import tsEslint from "typescript-eslint";

const sharedRules = {
  "@stylistic/arrow-parens": ["error", "as-needed"],
  "@stylistic/brace-style": "error",
  "@stylistic/comma-dangle": ["error", "never"],
  "@stylistic/eol-last": ["error", "always"],
  "@stylistic/indent": ["error", 2],
  "@stylistic/max-len": ["error", { code: 120, ignoreUrls: true }],
  "@stylistic/object-curly-spacing": ["error", "always"],
  "@stylistic/quotes": ["error", "double", { allowTemplateLiterals: "always" }],
  "@stylistic/semi": ["error"],
  "@typescript-eslint/naming-convention": [
    "error",
    {
      selector: "interface",
      format: ["PascalCase"],
      custom: { regex: "^I[A-Z]", match: false }
    }
  ],
  "import-newlines/enforce": ["error", { items: 4, "max-len": 120, forceSingleLine: true }],
  "perfectionist/sort-imports": ["error", { type: "alphabetical", order: "asc", newlinesBetween: "ignore" }],
  "perfectionist/sort-named-imports": ["error", { type: "alphabetical", order: "asc", ignoreCase: true }]
};

const plugins = {
  "@stylistic": stylistic,
  "@typescript-eslint": tsEslint.plugin,
  "import-newlines": importNewlines,
  perfectionist
};

export default [
  ...svelteEslint.configs["flat/recommended"],
  globalIgnores([".output/", ".wxt/", "build/", "node_modules/"]),
  {
    files: ["**/*.{ts,js}"],
    languageOptions: {
      parser: tsEslint.parser,
      globals: { ...globals.browser, browser: "readonly", chrome: "readonly" }
    },
    plugins,
    rules: sharedRules
  },
  {
    files: ["**/*.config.{ts,js}"],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tsEslint.parser, extraFileExtensions: [".svelte"] },
      globals: { ...globals.browser, browser: "readonly", chrome: "readonly" }
    },
    plugins,
    rules: {
      ...sharedRules,
      "svelte/first-attribute-linebreak": "error",
      "svelte/indent": ["error", { indent: 2 }],
      "svelte/shorthand-attribute": ["error", { prefer: "always" }],
      "svelte/shorthand-directive": "error",
      "svelte/sort-attributes": "error"
    }
  }
];
