// @ts-check
const webpack = require('webpack');
const paths = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ts = require('typescript');

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
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
    assetModuleFilename: '[base]',
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.(?:js|ts)x?$/,
        include: paths.join(__dirname, 'src'),
        use: [
          {
            loader: 'ts-loader',
            options: {
              getCustomTransformers: (/** @type {ts.Program} */ program) => ({
                before: [ts_assert_transformer(program)],
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
  ],
});

// Inspiration: <https://github.com/4Catalyzer/babel-plugin-dev-expression/blob/v0.2.2/dev-expression.js>
function ts_assert_transformer(/** @type {ts.Program} */ _program) {
  /* eslint-disable no-undefined */
  return (/** @type {ts.TransformationContext} */ context) => {
    let { factory } = context;

    /** @type {ts.UnscopedEmitHelper} */
    let throw_helper = {
      name: 'assert:throw',
      scoped: false,
      text: 'var __assert_throw = function(x) { throw x };',
    };

    let visitor = (/** @type {ts.Node} */ node) => {
      let /** @type {ts.CallExpression} */ call_expr = null;
      let is_statement = false;
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        is_statement = true;
        call_expr = node.expression;
      } else if (ts.isCallExpression(node)) {
        call_expr = node;
      }

      if (call_expr != null) {
        let callee = call_expr.expression;
        let args = call_expr.arguments;
        if (ts.isIdentifier(callee) && callee.text === 'ASSERT' && args.length >= 1) {
          let condition_expr = args[0];

          let inv_condition_expr = factory.createPrefixUnaryExpression(
            /*operator*/ ts.SyntaxKind.ExclamationToken,
            /*operand*/ condition_expr,
          );
          let error_expr = factory.createNewExpression(
            /*expression*/ factory.createIdentifier('Error'),
            /*typeArguments*/ undefined,
            /*argumentsArray*/ [
              factory.createBinaryExpression(
                /*left*/ factory.createStringLiteral('Assertion failed: '),
                /*operator*/ factory.createToken(ts.SyntaxKind.PlusToken),
                /*right*/ factory.createStringLiteral(condition_expr.getText()),
              ),
            ],
          );

          if (is_statement) {
            node = ts.setTextRange(
              factory.createIfStatement(
                /*expression*/ inv_condition_expr,
                /*thenStatement*/ ts.setTextRange(
                  factory.createThrowStatement(/*expression*/ error_expr),
                  call_expr,
                ),
                /*elseStatement*/ undefined,
              ),
              node,
            );
          } else {
            context.requestEmitHelper(throw_helper);
            node = ts.setTextRange(
              factory.createConditionalExpression(
                /*condition*/ inv_condition_expr,
                /*questionToken*/ undefined,
                /*whenTrue*/ ts.setTextRange(
                  factory.createCallExpression(
                    /*expression*/ factory.createIdentifier('__assert_throw'),
                    /*typeArguments*/ undefined,
                    /*argumentsArray*/ [error_expr],
                  ),
                  call_expr,
                ),
                /*colonToken*/ undefined,
                /*whenFalse*/ ts.setTextRange(factory.createVoidZero(), node),
              ),
              node,
            );
          }
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return (/** @type {ts.SourceFile} */ source_file) => {
      return ts.visitNode(source_file, visitor);
    };
  };
  /* eslint-enable no-undefined */
}
