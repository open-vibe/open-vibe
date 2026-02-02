module.exports = {
  extends: ["./.eslintrc.cjs", "plugin:prettier/recommended"],
  rules: {
    "prettier/prettier": [
      "error",
      {
        semi: false,
        singleQuote: false,
        trailingComma: "all",
        printWidth: 100,
        tabWidth: 2,
        bracketSpacing: true,
        arrowParens: "always",
        endOfLine: "lf",
      },
    ],
  },
};
