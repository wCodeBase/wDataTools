module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["prettier", "typescript", "@typescript-eslint", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  env: {
    node: true,
  },
  rules: {
    "prettier/prettier": "error",
    "react-hooks/rules-of-hooks": "error",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "no-async-promise-executor": "off",
    "no-control-regex": "off",
    "no-constant-condition": "off",
    "@typescript-eslint/no-this-alias": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { vars: "all", args: "after-used", ignoreRestSiblings: true },
    ],
  },
};
