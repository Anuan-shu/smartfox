const { defineConfig } = require("cypress");
// Use the project's webpack config so component tests inherit the same loaders (JSX/CSS/etc.)
const webpackConfig = require('./webpack.config');

module.exports = defineConfig({
  component: {
    devServer: {
      framework: "react",
      bundler: "webpack",
      webpackConfig,
    },
  },
});
