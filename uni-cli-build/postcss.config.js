// postcss-loader 在没有显式 options 时会自动寻找配置文件，找不到会直接报错。
// uni-app 的 px→rpx 等处理是在 webpack 里单独完成的，这里只需给出一个合法配置。
module.exports = {
  plugins: {},
}
