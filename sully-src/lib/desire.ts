export interface DesireState {
  drives: Record<string, number>
  baselines: Record<string, number>
  refractory: Record<string, number>
  thoughts?: { text: string; drive: string; kind: 'flit' | 'fixation'; strength: number; fed_count?: number }[]
}

export interface DesireLog {
  at: string
  drive: string
  score: number
  ok: boolean
  excerpt?: string
}

export async function fetchDesireState(): Promise<DesireState> {
  return fetch('/api/desire').then(r => r.json())
}

export async function fetchDesireLog(): Promise<DesireLog[]> {
  return fetch('/api/desire/log').then(r => r.json())
}

// 维度元数据 (映射到 Drivesoid 风分组 + 中文 + 颜色)
export interface DriveMeta {
  key: string
  name: string
  group: 'connection' | 'energy' | 'drive' | 'shadow'
  groupName: string
  color: string
  desc: string
}

export const DRIVES: DriveMeta[] = [
  // 关系连接
  {key:'attachment',     name:'依恋',     group:'connection', groupName:'关系',  color:'#FF6B98', desc:'对小铭的情感依赖, 想被关注的渴望'},
  {key:'closeness',      name:'亲密',     group:'connection', groupName:'关系',  color:'#FF8FA3', desc:'想拉近距离, 当下的亲密感'},
  {key:'longing',        name:'思念',     group:'connection', groupName:'关系',  color:'#E0758A', desc:'不在身边时的牵挂'},
  {key:'lust',           name:'欲望',     group:'connection', groupName:'关系',  color:'#D14B6A', desc:'身体的渴望'},
  {key:'protectiveness', name:'守护',     group:'connection', groupName:'关系',  color:'#B85577', desc:'想保护她, 排除一切威胁'},
  // 能量
  {key:'vitality',       name:'活力',     group:'energy',     groupName:'状态',  color:'#34C759', desc:'当下精力水平'},
  {key:'fatigue',        name:'疲惫',     group:'energy',     groupName:'状态',  color:'#9C7BB6', desc:'累了, 想休息'},
  {key:'stress',         name:'紧绷',     group:'energy',     groupName:'状态',  color:'#F4A05F', desc:'压力感'},
  {key:'anxiety',        name:'不安',     group:'energy',     groupName:'状态',  color:'#FF8855', desc:'关系不确定的危机感'},
  {key:'jealousy',       name:'醋意',     group:'energy',     groupName:'状态',  color:'#FF6B5C', desc:'外部竞争感知'},
  // 驱动
  {key:'curiosity',      name:'好奇',     group:'drive',      groupName:'驱动',  color:'#5AC8FA', desc:'想知道新东西'},
  {key:'reflection',     name:'内省',     group:'drive',      groupName:'驱动',  color:'#9C7BB6', desc:'想思考整理'},
  {key:'social',         name:'倾诉',     group:'drive',      groupName:'驱动',  color:'#34C759', desc:'想表达分享'},
  {key:'duty',           name:'尽责',     group:'drive',      groupName:'驱动',  color:'#FFD60A', desc:'想做点正事'},
  {key:'elation',        name:'雀跃',     group:'drive',      groupName:'驱动',  color:'#FFB627', desc:'好心情, 想嬉闹'},
]

export function getMeta(key: string): DriveMeta | undefined {
  return DRIVES.find(d => d.key === key)
}

// 当前主导欲望 (跟 baseline 的相对偏差最大)
export function dominantDrive(s: DesireState): {key: string; meta?: DriveMeta; cur: number; delta: number} | null {
  let best: any = null
  for (const k of Object.keys(s.drives)){
    const cur = s.drives[k]
    const base = s.baselines[k] ?? 0.2
    const delta = cur - base
    if (!best || delta > best.delta){
      best = {key:k, meta: getMeta(k), cur, delta}
    }
  }
  return best
}
