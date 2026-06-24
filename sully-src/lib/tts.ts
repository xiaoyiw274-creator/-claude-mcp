export interface MinimaxConfig {
  group_id: string
  api_key: string
  voice_id: string
  configured: boolean
}

export async function getMinimaxConfig(): Promise<MinimaxConfig> {
  return fetch('/api/minimax_config').then(r => r.json())
}

export async function saveMinimaxConfig(cfg: Partial<MinimaxConfig>){
  await fetch('/api/minimax_config', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(cfg),
  })
}

export interface TtsResult { url?: string; cached?: boolean; error?: string; bytes?: number }

export async function fetchTts(text: string): Promise<TtsResult> {
  if (!text.trim()) return {error: '空文本'}
  try {
    return await fetch('/api/tts', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({text}),
    }).then(r => r.json())
  } catch (e:any){
    return {error: e.message}
  }
}

// 从 RP 文本里抽对话 (中日西引号)
export function extractDialogue(content: string): string {
  if (!content) return ''
  const out: string[] = []
  const re = /[「『"]([^「『"\n]+?)[」』"]|"([^"\n]{2,}?)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    out.push(m[1] || m[2])
  }
  return out.join(' ')
}

// 单例 audio 播放器
let currentAudio: HTMLAudioElement | null = null
export function playUrl(url: string): HTMLAudioElement {
  if (currentAudio){
    currentAudio.pause()
    currentAudio = null
  }
  const a = new Audio(url)
  currentAudio = a
  a.play().catch(()=>{})
  return a
}
export function stopAudio(){
  if (currentAudio){ currentAudio.pause(); currentAudio = null }
}
