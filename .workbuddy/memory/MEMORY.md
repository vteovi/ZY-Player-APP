# ZY Player 项目备忘

- 这是一个 HBuilderX 结构的 uni-app **vue2** 项目（作者 Hunlongyu，2022），含 uview-ui 1.8.1 / uni-ajax / fast-xml-parser。
- **仓库自带 `unpackage/dist/build/app-plus` 是过期的**，别直接拿去离线打包；要用 `uni-cli-build/` 重新编译。
- 本机编译链路已配好：`uni-cli-build/`（uni-app CLI，引擎 5.24 配套版 `2.0.2-5020420260813001`）+ `android-package/`（DCloud HBuilder-Integrate-AS 离线打包）。
- 一键流程：先 `uni-cli-build` 编译 → 拷 `dist/*` 到 `android-package/simpleDemo/src/main/assets/apps/<appid>/www/` → `cd android-package && ./gradlew :simpleDemo:assembleRelease`。
- 包名 `com.zyplayer.app`，签名 `simpleDemo/test.jks`（key0/123456），**appid `__UNI__3C9920B`**（用户自己的 DCloud 应用，已从原作者 `__UNI__B85B395` 迁移过来）。
- Android AppKey 写在 `android-package/simpleDemo/src/main/AndroidManifest.xml` 的 `dcloud_appkey`。换了包名/SHA1 后 AppKey 会变，必须重新生成回填。
- 2026-09-28 产出 `ZY-Player-0.1.2-release.apk`（30.7MB，appkey `cf6550b4...`，四要素已回读校验一致）。
- 内置视频源 `utils/initSite.json`（72 条，启用 15 条，来自 zyfun 导出配置）。
  **ZY Player 原版只支持 XML 接口，request.js 已扩展支持 json 接口**（site.type 区分）。
  换源后必须卸载重装才会生效（db.init 只在无数据时写入）。
- **不使用内置播放器**：`pages/play/play.vue` 已弃用 `<video>`，改用 Android Intent
  `ACTION_VIEW` + `video/*` 调起第三方播放器（MX Player/VLC）。因此 manifest 的
  `app-plus.modules` 为空，**不要**再往 `simpleDemo/libs/` 塞 videoplayer/media aar。
  代价：播放进度无法回传，续播时间不再更新。
- 常用工具：`uni-cli-build/probe_sites.js`（zyfun 配置 → initSite.json，带可用性探测）、
  `test_json_api.js`（验证 json 接口解析）。
- 用户习惯把成品 APK 放在 `D:/APK/`（见其 TVBox 系列命名：`TVBox-Mobile-vX.Y.Z-release.apk`）。
- 2026-09-28 产出 `ZY-Player-0.1.2-release.apk`（30.8MB，appkey `cf6550b4...`，四要素已回读校验一致）。
- **编译后必须确认 www 里有 `app-view.js`**（应约 180KB）。缺它会导致卡启动页转圈——详见 2026-09-28 日志。
  该问题由 sass-loader 8 + dart-sass 1.32 在 Windows 的 URI 不兼容引起，已 patch
  `uni-cli-build/node_modules/@dcloudio/vue-cli-plugin-uni/packages/sass-loader/dist/webpackImporter.js`；
  **重装 node_modules 后需重新打该 patch**，配套还有 `uni-cli-build/postcss.config.js` 和
  `vue.config.js` 里补的 `prependData`（theme.scss 绝对路径）。
