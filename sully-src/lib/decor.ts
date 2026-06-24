// 5 个装饰槽位 (每个有预设位置/混合模式/尺寸, 用户只需上传图)
export interface DecorSlot {
  id: string
  name: string
  blend: 'screen' | 'multiply' | 'normal'  // screen 让黑底消失, multiply 让白底消失
  pos: { top?: string; left?: string; right?: string; bottom?: string }
  width: number
  rotate?: number
  opacity?: number
  zIndex?: number
}

export const DECOR_SLOTS: DecorSlot[] = [
  // 黑底图 → screen blend (黑色变透明, 保留亮部)
  {id:'guitar',  name:'吉他+雪花',  blend:'screen',  pos:{top:'-2%', right:'-15%'}, width:340, opacity:0.85, zIndex:0, rotate:8},
  {id:'butterfly', name:'珍珠蝴蝶', blend:'screen', pos:{top:'5%', left:'-12%'}, width:180, opacity:0.7, zIndex:0, rotate:-15},
  {id:'crown',   name:'月光皇冠',   blend:'screen', pos:{bottom:'18%', right:'-8%'}, width:140, opacity:0.55, zIndex:0, rotate:-5},
  // 白底图 → multiply blend (白色变透明, 保留暗部)
  {id:'moon_frame', name:'月光相框', blend:'multiply', pos:{bottom:'-5%', left:'-15%'}, width:240, opacity:0.6, zIndex:0, rotate:5},
  {id:'ship',    name:'白色帆船',   blend:'multiply', pos:{top:'30%', right:'-20%'}, width:280, opacity:0.5, zIndex:0, rotate:-3},
]

const KEY = 'sully_decors_v1'

export function loadDecors(): Record<string, string> {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return {}
}

export function setDecor(slotId: string, url: string | null){
  const m = loadDecors()
  if (url) m[slotId] = url
  else delete m[slotId]
  try { localStorage.setItem(KEY, JSON.stringify(m)) } catch {}
}
