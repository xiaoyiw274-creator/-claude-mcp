export interface RegexRule {
  id: string
  name: string
  pattern: string  // JS regex source (不含 //)
  flags?: string   // 默认 'g'
  replacement: string
  enabled: boolean
}

const KEY = 'sully_regex_rules_v1'

// 默认套话过滤 (常见的 LLM 八股 - 可改/可删/可加)
const DEFAULT_RULES: RegexRule[] = [
  {id:'r1', name:'咬下唇',     pattern:'(轻轻地?|紧张地?|不自觉地?)咬了?咬(下|嘴)唇', flags:'g', replacement:'', enabled:true},
  {id:'r2', name:'心跳漏一拍', pattern:'心跳(漏|落|错|跳)了?一拍', flags:'g', replacement:'', enabled:true},
  {id:'r3', name:'眼神锁定',   pattern:'眼神(死死)?(锁定|黏在|钉在|定格在?)[^，。？！\\n]{0,15}(身上|脸上)', flags:'g', replacement:'', enabled:true},
  {id:'r4', name:'空气凝固',   pattern:'空气(都|似乎|仿佛)?(凝固|静止|安静下来)了?', flags:'g', replacement:'', enabled:true},
  {id:'r5', name:'喉结滚动',   pattern:'喉结(轻轻地?|不自觉地?)?(滚|动|上下)了?一?下', flags:'g', replacement:'', enabled:true},
  {id:'r6', name:'呼吸一滞',   pattern:'呼吸(一)?(滞|停|顿|乱)了?(一下)?', flags:'g', replacement:'', enabled:true},
  {id:'r7', name:'瞳孔骤缩',   pattern:'瞳孔(骤|猛|忽然)缩了?一?下', flags:'g', replacement:'', enabled:true},
]

export function loadRules(): RegexRule[] {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return DEFAULT_RULES
}

export function saveRules(rules: RegexRule[]) {
  localStorage.setItem(KEY, JSON.stringify(rules))
}

export function resetDefault() {
  localStorage.removeItem(KEY)
}

// 应用所有 enabled 规则
export function applyRules(text: string): string {
  if (!text) return text
  const rules = loadRules()
  let out = text
  for (const r of rules) {
    if (!r.enabled || !r.pattern) continue
    try {
      const re = new RegExp(r.pattern, r.flags || 'g')
      out = out.replace(re, r.replacement)
    } catch {} // 无效 regex 跳过
  }
  // 清理替换后的多余空格 / 多余标点
  out = out.replace(/ {2,}/g, ' ')
  out = out.replace(/，{2,}/g, '，').replace(/。{2,}/g, '。')
  return out
}

export function newRule(): RegexRule {
  return {id: 'r' + Date.now().toString(36), name: '', pattern: '', flags: 'g', replacement: '', enabled: true}
}
