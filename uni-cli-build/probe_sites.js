/**
 * 把 zyfun 导出的配置（tbl_site）转成 ZY Player 的 utils/initSite.json。
 *
 * 为什么要探测：ZY Player 的 request.js 只支持 maccms 的 **XML** 接口
 * （`api + '?ac=videolist'`，再用 fast-xml-parser 解析 <rss>）。
 * zyfun 的源里混了不少 JSON 接口（apijson_vod.php、/vod/json 等），
 * 直接内置会一点就报错，所以这里先按真实请求探一遍：
 *   - HTTP 200 且返回体含 <rss / <?xml  → 可用
 *   - 顺带抓 recordcount，用来排序（资源多的排前面，作为首页默认源）
 *
 * 用法：node probe_sites.js <zyfun配置.json> [输出路径]
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const zlib = require('zlib')
const { URL } = require('url')

const srcPath = process.argv[2]
const outPath = process.argv[3] || path.resolve(__dirname, 'src/utils/initSite.json')

if (!srcPath) {
  console.error('用法: node probe_sites.js <zyfun配置.json> [输出路径]')
  process.exit(1)
}

/** 规范化 api：去掉查询串、修复协议后的多斜杠 */
function normalizeApi(raw) {
  if (!raw) return ''
  let u = String(raw).trim()
  const q = u.indexOf('?')
  if (q >= 0) u = u.slice(0, q)
  u = u.replace(/^(https?:\/\/[^/]+)\/+/, '$1/')
  return u.replace(/\s+$/, '')
}

function fetchUrl(url, timeout = 8000, redirects = 3) {
  return new Promise((resolve) => {
    let mod
    try {
      mod = url.startsWith('https:') ? https : http
    } catch (e) {
      return resolve({ ok: false, err: 'badurl' })
    }
    let req
    try {
      req = mod.get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            Accept: '*/*',
            'Accept-Encoding': 'gzip, deflate',
          },
          timeout,
        },
        (res) => {
          const code = res.statusCode
          if (code >= 300 && code < 400 && res.headers.location && redirects > 0) {
            res.resume()
            let next = res.headers.location
            try {
              if (next.startsWith('/')) next = new URL(url).origin + next
            } catch (e) {}
            return resolve(fetchUrl(next, timeout, redirects - 1))
          }
          const enc = (res.headers['content-encoding'] || '').toLowerCase()
          let stream = res
          if (enc === 'gzip') stream = res.pipe(zlib.createGunzip())
          else if (enc === 'deflate') stream = res.pipe(zlib.createInflate())
          const chunks = []
          let len = 0
          stream.on('data', (c) => {
            len += c.length
            if (len < 300000) chunks.push(c)
          })
          stream.on('end', () =>
            resolve({ ok: true, code, body: Buffer.concat(chunks).toString('utf8') })
          )
          stream.on('error', () => resolve({ ok: false, code, err: 'stream' }))
        }
      )
    } catch (e) {
      return resolve({ ok: false, err: e.message })
    }
    req.on('error', (e) => resolve({ ok: false, err: e.code || e.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ ok: false, err: 'timeout' })
    })
  })
}

async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    })
  )
  return out
}

;(async () => {
  const cfg = JSON.parse(fs.readFileSync(srcPath, 'utf8'))
  const rawSites = cfg.tbl_site || []

  // 规范化 + 按 api 去重
  const seen = new Set()
  const candidates = []
  for (const s of rawSites) {
    const api = normalizeApi(s.api)
    if (!api) continue
    if (seen.has(api)) continue
    seen.add(api)
    candidates.push({ ...s, apiNorm: api })
  }
  console.log(`zyfun 源 ${rawSites.length} 条，去重后 ${candidates.length} 条，开始探测...\n`)

  const probeOne = async (s) => {
    const url = `${s.apiNorm}?ac=videolist`
    const r = await fetchUrl(url)
    let usable = false
    let recordcount = 0
    let kind = r.err || (r.ok ? `HTTP ${r.code}` : '')
    if (r.ok && r.code === 200 && r.body) {
      const head = r.body.slice(0, 800)
      usable = /<rss|<\?xml|<xml/i.test(head)
      if (usable) kind = 'xml'
      else if (head.trim().startsWith('{') || head.trim().startsWith('[')) kind = 'json'
      else if (/^\s*<(?:!doctype|html)/i.test(head)) kind = 'html'
      else kind = 'text'
      // zyfun 这批源是 maccms 的 json 接口，资源量字段叫 total
      const m =
        r.body.match(/"total"\s*:\s*(\d+)/i) || r.body.match(/recordcount["']?\s*[:=]\s*["']?(\d+)/i)
      if (m) recordcount = parseInt(m[1], 10)
    }
    return {
      key: s.id,
      name: s.name,
      api: s.apiNorm,
      origApi: s.api,
      group: s.group || '',
      isActiveOrig: !!s.isActive,
      usable,
      kind,
      recordcount,
      sample: r.body ? r.body.slice(0, 120).replace(/\s+/g, ' ') : '',
      err: kind,
    }
  }

  const RETRYABLE = ['timeout', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKETTIMEDOUT']
  const results = await pool(candidates, 8, async (s) => {
    let r = await probeOne(s)
    // 偶发抖动会误杀可用源，对可重试的失败补一次
    if (!r.usable && RETRYABLE.includes(r.kind)) {
      await new Promise((r2) => setTimeout(r2, 800))
      const again = await probeOne(s)
      if (again.usable) return again
    }
    return r
  })

  const alive = results.filter((r) => r.kind === 'json' || r.usable)
  const dead = results.filter((r) => !(r.kind === 'json' || r.usable))

  console.log(`可用 ${alive.length} / 不可用 ${dead.length}\n`)
  console.log('=== 可用（按资源量降序）===')
  alive
    .slice()
    .sort((a, b) => b.recordcount - a.recordcount)
    .forEach((r, i) =>
      console.log(`${i + 1}. [${r.kind}] ${r.name}  ${r.recordcount} 条  ${r.api}`)
    )

  // ZY Player 原版只认 XML，request.js 已扩展为同时支持 json/xml，
  // 所以这里用 type 字段把两类都标出来；探测不通的源一律置为不启用，
  // 但仍写进配置，用户可以在「源管理」里手动打开。
  const toItem = (r, idx, active) => ({
    id: idx + 1,
    key: r.key,
    name: r.name,
    api: r.api,
    type: r.kind === 'json' ? 'json' : 'xml',
    download: '',
    group: r.group || '默认',
    isActive: active,
    status: active ? '可用' : '失效',
  })

  const sortedAlive = alive.slice().sort((a, b) => b.recordcount - a.recordcount)
  const site = [
    ...sortedAlive.map((r, i) => toItem(r, i, true)),
    ...dead.map((r, i) => toItem(r, sortedAlive.length + i, false)),
  ]

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(site, null, 1), 'utf8')
  console.log(`\n已写入 ${outPath}，共 ${site.length} 个源`)

  fs.writeFileSync(
    path.resolve(path.dirname(outPath), 'probe_report.json'),
    JSON.stringify({ ok: alive, bad: dead }, null, 1),
    'utf8'
  )
  console.log('探测明细: probe_report.json')
})()
