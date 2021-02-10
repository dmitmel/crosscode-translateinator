const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

/**
 * @returns {webpack.Configuration}
 */
module.exports = (_env, { mode }) => ({
  mode,
  devtool: 'source-map',

  entry: './src/main',
  target: 'nwjs0.35',
  output: {
    path: path.join(__dirname, 'target', mode),
    filename: '[name].js?[contenthash]',
    chunkFilename: '[name].chunk.js?[contenthash]',
    assetModuleFilename: 'assets/[file]?[contenthash]',
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      inferno: `inferno/${mode === 'production' ? 'index' : 'dist/index.dev'}.esm.js`,
      'inferno-create-element': `inferno-create-element/dist/index${
        mode === 'production' ? '' : '.dev'
      }.esm.js`,
    },
  },

  module: {
    rules: [
      {
        test: /\.(?:js|ts)x?$/,
        include: path.join(__dirname, 'src'),
        exclude: /node_modules/,
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
          },
        ],
      },

      {
        test: /\.(?:png|jpe?g|gif|svg|eot|ttf|woff2?)$/i,
        type: 'asset/resource',
      },
    ],
  },

  plugins: [
    new webpack.ProgressPlugin(),

    new CleanWebpackPlugin(),

    new webpack.ProvidePlugin({
      jsx: [path.join(__dirname, 'src', 'jsx'), 'default'],
    }),

    new MiniCssExtractPlugin({
      filename: '[name].css?[contenthash]',
      chunkFilename: '[name].chunk.css?[contenthash]',
    }),

    new HtmlWebpackPlugin({
      filename: '[name].html?[contenthash]',
      template: 'src/main.html',
      inject: 'body',
      scriptLoading: 'blocking',
    }),
  ].filter((p) => p != null),
});
