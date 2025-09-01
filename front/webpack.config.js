const path = require('path');
// 引入HTML插件
const HtmlWebpackPlugin = require('html-webpack-plugin');
// 引入清理插件，用于每次构建前清理dist目录
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.[contenthash].js', // 添加contenthash用于缓存控制
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/' // 确保资源路径正确
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist') // 更明确的静态目录配置
    },
    port: 8080,
    open: true,
    historyApiFallback: true,
    hot: true, // 启用热模块替换
    client: {
      overlay: true, // 错误信息显示在浏览器页面上
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]]
          }
        }
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          // 指定图片输出路径
          filename: 'assets/images/[hash][ext][query]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          // 指定字体输出路径
          filename: 'assets/fonts/[hash][ext][query]'
        }
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      // 添加路径别名，方便导入
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@utils': path.resolve(__dirname, 'src/utils')
    }
  },
  plugins: [
    // 清理dist目录
    new CleanWebpackPlugin(),
    // 生成HTML文件
    new HtmlWebpackPlugin({
      title: 'Smart Fox App', // 页面标题
      template: path.resolve(__dirname, 'public/index.html'), // 模板文件路径
      filename: 'index.html', // 输出文件名
      favicon: path.resolve(__dirname, 'public/favicon.ico'), // 可选：添加favicon
      minify: {
        collapseWhitespace: process.env.NODE_ENV === 'production', // 生产环境压缩空格
        removeComments: process.env.NODE_ENV === 'production' // 生产环境移除注释
      }
    })
  ],
  // 开发工具配置，生产环境会自动禁用
  devtool: 'inline-source-map'
};
