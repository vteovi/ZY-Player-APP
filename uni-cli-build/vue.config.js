const path = require('path')

// uview 组件的样式全靠 $u-* 主题变量，必须注入到每一个 scss 里，否则报 Undefined variable。
// 这里直接注入 theme.scss 的绝对路径，而不是走 uni-app 默认的 "@/uni.scss" ——
// 原因见 MEMORY.md：sass importer 在 Windows 下解析 node_modules 包路径会失败。
const themeScssPath = path.resolve(__dirname, 'node_modules/uview-ui/theme.scss')
  .replace(/\\/g, '/')

module.exports = {
  transpileDependencies: ['uni-ajax', 'uview-ui'],
  css: {
    loaderOptions: {
      // 注意：vue-cli 里 scss 的配置取的是 `loaderOptions.scss || loaderOptions.sass`（二选一，
      // 见 @vue/cli-service/lib/config/css.js）。一旦这里配了 scss，uni-app 注入在
      // loaderOptions.sass.prependData 的 uni.scss 就会被整体覆盖丢失，所以必须补回来。
      scss: {
        implementation: require('sass'),
        prependData: `@import "${themeScssPath}";`,
      },
    },
  },
}
