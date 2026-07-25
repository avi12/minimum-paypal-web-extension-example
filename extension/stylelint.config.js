import postcssHtml from "postcss-html";

export default {
  extends: ["stylelint-config-ccb"],
  customSyntax: postcssHtml,
  ignoreFiles: ["build/**", "node_modules/**", ".output/**", ".wxt/**", "**/*.svg"],
  rules: {
    "@stylistic/linebreaks": null,
    "a11y/font-size-is-readable": null,
    "a11y/no-spread-text": null,
    "at-rule-allowed-list": null,
    "at-rule-descriptor-value-no-unknown": null,
    "color-format/format": null,
    "color-no-hex": null,
    "csstools/value-no-unknown-custom-properties": null,
    "csstree/validator": null,
    "declaration-no-important": null,
    "declaration-property-max-values": null,
    "declaration-property-unit-allowed-list": null,
    "declaration-property-value-allowed-list": null,
    "declaration-property-value-disallowed-list": null,
    "font-family-no-missing-generic-family-keyword": null,
    "function-disallowed-list": null,
    "matterialize/stylelint-require-units": null,
    "max-nesting-depth": [99, {}],
    "no-unknown-animations": null,
    "no-unknown-custom-properties": null,
    "plugin/no-low-performance-animation-properties": null,
    "plugin/no-unsupported-browser-features": null,
    "plugin/stylelint-no-indistinguishable-colors": null,
    "prettier/prettier": null,
    "property-disallowed-list": null,
    "selector-class-pattern": [null],
    "selector-max-attribute": null,
    "selector-max-id": null,
    "selector-max-pseudo-class": null,
    "selector-max-type": null,
    "selector-max-universal": null,
    "selector-nested-pattern": [null],
    "selector-no-qualifying-type": null,
    "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global"] }],
    "unit-disallowed-list": null
  },
  overrides: [
    {
      files: ["**/*.css"],
      customSyntax: "postcss"
    }
  ]
};
