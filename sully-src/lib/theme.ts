// 兔k HomeScreen JSON 主题
export interface ThemeData {
  name: string
  // 壁纸
  wallpaper?: string
  // 个人 profile
  profileUsername?: string
  profileSubUsername?: string
  profileBio?: string
  profileBannerImg?: string
  profileAvatarImg?: string
  homeAvatarFrame?: string
  avatarSubtitle?: string
  // 桌面小组件 (1-4 张图 + 文字气泡)
  widgetImage1?: string
  widgetImage2?: string
  widgetImage3?: string
  widgetImage4?: string
  widgetBubble1?: string
  widgetBubble2?: string
  widgetSubtext1?: string
  widgetSubtext2?: string
  widgetMonthDisplay?: string
  // 大 widget
  newWidgetAvatar?: string
  newWidgetText1?: string
  newWidgetText2?: string
  newWidgetText3?: string
  // 装饰气泡
  bubbleTopLeft?: string
  bubbleTopRight?: string
  bubbleBottomLeft?: string
  bubbleBottomRight?: string
  flatCapsuleBubble?: string
  circularBubble?: string
  // 第二页气泡
  secondPageBubble?: string
  // 自定义 app icons (按 app id)
  appIcons?: Record<string, string>
  appLabels?: Record<string, string>
}

const KEY = 'sully_theme_v1'

export function loadTheme(): ThemeData | null {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return null
}

export function saveTheme(t: ThemeData | null) {
  try {
    if (!t) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(t))
  } catch (e) {
    console.error('saveTheme failed:', e)
  }
}

// kebab-case (JSON 原 key) → camelCase (TS field)
function toCamel(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}

// 上传 base64 → /api/upload → 返回 url
async function uploadImg(dataUrl: string): Promise<string | null> {
  try {
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataUrl }),
    }).then(r => r.json())
    return r.path || null
  } catch {
    return null
  }
}

// 解析 JSON 文件 → ThemeData, 期间把所有 base64 上传换成 URL
export async function parseAndUploadTheme(
  file: File,
  onProgress?: (cur: number, total: number, label: string) => void,
): Promise<ThemeData> {
  const text = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsText(file)
  })
  const raw = JSON.parse(text)
  const data = raw.data || raw
  const out: ThemeData = { name: raw.name || file.name }

  // 收集所有需要上传的图片
  const imgs: { field: keyof ThemeData; b64: string }[] = []
  const meta: Partial<ThemeData> = {}

  for (const [k, v] of Object.entries(data)) {
    if (k === 'appIcons' && v && typeof v === 'object') {
      out.appIcons = {} as Record<string, string>
      continue
    }
    if (k === 'appLabels' && v && typeof v === 'object') {
      out.appLabels = v as Record<string, string>
      continue
    }
    const camel = toCamel(k) as keyof ThemeData
    if (typeof v === 'string') {
      if (v.startsWith('data:image')) {
        imgs.push({ field: camel, b64: v })
      } else {
        ;(meta as any)[camel] = v
      }
    }
  }

  // appIcons 内的 base64 也提取
  const iconUploads: { id: string; b64: string }[] = []
  if (data.appIcons) {
    for (const [id, v] of Object.entries(data.appIcons)) {
      if (typeof v === 'string' && v.startsWith('data:image')) {
        iconUploads.push({ id, b64: v })
      } else if (typeof v === 'string') {
        out.appIcons![id] = v
      }
    }
  }

  const total = imgs.length + iconUploads.length
  let cur = 0

  // 并行上传图片 (但限流: 一次 3 张避免 API 卡)
  const tasks: Promise<void>[] = []
  const upload = async (b64: string, label: string, then: (url: string) => void) => {
    const url = await uploadImg(b64)
    cur++
    onProgress?.(cur, total, label)
    if (url) then(url)
  }

  for (const { field, b64 } of imgs) {
    tasks.push(upload(b64, String(field), url => {
      ;(meta as any)[field] = url
    }))
  }
  for (const { id, b64 } of iconUploads) {
    tasks.push(upload(b64, `icon: ${id}`, url => {
      out.appIcons![id] = url
    }))
  }

  // 限流执行 (3 并行)
  const LIMIT = 3
  let i = 0
  async function next(): Promise<void> {
    if (i >= tasks.length) return
    const myI = i++
    await tasks[myI]
    await next()
  }
  await Promise.all(Array.from({ length: LIMIT }, () => next()))

  Object.assign(out, meta)
  return out
}


export function setAppIcon(appId: string, url: string | null){
  const t = loadTheme() || {name:'custom'} as any
  t.appIcons = t.appIcons || {}
  if (url) t.appIcons[appId] = url
  else delete t.appIcons[appId]
  saveTheme(t)
}

export function getAppIcon(appId: string): string | undefined {
  const t = loadTheme()
  return t?.appIcons?.[appId]
}
