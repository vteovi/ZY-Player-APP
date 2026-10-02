const plugins = []

module.exports = {
  presets: [
    [
      '@vue/app',
      {
        modules: 'commonjs',
        useBuiltIns: 'usage',
        corejs: 3
      }
    ]
  ],
  plugins
}
