const colors = require("tailwindcss/colors");

module.exports = {
  purge: ["./src/ui/html/**/*.{js,jsx,ts,tsx,html}"],
  darkMode: false,
  theme: {
    extend: {},
    colors,
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
