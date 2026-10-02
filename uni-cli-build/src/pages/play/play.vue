<template>
  <view class="play">
    <view class="play-box" @click="launchPlayer()">
      <view class="cover">
        <u-icon name="play-circle" color="#6dd143" size="120"></u-icon>
        <text class="tip">{{ name || detail.name || '视频' }}</text>
        <text class="sub">点击使用第三方播放器播放</text>
        <text class="sub sub-time" v-if="initialtime > 0">上次播放至 {{ formatTime(initialtime) }}</text>
      </view>
    </view>
    <view class="icon-box">
      <u-icon name="share" size="60" color="#1e88e5" style="margin-right: 30rpx"></u-icon>
      <u-icon v-if="!starShow" name="star" size="60" @click="addStar()"></u-icon>
      <u-icon v-if="starShow" name="star-fill" color="#ff4445" size="60" @click="removeStar()"></u-icon>
      <u-icon name="play-circle" size="70" color="#6dd143" @click="selectPlay()" style="margin-left: 30rpx" v-if="playList.length > 0"></u-icon>
    </view>
    <view class="box-info">
      <view class="name-box">
        <text class="name">{{ detail.name }}</text>
      </view>
      <view class="info-box">
        <text>{{ detail.area }}</text>
        <text class="gap">|</text>
        <text>{{ detail.lang }}</text>
        <text class="gap">|</text>
        <text>{{ detail.type }}</text>
        <text class="gap">|</text>
        <text>{{ detail.year }}</text>
        <text class="gap">|</text>
        <text>{{ detail.note }}</text>
      </view>
      <view class="info-box">
        <text>导演: {{ detail.director }}</text>
      </view>
      <view class="info-box">
        <text>演员: {{ detail.actor }}</text>
      </view>
      <view class="info-box">
        <text>简介: {{ detail.des }}</text>
      </view>
    </view>
    <u-select
      v-model="playShow"
      :list="playList"
      confirm-text="播放"
      @confirm="playConfirm"
    ></u-select>
    <u-toast ref="uToast" />
  </view>
</template>

<script>
import db from "../../utils/database.js";
import http from "../../utils/request.js";
export default {
  data() {
    return {
      siteKey: "",
      id: "",
      name: "",
      url: "",
      initialtime: 0,
      playShow: false,
      playList: [],
      detail: {},
      starShow: true
    };
  },
  methods: {
    formatTime(sec) {
      const s = parseInt(sec || 0, 10);
      if (!s) return "00:00";
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      const pad = (n) => (n < 10 ? "0" + n : "" + n);
      return (h > 0 ? h + ":" : "") + pad(m) + ":" + pad(ss);
    },
    // 调起系统里已安装的第三方播放器（MX Player / VLC / 系统播放器均可）
    launchPlayer() {
      // #ifdef APP-PLUS
      const url = this.url;
      if (!url) {
        this.$refs.uToast.show({
          title: "没有可播放的地址",
          type: "warning",
          duration: "2300",
        });
        return;
      }
      const title = this.name || this.detail.name || "视频";
      const position = parseInt(this.initialtime || 0, 10);
      try {
        const main = plus.android.runtimeMainActivity();
        const Intent = plus.android.importClass("android.content.Intent");
        const Uri = plus.android.importClass("android.net.Uri");
        const intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse(url), "video/*");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("title", title);
        // MX Player / VLC 等支持 position 断点续播，单位毫秒
        if (position > 0) {
          intent.putExtra("position", position * 1000);
        }
        main.startActivity(Intent.createChooser(intent, "选择播放器"));
      } catch (e) {
        // 原生调用失败时降级为系统外部打开
        try {
          plus.runtime.openURL(url);
        } catch (e2) {
          this.$refs.uToast.show({
            title: "未找到播放器，请先安装 MX Player 或 VLC",
            type: "warning",
            duration: "2300",
          });
        }
      }
      // #endif
    },
    selectPlay() {
      this.playShow = !this.playShow;
    },
    playConfirm(e) {
      const d = e[0];
      this.url = d.value;
      uni.setNavigationBarTitle({ title: d.label });
      this.launchPlayer();
    },
    async getDetail(key, id) {
      const res = await http.detail(key, id);
      this.detail = res;
      const arr = [];
      let num = 1
      for (const i of res.m3u8List) {
        const j = i.split('$')
        let label = res.m3u8List.length > 1 ? `第${num}集`: this.detail.name
        if (j.length > 1) {
          for (let m = 0; m < j.length; m++) {
            if (j[m].indexOf('.m3u8') >= 0 && j[m].startsWith('http')) {
              let d = {
                index: i,
                value: j[m],
                label: label,
                extra: {
                  site: key,
                  id: id,
                },
              };
              arr.push(d);
              break
            }
          }
        } else {
          let d = {
            index: i,
            value: j[0],
            label: label,
            extra: {
              site: key,
              id: id,
            },
          };
          arr.push(d);
        }
        num++
      }
      this.playList = arr;
    },
    async checkStar () {
      const res = await db.get('star', `${this.siteKey}-${this.id}`)
      this.starShow = res.flag
    },
    async removeStar () {
      const res = await db.remove('star', `${this.siteKey}-${this.id}`)
      if (res.flag) {
        this.$refs.uToast.show({ title: '移除收藏成功', type: 'success', duration: '2300' })
      } else {
        this.$refs.uToast.show({ title: '移除收藏失败', type: 'warning', duration: '2300' })
      }
      this.checkStar()
    },
    async addStar () {
      let s = {...this.detail}
      s.key = `${this.siteKey}-${this.id}`
      const res = await db.add('star', s)
      if (res.flag) {
        this.$refs.uToast.show({ title: '添加收藏成功', type: 'success', duration: '2300' })
      } else {
        this.$refs.uToast.show({ title: '添加收藏失败', type: 'warning', duration: '2300' })
      }
      this.checkStar()
    }
  },
  onLoad(opt) {
    this.siteKey = opt.site;
    this.id = opt.id;
    this.name = opt.name;
    this.url = opt.url;
    this.initialtime = parseInt(opt.initialtime || 0, 10);
    this.getDetail(this.siteKey, this.id)
    this.checkStar()
    uni.setNavigationBarTitle({ title: opt.name });
    // 进入即调起第三方播放器，保持与原版一致的体验
    this.launchPlayer();
  }
};
</script>

<style lang="scss" scoped>
.play {
  .play-box {
    width: 100vw;
    height: 420rpx;
    background: #1a1a1a;
    .cover {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      .tip {
        margin-top: 20rpx;
        padding: 0 40rpx;
        color: #ffffff;
        font-size: 30rpx;
        text-align: center;
      }
      .sub {
        margin-top: 10rpx;
        color: #9e9e9e;
        font-size: 24rpx;
      }
      .sub-time {
        color: #6dd143;
      }
    }
  }
  .icon-box {
    padding: 20px 10%;
    display: flex;
    justify-content: flex-end;
  }
  .box-info {
    padding: 0 10% 10px;
    .name-box {
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      .name {
        font-size: 40rpx;
      }
    }
    .info-box {
      margin-top: 20rpx;
      .gap {
        margin: 0 10rpx;
      }
    }
  }
}
</style>

