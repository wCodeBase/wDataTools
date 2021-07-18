const colors = require("tailwindcss/colors");
const _ = require("lodash");

const range = _.rangeRight(1, 11);
const genPairs = (subffix = "%", fractionPrefix = "") =>
  Array.from(
    new Map(
      _.flatten(
        range.map((n, i) =>
          range.map((d) => [
            (n / d) * 100 + subffix,
            `${fractionPrefix}${n}/${d}`,
          ])
        )
      )
    )
  ).map((v) => v.reverse());
const percentPairs = genPairs();
const percents = _.fromPairs(percentPairs);
const negPercentPairs = percentPairs.map((v) => v.map((n) => "-" + n));
const negPercents = _.fromPairs(negPercentPairs);
const screenWidths = _.fromPairs(genPairs("vw", "vw"));
const screenHeights = _.fromPairs(genPairs("vh", "vh"));

const percent25 = _.fromPairs(
  _.range(0, 3.1, 0.25)
    .map((v) => v * 100)
    .map((v) => [v, v + "%"])
);

module.exports = {
  purge: ["./src/ui/html/**/*.{js,jsx,ts,tsx,html}"],
  darkMode: false,
  theme: {
    extend: {
      colors,
      padding: {
        ...percents,
      },
      margin: {
        ...percents,
        ...negPercents,
      },
      spacing: {
        ...screenWidths,
        ...screenHeights,
      },
      scale: {
        ...percent25,
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
