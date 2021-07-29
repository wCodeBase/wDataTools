const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const isAnalyze = process.env.M_NODE_ENV === "analyze";
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const distRoot = path.resolve(__dirname, "../dist/");

const test = false;

module.exports = {
  entry: {
    main: "./src/main.ts",
    electronMain: "./src/electronMain.ts",
  },
  mode: test ? "development" : "production",
  externals: {
    "better-sqlite3": "commonjs2 better-sqlite3",
    electron: "commonjs2 electron",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
      {
        test: /node_modules\/typeorm\/driver\/.*\//,
        exclude: /sqlite/,
        use: {
          loader: path.resolve(__dirname, "./blankJsLoader.js"),
        },
      },
      {
        test: /node_modules\/highlight.js\//,
        use: {
          loader: path.resolve(__dirname, "./blankJsLoader.js"),
        },
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: "all",
    },
    ...(test
      ? {}
      : {
          minimize: true,
          minimizer: [
            new TerserPlugin({
              minify: (file, sourceMap) => {
                // https://github.com/mishoo/UglifyJS2#minify-options
                const uglifyJsOptions = {
                  /* your `uglify-js` package options */
                };

                if (sourceMap) {
                  uglifyJsOptions.sourceMap = {
                    content: sourceMap,
                  };
                }

                return require("uglify-js").minify(file, uglifyJsOptions);
              },
            }),
          ],
        }),
  },
  plugins: [
    ...(isAnalyze ? [new BundleAnalyzerPlugin({ analyzerPort: 10049 })] : []),
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true,
      entryOnly: true,
    }),
  ],
  output: {
    filename: "[name].js",
    path: distRoot,
    clean: false,
  },
  target: "node",
  ...(test
    ? {
        devtool: "inline-source-map",
      }
    : {}),
};
