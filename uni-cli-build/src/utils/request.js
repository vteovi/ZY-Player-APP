import ajax from 'uni-ajax'
import parser from 'fast-xml-parser'
import db from './database'

const http = {
  xmlConfig: {
    trimValues: true,
    textNodeName: '_t',
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    parseAttributeValue: true
  },
  // 获取视频源详情
  async getSite (key) {
    const site = await db.get('site', key)
    if (site.flag) {
      return site.data
    }
    return false
  },
  // 数据源是否为 json 接口（zx/zyfun 导出的源多是 maccms 的 json 接口）
  isJson (site) {
    return !!site && site.type === 'json'
  },
  // 统一请求：xml 源走 fast-xml-parser，json 源走 JSON.parse
  async request (site, url) {
    const res = await ajax.post(url)
    const raw = res.data
    if (this.isJson(site)) {
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw)
        } catch (err) {
          return null
        }
      }
      return raw || null
    }
    return parser.parse(raw, this.xmlConfig)
  },
  // maccms json 的视频条目 -> 页面使用的字段（对齐 xml 里的 <video> 节点）
  mapVideo (v) {
    return {
      id: v.vod_id,
      tid: v.type_id,
      name: v.vod_name,
      type: v.type_name || '',
      pic: v.vod_pic || '',
      lang: v.vod_lang || '',
      area: v.vod_area || '',
      year: v.vod_year || '',
      note: v.vod_remarks || '',
      actor: v.vod_actor || '',
      director: v.vod_director || '',
      des: v.vod_content || '',
      last: v.vod_time || ''
    }
  },
  // json 的分页信息 -> 对齐 xml 的 <list> 属性
  mapPage (d) {
    return {
      page: d.page || 1,
      pagecount: d.pagecount || 1,
      pagesize: d.limit || 20,
      recordcount: d.total || 0
    }
  },
  // json 的播放地址：多播放源用 $$$ 分隔，集数用 # 分隔，每集为 名称$地址
  mapPlayList (v) {
    const groups = String(v.vod_play_url || '').split('$$$')
    const g = groups.filter(x => x).find(x => /m3u8/i.test(x)) || groups.filter(x => x)[0] || ''
    return g ? g.split('#').filter(x => x) : []
  },
  // 获取视频源的分类
  async class (key) {
    const site = await this.getSite(key)
    try {
      // maccms 的 json 接口里，分类只在 ac=list 的返回中带出来（ac=videolist 没有 class）
      const url = this.isJson(site) ? `${site.api}?ac=list` : site.api
      const json = await this.request(site, url)
      const arr = []
      if (this.isJson(site)) {
        const list = (json && (json.class || (json.data && json.data.class))) || []
        for (const i of list) {
          arr.push({ tid: i.type_id, name: i.type_name })
        }
        return arr
      }
      if (json.rss.class) {
        for (const i of json.rss.class.ty) {
          const j = {
            tid: i._id,
            name: i._t
          }
          arr.push(j)
        }
      }
      return arr
    } catch (err) {
      return err
    }
  },
  // 获取视频资源
  async list (key, pg = 1, t) {
    const site = await this.getSite(key)
    const url = `${site.api}?ac=videolist${t ? '&t=' + t : ''}&pg=${pg}`
    try {
      const json = await this.request(site, url)
      if (this.isJson(site)) {
        const list = json && (json.list || (json.data && json.data.list))
        if (!list || list.length <= 0) {
          return []
        }
        // 只保留 m3u8 源能解析的字段，single-object 的情况包成数组
        return (Array.isArray(list) ? list : [list]).map(v => this.mapVideo(v))
      }
      if (json.rss.list.video) {
        return json.rss.list.video
      } else {
        return []
      }
    } catch (err) {
      return err
    }
  },
  // 获取总资源数, 以及页数
  async page (key, t) {
    const site = await this.getSite(key)
    const url = `${site.api}?ac=videolist${t ? '&t=' + t : ''}`
    try {
      const json = await this.request(site, url)
      if (this.isJson(site)) {
        const d = json && (json.data || json)
        return this.mapPage(d || {})
      }
      const pg = {
        page: json.rss.list._page,
        pagecount: json.rss.list._pagecount,
        pagesize: json.rss.list._pagesize,
        recordcount: json.rss.list._recordcount
      }
      return pg
    } catch (err) {
      return err
    }
  },
  // 搜索资源
  async search (key, wd) {
    const site = await this.getSite(key)
    wd = encodeURI(wd)
    const url = `${site.api}?wd=${wd}`
    try {
      const res = await ajax.post(url, { timeourt: 3000 })
      if (this.isJson(site)) {
        let data = res.data
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch (e) {
            return null
          }
        }
        const list = data && (data.list || (data.data && data.data.list))
        if (!list) {
          return null
        }
        return (Array.isArray(list) ? list : [list]).map(v => this.mapVideo(v))
      }
      const json = parser.parse(res.data, this.xmlConfig)
      if (json && json.rss && json.rss.list) {
        const videoList = json.rss.list.video
        return videoList
      }
      return null
    } catch (err) {
      return err
    }
  },
  // 获取资源详情
  async detail (key, id) {
    const site = await this.getSite(key)
    const url = `${site.api}?ac=videolist&ids=${id}`
    try {
      const json = await this.request(site, url)
      if (this.isJson(site)) {
        const list = json && (json.list || (json.data && json.data.list))
        if (!list || list.length <= 0) {
          return null
        }
        const v = Array.isArray(list) ? list[0] : list
        const item = this.mapVideo(v)
        item.m3u8List = this.mapPlayList(v)
        return item
      }
      if (json && json.rss && json.rss.list) {
        const videoList = json.rss.list.video
        let m3u8List = []
        const dd = videoList.dl.dd
        const type = Object.prototype.toString.call(dd)
        if (type === '[object Array]') {
          for (const i of dd) {
            if (i._flag.indexOf('m3u8') >= 0) {
              m3u8List = i._t.split('#')
            }
          }
        } else {
          m3u8List = dd._t.split('#')
        }
        videoList.m3u8List = m3u8List
        return videoList
      }
      return null
    } catch (err) {
      return err
    }
  },
  // 通过 json url 导入视频源
  async site (jsonUrl) {
    try {
      const res = await ajax.get(jsonUrl)
      return res.data
    } catch (err) {
      return err
    }
  }
}

export default http
