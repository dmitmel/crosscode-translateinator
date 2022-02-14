const webpack = require('webpack');
const paths = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const packageJson = require('./package.json');

/**
  @returns {webpack.Configuration}
*/
module.exports = (_env, { mode }) => ({
  mode,
  devtool: 'source-map',

  entry: {
    main: [
      mode === 'development' ? 'preact/debug' : 'preact/devtools',
      './src/main',
      'crosscode-localization-engine/build/Release/crosslocale.node',
      `crosscode-localization-engine/build/Release/${
        {
          linux: 'libcrosslocale.so',
          darwin: 'libcrosslocale.dylib',
          win32: 'crosslocale.dll',
        }[process.platform]
      }`,
    ],
  },
  target: 'nwjs0.35',
  output: {
    path: paths.join(__dirname, 'target', mode),
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
    assetModuleFilename: '[base]',
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },

  module: {
    rules: [
      {
        test: /\.(?:js|ts)x?$/,
        include: paths.join(__dirname, 'src'),
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },

      {
        test: /\.s?css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
            // options: {
            //   importLoaders: 1,
            // },
          },
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                indentedSyntax: false,
                outputStyle: mode === 'production' ? 'compressed' : 'expanded',
              },
            },
          },
        ],
      },

      {
        test: /\.(?:png|jpe?g|gif|svg|eot|ttf|woff2?)$/,
        type: 'asset/resource',
      },

      {
        test: /\.(node|so|dylib|dll)$/,
        type: 'asset/resource',
        generator: { filename: '[base]' },
      },
    ],
  },

  plugins: [
    new webpack.ProgressPlugin(),

    new CleanWebpackPlugin(),

    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[name].chunk.css',
    }),

    new HtmlWebpackPlugin({
      filename: '[name].html',
      template: 'src/main.html',
      inject: 'body',
      scriptLoading: 'blocking',
    }),

    new webpack.DefinePlugin({
      'process.env': {
        npm_package_version: JSON.stringify(packageJson.version),
      },
    }),
  ],
});
