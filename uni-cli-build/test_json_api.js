/**
 * 用真实接口验证 request.js 里 json 分支的解析逻辑（mapPage / mapVideo / mapPlayList），
 * 避免打包到手机里才发现字段对不上。只校验结构与字段完整性，不落盘任何内容。
 *
 * 用法：node test_json_api.js [api] [影片id]
 */
const http = require('http')
const https = require('https')
const zlib = require('zlib')

const api = process.argv[2] || 'http://fhapi9.com/api.php/provide/vod/'
const vodId = process.argv[3] || ''

function get(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https:') ? https : http
    const req = mod.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36',
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate',
        },
        timeout: 12000,
      },
      (res) => {
        const enc = (res.headers['content-encoding'] || '').toLowerCase()
        let s = res
        if (enc === 'gzip') s = res.pipe(zlib.createGunzip())
        else if (enc === 'deflate') s = res.pipe(zlib.createInflate())
        const b = []
        s.on('data', (c) => b.push(c))
        s.on('end', () => resolve({ code: res.statusCode, body: Buffer.concat(b).toString('utf8') }))
        s.on('error', (e) => resolve({ code: 0, body: 'ERR ' + e.message }))
      }
    )
    req.on('error', (e) => resolve({ code: 0, body: 'ERR ' + (e.code || e.message) }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ code: 0, body: 'TIMEOUT' })
    })
  })
}

// ---- 与 utils/request.js 中保持一致的映射 ----
const mapVideo = (v) => ({
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
  last: v.vod_time || '',
})
const mapPage = (d) => ({
  page: d.page || 1,
  pagecount: d.pagecount || 1,
  pagesize: d.limit || 20,
  recordcount: d.total || 0,
})
const mapPlayList = (v) => {
  const groups = String(v.vod_play_url || '').split('$$$')
  const g = groups.filter((x) => x).find((x) => /m3u8/i.test(x)) || groups.filter((x) => x)[0] || ''
  return g ? g.split('#').filter((x) => x) : []
}

;(async () => {
  console.log('接口:', api)

  const r1 = await get(`${api}?ac=videolist&pg=1`)
  if (r1.code !== 200) return console.log('列表请求失败:', r1.code, r1.body.slice(0, 80))
  const j1 = JSON.parse(r1.body)
  const pg = mapPage(j1.data || j1)
  console.log('\n[page] ->', JSON.stringify(pg))

  const list = j1.list || (j1.data && j1.data.list) || []
  console.log('[list] 条数:', list.length)
  const v0 = mapVideo(list[0])
  console.log('[list] 首条字段:', JSON.stringify(v0).slice(0, 260))

  const cls = j1.class || (j1.data && j1.data.class) || []
  console.log(
    '[class] 分类数:',
    cls.length,
    cls.length ? JSON.stringify({ tid: cls[0].type_id, name: cls[0].type_name }) : ''
  )

  const id = vodId || (list[0] && list[0].vod_id)
  const r2 = await get(`${api}?ac=videolist&ids=${id}`)
  if (r2.code !== 200) return console.log('详情请求失败:', r2.code)
  const j2 = JSON.parse(r2.body)
  const dl = j2.list || (j2.data && j2.data.list) || []
  const d0 = Array.isArray(dl) ? dl[0] : dl
  if (!d0) return console.log('详情为空')
  const m3u8 = mapPlayList(d0)
  console.log('\n[detail] id:', d0.vod_id, '| 播放源分组数:', String(d0.vod_play_url || '').split('$$$').length)
  console.log('[detail] 解析出集数:', m3u8.length)
  if (m3u8.length) {
    const first = m3u8[0].split('$')
    console.log('[detail] 首集 name:', first[0])
    console.log('[detail] 首集 url 前缀:', String(first[1] || '').slice(0, 60))
    console.log('[detail] 是否 m3u8:', (first[1] || '').toLowerCase().includes('.m3u8'))
    console.log('[detail] 是否 http 开头:', /^https?:/i.test(first[1] || ''))
  }
})()
