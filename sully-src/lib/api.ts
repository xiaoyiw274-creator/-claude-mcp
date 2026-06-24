const API = '/api'

export type MsgKind = 'text' | 'voice' | 'image' | 'fake_image' | 'transfer' | 'location' | 'system' | 'sticker'

export interface MsgMeta {
  // image / fake_image
  url?: string
  desc?: string
  width?: number
  height?: number
  // voice
  duration?: number  // 秒
  transcript?: string
  // transfer (转账/红包)
  amount?: number
  note?: string
  status?: 'pending' | 'received'
  // location
  lat?: number
  lng?: number
  addr?: string
  poi?: string
}

export interface Msg {
  id: number
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  created_at: string
  kind?: MsgKind
  meta?: MsgMeta
}

export interface Session {
  session_id: string
  title?: string
  last_active_at?: string
  is_current?: 0 | 1
}

export interface Script {
  id: number
  name: string
  world_setting: string
  your_role: string
  bao_role: string
  opening: string
  npcs?: string
  tags?: string
  avatar?: string
  writing_style?: string
  created_at?: string
}

export async function fetchMessages(): Promise<{messages: Msg[]; session_id: string | null}>{
  const r = await fetch(`${API}/messages`)
  return r.json()
}

export async function fetchSessions(): Promise<{sessions: Session[]}>{
  return (await fetch(`${API}/sessions`)).json()
}

export async function newSession(): Promise<void>{
  await fetch(`${API}/new_session`, {method:'POST'})
}

export async function switchSession(session_id: string){
  await fetch(`${API}/switch_session`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({session_id})})
}

export async function fetchScripts(): Promise<{scripts: Script[]}>{
  return (await fetch(`${API}/scripts`)).json()
}

export async function fetchScript(id: number): Promise<Script>{
  return (await fetch(`${API}/scripts/${id}`)).json()
}

// SSE 流式聊天
export type ChatEvent =
  | {type:'session', session_id: string}
  | {type:'text', text: string}
  | {type:'thinking_start'}
  | {type:'thinking', text: string}
  | {type:'tool', name: string, id?: string, input?: any}
  | {type:'tool_result', tool_use_id: string, result: string}
  | {type:'done', tokens: number, duration_ms: number, cost: number}
  | {type:'error', msg: string}
  | {type:'block_stop', index: number}

export async function streamChat(
  body: { content: string; image_paths?: string[] },
  onEvent: (ev: ChatEvent) => void,
  abortSignal?: AbortSignal
){
  const r = await fetch(`${API}/chat`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body),
    signal: abortSignal,
  })
  if (!r.body) throw new Error('No body')
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true){
    const {done, value} = await reader.read()
    if (done) break
    buf += decoder.decode(value, {stream:true})
    // SSE 行: "data: {...}\n\n"
    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const part of parts){
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        const json = JSON.parse(line.slice(5).trim())
        onEvent(json as ChatEvent)
      } catch {}
    }
  }
}

export async function regenChat(onEvent:(ev:ChatEvent)=>void, abortSignal?:AbortSignal){
  const r = await fetch(`${API}/regen`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:'{}',
    signal: abortSignal,
  })
  if (!r.body) return
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true){
    const {done, value} = await reader.read()
    if (done) break
    buf += decoder.decode(value, {stream:true})
    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const part of parts){
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try { onEvent(JSON.parse(line.slice(5).trim())) } catch {}
    }
  }
}

export async function resumeScriptSession(sessionId: string){
  await fetch(`/api/scripts/sessions/${sessionId}/resume`, {method:'POST'})
}


// === Script CRUD ===
export interface ScriptWb {
  id?: number
  script_id?: number
  name: string
  keywords?: string
  content: string
  priority?: number
  enabled?: boolean
  global?: boolean
}

export async function createOrUpdateScript(s: Partial<Script>): Promise<{ok:boolean; id:number}>{
  const r = await fetch(`/api/scripts`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(s),
  })
  return r.json()
}

export async function deleteScript(id: number){
  await fetch(`/api/scripts/${id}`, {method:'DELETE'})
}

