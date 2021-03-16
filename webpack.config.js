const webpack = require('webpack');
const paths = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const tsTransformInferno = require('ts-transform-inferno').default;
const ts = require('typescript');

require('ts-transform-inferno/dist/updateSourceFile').default = tsTransformInfernoUpdateSourceFile;

/**
  @returns {webpack.Configuration}
*/
module.exports = (_env, { mode }) => ({
  mode,
  devtool: 'source-map',

  entry: {
    main: [
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
    filename: '[name].js?[contenthash]',
    chunkFilename: '[name].chunk.js?[contenthash]',
    assetModuleFilename: 'assets/[file]?[contenthash]',
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      inferno: `inferno/${mode === 'production' ? 'index' : 'dist/index.dev'}.esm.js`,
    },
  },

  module: {
    rules: [
      {
        test: /\.(?:js|ts)x?$/,
        include: paths.join(__dirname, 'src'),
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              getCustomTransformers: () => ({
                before: [tsTransformInferno()],
              }),
            },
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
        test: /\.json$/,
        include: [require.resolve('./src/icons_list.json')],
        use: [
          {
            loader: './bootstrap-icons-loader',
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

/**
  @param {ts.SourceFile} sourceFile
  @param {ts.TransformationContext} context
  @returns {ts.SourceFile}
*/
function tsTransformInfernoUpdateSourceFile(sourceFile, context) {
  /* eslint-disable no-undefined */
  let imports = [];
  for (let name of [
    'createFragment',
    'createVNode',
    'createComponentVNode',
    'createTextVNode',
    'normalizeProps',
  ]) {
    if (context[name]) {
      imports.push(ts.createImportSpecifier(undefined, ts.createIdentifier(name)));
    }
  }

  if (imports.length > 0) {
    sourceFile = ts.updateSourceFileNode(sourceFile, [
      ...sourceFile.statements,
      ts.createImportDeclaration(
        undefined,
        undefined,
        ts.createImportClause(undefined, ts.createNamedImports(imports)),
        ts.createLiteral('inferno'),
      ),
    ]);
  }

  return sourceFile;
  /* eslint-enable no-undefined */
}
