const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const mode = process.env.NODE_ENV || "production";
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
        use: [
          isDev
            ? {
                loader: "babel-loader",
                options: {
                  cacheDirectory: true,
                  babelrc: false,
                  presets: [
                    // [
                    //   "@babel/preset-env",
                    //   { targets: { browsers: "last 2 versions" } }
                    // ],
                    "@babel/preset-typescript",
                    "@babel/preset-react",
                  ],
                  plugins: [
                    ["@babel/plugin-proposal-decorators", { legacy: true }],
                    [
                      "@babel/plugin-proposal-class-properties",
                      { loose: true },
                    ],
                    "@babel/plugin-proposal-optional-chaining",
                    // "react-hot-loader/babel"  this line will make hmr not work in some custom hook.
                  ],
                },
              }
            : {
                loader: "ts-loader",
              },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
            },
          },
          {
            loader: "postcss-loader",
          },
        ],
      },
      {
        test: /\.css$/,
        include: /node_modules/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    ...(!isDev
      ? {}
      : {
          alias: {
            "react-dom": "@hot-loader/react-dom",
          },
        }),
    fallback: {
      path: require.resolve("path-browserify"),
    },
  },
  output: {
    filename: "[name].[contenthash].js",
    path: distHtmlRoot,
    clean: true,
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
          hot: true,
          port: setting.devServerPort,
        },
      }),
};