export async function fetchScriptWorldbook(scriptId: number): Promise<{items: ScriptWb[]}>{
  const r = await fetch(`/api/scripts/${scriptId}/worldbook`)
  return r.json()
}

export async function saveScriptWb(scriptId: number, wb: ScriptWb){
  await fetch(`/api/scripts/${scriptId}/worldbook`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(wb),
  })
}

export async function deleteScriptWb(wid: number){
  await fetch(`/api/scripts/worldbook/${wid}`, {method:'DELETE'})
}

// 角色卡导入: 通过 /api/scripts/import_card (新)
export async function importCharacterCard(file: File): Promise<{ok:boolean; script?: Script; error?: string}>{
  const fd = new FormData()
  fd.append('file', file)
  try {
    const r = await fetch('/api/scripts/import_card', {method:'POST', body: fd})
    return await r.json()
  } catch (e:any){
    return {ok:false, error: e.message}
  }
}

export const STYLE_PRESETS = [
  {name:'沉浸细腻', value:'多五感描写 (视觉/嗅觉/触觉/声音), 心理活动用斜体, 每段 80-150 字. 用动作和环境氛围暗示情绪, 不要太直白说\'她紧张了\'之类. 对话留白, 让动作和神态说话.'},
  {name:'电影镜头', value:'电影分镜感. 用动作 + 空间转换 + 时间感推进. 每段 50-80 字, 节奏快, 镜头切换流畅. 多用短句.'},
  {name:'言情慢热', value:'言情慢热风. 心理活动占主体, 每段 100-200 字, 含感官细节 (温度/气味/触感). 对白短而有张力, 用第三人称. 暧昧但克制.'},
  {name:'古风韵味', value:'古风韵味. 用半文言半白话, 含典故和古典意象 (月色/烛火/纱帘/檀香). 对白含\'妾身\'\'卿\'\'君\'之类雅称. 描写含蓄不直露.'},
  {name:'克制简练', value:'克制冷酷. 极简笔, 每段 30-60 字, 多对白少描写. 不渲染情绪. 留白多.'},
]


// === 全局世界书 ===
export interface GlobalWb {
  id: number
  name: string
  keywords: string
  content: string
  enabled: 0 | 1
  priority: number
  created_at?: string
  updated_at?: string
}

export async function fetchGlobalWb(): Promise<{entries: GlobalWb[]}>{
  return fetch('/api/worldbook').then(r => r.json())
}

export async function saveGlobalWb(wb: Partial<GlobalWb>){
  await fetch('/api/worldbook', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(wb),
  })
}

export async function deleteGlobalWb(wid: number){
  await fetch(`/api/worldbook/${wid}`, {method:'DELETE'})
}


// === 剧本扮演记录 (session 历史) ===
export interface ScriptSession {
  session_id: string
  last_active_at: string
  msg_count: number
  last_msg?: string
}

export async function fetchScriptSessions(scriptId: number): Promise<{sessions: ScriptSession[]}>{
  return fetch(`/api/scripts/${scriptId}/sessions`).then(r => r.json())
}

export async function deleteScriptSession(sessionId: string){
  await fetch(`/api/scripts/sessions/${sessionId}`, {method:'DELETE'})
}


// === Somatic (4 通道感官) ===
export interface SomaticChannel {
  key: 'touch' | 'smell' | 'taste' | 'sound'
  value: number
  scene: string
  sentence: string
  updated_at: string
}
export async function fetchSomatic(): Promise<{channels: SomaticChannel[]}>{
  return fetch('/api/somatic').then(r => r.json())
}


// === Mood + Anticipation + Circadian ===
export interface MoodState { valence: number; arousal: number; last_event: string; label: string; updated_at: string }
export interface AnticipationState { expectation: number; letdown: number; promised_at: number; promised_within: number; last_promise: string }
export interface CircadianState { label: string; bias: Record<string, number> }

export async function fetchMood(): Promise<MoodState> { return fetch('/api/mood').then(r => r.json()) }
export async function fetchAnticipation(): Promise<AnticipationState> { return fetch('/api/anticipation').then(r => r.json()) }
export async function fetchCircadian(): Promise<CircadianState> { return fetch('/api/circadian').then(r => r.json()) }
