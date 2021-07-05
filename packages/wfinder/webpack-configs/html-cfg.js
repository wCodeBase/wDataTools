const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const mode = process.env.WebpackMode;
const isDev = mode === "development";
const distHtmlRoot = path.resolve(__dirname, "../dist/ui/html/");
const setting = require("./setting");

module.exports = {
  entry: "./src/ui/html/index.tsx",
  mode,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "[name].[contenthash].js",
    path: distHtmlRoot,
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: "./src/ui/html/index.html",
    }),
  ],
  ...(!isDev
    ? {}
    : {
        devtool: "inline-source-map",
        devServer: {
          contentBase: distHtmlRoot,
          compress: false,
          port: setting.devServerPort,
        },
      }),
};
