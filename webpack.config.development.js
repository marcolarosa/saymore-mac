/* eslint-disable max-len */
/**
 * Build config for development process that uses Hot-Module-Replacement
 * https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
 */

const webpack = require("webpack");
const merge = require("webpack-merge");
const baseConfig = require("./webpack.config.base");
const {
  BugsnagSourceMapUploaderPlugin,
  BugsnagBuildReporterPlugin
} = require("webpack-bugsnag-plugins");
const port = process.env.PORT || 3000;

module.exports = merge(baseConfig, {
  mode: "development",
  //  devtool: "inline-source-map",
  devtool: "source-map", //bugsnag wanted this https://github.com/bugsnag/bugsnag-js/issues/147

  entry: [
    "react-hot-loader/patch",
    `webpack-hot-middleware/client?path=http://localhost:${port}/__webpack_hmr&reload=true`,
    "./app/index"
  ],

  output: {
    publicPath: `http://localhost:${port}/dist/`
  },

  module: {
    // preLoaders: [
    //   {
    //     test: /\.js$/,
    //     loader: 'eslint-loader',
    //     exclude: /node_modules/
    //   }
    // ],
    rules: [
      // Add SASS support  - compile all .global.scss files and pipe it to style.css
      {
        test: /\.global\.scss$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              sourceMap: true
            }
          },
          {
            loader: "sass-loader"
          }
        ]
      },
      // Add SASS support  - compile all other .scss files and pipe it to style.css
      {
        test: /^((?!\.global).)*\.scss$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              modules: false,
              sourceMap: true,
              importLoaders: 1,
              localIdentName: "[name]__[local]__[hash:base64:5]"
            }
          },
          {
            loader: "sass-loader"
          }
        ]
      },
      // WOFF Font
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "application/font-woff"
          }
        }
      },
      // WOFF2 Font
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "application/font-woff"
          }
        }
      },
      // TTF Font
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "application/octet-stream"
          }
        }
      },
      // EOT Font
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        use: "file-loader"
      },
      // SVG Font
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "image/svg+xml"
          }
        }
      }
    ]
  },

  plugins: [
    // https://webpack.github.io/docs/hot-module-replacement-with-webpack.html
    new webpack.HotModuleReplacementPlugin(),

    new webpack.NoEmitOnErrorsPlugin(),

    // // NODE_ENV should be production so that modules do not perform certain development checks
    // new webpack.DefinePlugin({
    //   "process.env.NODE_ENV": JSON.stringify("development")
    // }),

    new webpack.LoaderOptionsPlugin({
      debug: true
    })

    // new BugsnagBuildReporterPlugin(
    //   {
    //     apiKey: "f8b144863f4723ebb4bdd6c747c5d7b6",
    //     appVersion: "0.0.0", // TODO
    //     releaseStage: "dev"
    //     //sourceControl: { provider: "github",  }
    //   }, //build
    //   {} // opts),
    // ),
    // // It's a good idea to only run this plugin when you're building a bundle
    // // that will be released, rather than for every development build
    // new BugsnagSourceMapUploaderPlugin({
    //   apiKey: "f8b144863f4723ebb4bdd6c747c5d7b6",
    //   appVersion: "0.0.0", // TODO
    //   overwrite: true
    // })
  ],

  // https://github.com/chentsulin/webpack-target-electron-renderer#how-this-module-works
  target: "electron-renderer"
});
