import { useEffect, useRef, useState, useCallback } from 'react'
import StatusBar from '../components/StatusBar'
import { Msg, Script, fetchMessages, streamChat, newSession } from '../lib/api'
import { applyRules } from '../lib/regex'
import { fetchTts, playUrl, extractDialogue } from '../lib/tts'
import TtsConfig from '../components/TtsConfig'

interface Props {
  script: Script
  onBack: ()=>void
}

export default function RpSession({script, onBack}: Props){
  const peerName = (script.bao_role.split(/[,，]/)[0] || script.name).trim()
  const subPeer = script.your_role.split(/[,，]/)[0] || '小铭'

  const [msgs, setMsgs] = useState<Msg[]>([])
  const [inp, setInp] = useState('')
  const [oocMode, setOocMode] = useState(false)
  const [sending, setSending] = useState(false)
  const [streamingId, setStreamingId] = useState<number | null>(null)
  const [autoTts, setAutoTts] = useState(()=>{
    try { return localStorage.getItem('rp_auto_tts') === '1' } catch { return false }
  })
  const [showTtsConfig, setShowTtsConfig] = useState(false)
  const [ttsCache, setTtsCache] = useState<Record<number, string>>({})
  const streamRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(()=>{
    fetchMessages().then(d => setMsgs(d.messages || []))
  },[])

  const scrollBottom = useCallback(()=>{
    const el = streamRef.current
    if (el) el.scrollTop = el.scrollHeight
  },[])
  useEffect(()=> scrollBottom(), [msgs, streamingId, scrollBottom])

  useEffect(()=>{
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
  }, [inp])

  const send = async ()=>{
    const text = inp.trim()
    if (!text || sending) return
    setInp(''); setSending(true)
    const userMsg: Msg = {
      id: Date.now(), role:'user', content: text,
      created_at: new Date().toISOString(), kind:'text',
      ...(oocMode ? {meta:{ooc:true} as any} : {}),
    }
    setMsgs(p => [...p, userMsg])
    const apiText = oocMode ? `[OOC: ${text}]` : text
    const placeholderId = Date.now() + 1
    setStreamingId(placeholderId)
    setMsgs(p => [...p, {id: placeholderId, role:'assistant', content:'', created_at:new Date().toISOString(), kind:'text'}])
    abortRef.current = new AbortController()
    let assembled = ''
    try {
      await streamChat({content: apiText}, (ev)=>{
        if (ev.type === 'text'){
          assembled += ev.text
          setMsgs(p => p.map(m => m.id === placeholderId ? {...m, content: assembled} : m))
        }
        if (ev.type === 'error') {
          setMsgs(p => p.map(m => m.id === placeholderId ? {...m, content: assembled || '出错: ' + ev.msg} : m))
        }
      }, abortRef.current.signal)
    } catch (e:any){
      if (e.name !== 'AbortError') console.error(e)
    } finally {
      setStreamingId(null); setSending(false); abortRef.current = null
      // 自动 TTS 播放最后一条 assistant 的对话片段
      if (autoTts){
        const dialog = extractDialogue(assembled)
        if (dialog){
          const r = await fetchTts(dialog)
          if (r.url){
            setTtsCache(c => ({...c, [placeholderId]: r.url!}))
            playUrl(r.url)
          }
        }
      }
    }
  }

  // 卡片点 ▶ 播放
  const playCard = async (msg: Msg)=>{
    let url = ttsCache[msg.id]
    if (!url){
      const text = extractDialogue(msg.content) || msg.content
      const r = await fetchTts(text)
      if (r.error){ alert('合成失败: ' + r.error); return }
      if (r.url){
        url = r.url
        setTtsCache(c => ({...c, [msg.id]: r.url!}))
      }
    }
    if (url) playUrl(url)
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send() }
  }

  // 背景 - 用剧本头像做半透水墨底
  const bg = script.avatar
    ? `linear-gradient(180deg, rgba(250,250,250,.92), rgba(245,242,238,.95)), url("${script.avatar}") center/cover no-repeat fixed`
    : 'linear-gradient(180deg, #fafafa 0%, #f4f1ed 100%)'

  return (
    <div style={{
      position:'absolute', inset:0,
      background: bg,
      display:'flex', flexDirection:'column',
      animation:'chatSlide .25s ease-out',
    }}>
      <StatusBar tint="#3a2820"/>

      {/* 顶部胶囊 nav */}
      <div style={{
        flex:'0 0 auto',
        padding:'4px 12px 8px',
        display:'flex', alignItems:'center', gap:6,
      }}>
        <button onClick={onBack} style={{
          background:'none', border:0, color:'#3a2820',
          fontSize:22, cursor:'pointer', padding:'4px 8px', lineHeight:1,
        }}>‹</button>
        <div style={{
          flex:1, display:'flex', alignItems:'center', gap:8,
          padding:'4px 4px 4px 4px',
          background:'rgba(255,255,255,.7)',
          backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          borderRadius:18,
          boxShadow:'0 1px 3px rgba(0,0,0,.04)',
        }}>
          <div style={{
            width:24, height:24, borderRadius:'50%',
            background: script.avatar ? `url("${script.avatar}") center/cover` : 'linear-gradient(135deg,#C9A77E,#8B6F47)',
            flex:'0 0 24px',
          }}/>
          <span style={{fontSize:13, fontWeight:600, color:'#3a2820'}}>{peerName}</span>
          <div style={{
            padding:'2px 8px',
            background:'rgba(0,0,0,.04)',
            borderRadius:10,
            display:'flex', alignItems:'center', gap:4,
          }}>
            <span style={{fontSize:11, color:'#666'}}>{subPeer}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
        </div>
        <button title={autoTts ? '自动配音 ON' : '点开启自动配音'}
          onPointerDown={(e)=>{
            if (e.pointerType==='mouse' && e.button===2) return
          }}
          onContextMenu={(e)=>{ e.preventDefault(); setShowTtsConfig(true) }}
          onClick={()=>{
            const next=!autoTts; setAutoTts(next);
            try{localStorage.setItem('rp_auto_tts', next?'1':'0')}catch{}
          }}
          style={{
            ...iconBtn,
            background: autoTts ? '#FF8FA3' : 'rgba(255,255,255,.7)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={autoTts ? '#fff' : '#3a2820'} strokeWidth="1.6">
            <path d="M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1z"/>
            <path d="M15 8a4 4 0 0 1 0 8" strokeLinecap="round"/>
            <path d="M18 5a8 8 0 0 1 0 14" strokeLinecap="round"/>
          </svg>
        </button>
        <button title="TTS 设置" onClick={()=>setShowTtsConfig(true)} style={iconBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3a2820" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>

      </div>

      {/* 消息流 */}
      <div ref={streamRef} style={{
        flex:1, overflowY:'auto',
        padding:'8px 16px 16px',
        display:'flex', flexDirection:'column', gap:14,
      }}>
        {msgs.length === 0 && (
          <div style={{textAlign:'center', padding:'40px 0', color:'#999', fontSize:13, fontFamily:'"Cormorant Garamond",serif', fontStyle:'italic'}}>
            幕起 · 等你说第一句话
          </div>
        )}
        {msgs.map(m => (
          <RpCard key={m.id} msg={m} streaming={m.id === streamingId} script={script} peerName={peerName} onPlay={()=>playCard(m)}/>
        ))}
      </div>

      {/* 工具栏 (撤回 / 播放 / OOC / 表情 / 相机) */}
      <div style={{
        flex:'0 0 auto',
        display:'flex', justifyContent:'space-around', alignItems:'center',
        padding:'8px 18px',
        background:'rgba(255,255,255,.7)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderTop:'1px solid rgba(0,0,0,.04)',
      }}>
        <ToolBtn icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.6"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>} label="撤回"/>
        <ToolBtn icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="#666"><polygon points="5 3 19 12 5 21 5 3"/></svg>} label="续写"/>
        <ToolBtn
          active={oocMode}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill={oocMode ? '#FF6B5C' : 'none'} stroke={oocMode ? '#FF6B5C' : '#666'} strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke={oocMode ? '#fff' : 'currentColor'}/></svg>}
          label="OOC"
          onClick={()=>setOocMode(v=>!v)}/>
        <ToolBtn icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/><line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round"/><line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round"/></svg>} label="表情"/>
        <ToolBtn icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>} label="相机"/>
      </div>

      {/* 输入栏 */}
      <div style={{
        flex:'0 0 auto',
        padding:'10px 14px',
        paddingBottom:'max(10px, env(safe-area-inset-bottom))',
        background:'rgba(255,255,255,.85)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        display:'flex', gap:10, alignItems:'flex-end',
      }}>
        <textarea
          ref={taRef} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={onKey}
          placeholder={oocMode ? `戏外 · 对 ${peerName} 说点什么...` : `对 ${peerName} 说些什么, 或描述行动...`}
          rows={1}
          style={{
            flex:1, resize:'none', border:'1px solid rgba(0,0,0,.06)',
            outline:'0', padding:'8px 14px',
            background:'#fff', borderRadius:18,
            fontSize:14, lineHeight:1.5, maxHeight:100, minHeight:36,
            color:'#3a2820',
            fontFamily: 'inherit',
          }}/>
        <button onClick={send} disabled={!inp.trim() || sending} style={{
          background: inp.trim() ? 'rgba(0,0,0,.04)' : 'transparent',
          border:0, padding:8, cursor: inp.trim() ? 'pointer' : 'default',
          borderRadius:'50%', height:36, width:36,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {sending ? '…' : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.6">
              <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      <style>{`
        @keyframes chatSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {showTtsConfig && <TtsConfig onClose={()=>setShowTtsConfig(false)}/>}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background:'rgba(255,255,255,.7)', border:0, cursor:'pointer',
  padding:7, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
  boxShadow:'0 1px 3px rgba(0,0,0,.04)',
}

function ToolBtn({icon, label, active, onClick}:{
  icon:React.ReactNode; label:string; active?:boolean; onClick?:()=>void
}){
  return (
    <button onClick={onClick} style={{
      background:'none', border:0, cursor:'pointer',
      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
      padding:'4px 8px',
    }}>
      {icon}
      <span style={{fontSize:9, color: active ? '#FF6B5C' : '#888'}}>{label}</span>
    </button>
  )
}

// ==== 卡片: assistant 像车票, user 简洁行动描述 ====
function RpCard({msg, streaming, script, peerName, onPlay}:{
  msg: Msg; streaming?: boolean; script: Script; peerName: string; onPlay?: ()=>void
}){
  const isUser = msg.role === 'user'
  const isOOC = (msg as any).meta?.ooc

  if (isOOC){
    return (
      <div style={{textAlign:'center', margin:'4px 0', animation:'cardIn .25s ease-out'}}>
        <div style={{
          display:'inline-block', maxWidth:'85%',
          padding:'6px 14px',
          background:'rgba(0,0,0,.04)',
          border:'1px dashed rgba(120,80,60,.25)',
          borderRadius:8, fontSize:12,
          color:'#9c8060', fontStyle:'italic',
          fontFamily:'"Cormorant Garamond",serif',
        }}>
          <span style={{fontSize:9, color:'#c9a77e', letterSpacing:'1.5px', marginRight:6, fontStyle:'normal'}}>OOC</span>
          {msg.content}
        </div>
      </div>
    )
  }

  if (isUser){
    return (
      <div style={{
        padding: '4px 16px 4px 4px',
        animation:'cardIn .25s ease-out',
      }}>
        <div style={{
          fontSize: 14, lineHeight: 1.7,
          color: '#5c3a4a', fontStyle:'italic',
          fontFamily:'"Cormorant Garamond","PingFang SC",serif',
          textAlign:'right',
          whiteSpace:'pre-wrap',
        }}>
          {msg.content}
        </div>
      </div>
    )
  }

  // assistant 卡片
  const stamp = fmtStamp(msg.created_at)
  const wc = (msg.content || '').replace(/\s+/g, '').length
  return (
    <div style={{
      background:'rgba(255,255,255,.85)',
      backdropFilter:'blur(8px)',
      borderRadius: 14,
      padding: '14px 16px 12px',
      boxShadow: '0 4px 14px rgba(0,0,0,.04), 0 0 0 1px rgba(0,0,0,.03)',
      animation:'cardIn .25s ease-out',
      position:'relative',
    }}>
      {/* 头条 */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:10, paddingBottom:8,
        borderBottom:'1px dashed rgba(0,0,0,.06)',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {script.avatar ? (
            <img src={script.avatar} style={{width:32, height:32, borderRadius:'50%', objectFit:'cover'}}/>
          ) : (
            <div style={{width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#C9A77E,#8B6F47)'}}/>
          )}
          <div>
            <div style={{
              fontSize:14, fontWeight:600, color:'#3a2820',
              fontFamily:'"Cormorant Garamond","PingFang SC",serif',
            }}>{peerName}</div>
            <div style={{
              fontSize:10, color:'#999', letterSpacing:'.5px',
              fontFamily:'"Cormorant Garamond",serif', fontStyle:'italic',
            }}>{script.name}</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10, color:'#999', letterSpacing:'1px'}}>{stamp}</div>
            {wc > 0 && (
              <div style={{fontSize:10, color:'#bbb', marginTop:1}}>{wc} 字</div>
            )}
          </div>
          <button onClick={onPlay} title="播放对话" style={{
            background:'rgba(0,0,0,.04)', border:0, padding:0,
            width:28, height:28, borderRadius:'50%',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="#666"><polygon points="3 1.5 10 6 3 10.5"/></svg>
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div
        style={{
          fontSize:15, lineHeight:1.85, color:'#3a2820',
          fontFamily:'"Cormorant Garamond","PingFang SC","Source Han Serif SC",serif',
          letterSpacing:'.3px', whiteSpace:'pre-wrap', wordBreak:'break-word',
        }}
        dangerouslySetInnerHTML={{__html: rpFormat(applyRules(msg.content || '') || (streaming ? '<span style="color:#aaa">…</span>' : ''))}}
      />
    </div>
  )
}

function rpFormat(text: string): string {
  if (!text) return ''
  let s = text
  // 清洗 history pollution: 移除小宝幻想出来的 inline HTML / CSS 片段
  s = s.replace(/<\/?(?:span|div|strong|em|p|br|font|a|img)\b[^>]*>/gi, '')  // 标签
  s = s.replace(/\s*["'][^"']*display\s*:\s*inline-[^"']*["']\s*/g, ' ')   // "display:inline-..." style 串
  s = s.replace(/\s*["'][^"']*background\s*:\s*rgba?\([^"']*["']\s*/g, ' ') // "background:rgba..." 残片
  s = s.replace(/\s*["'][^"']*border-(?:left|radius)[^"']*["']\s*/g, ' ')
  s = s.replace(/\s*["'][^"']*letter-spacing[^"']*["']\s*/g, ' ')
  // 转义剩余 < > & 防 XSS
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#8B4513">$1</strong>')
  s = s.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em style="color:#8B7068;font-style:italic">$1</em>')
  // 对话引号 → 蓝灰卡片
  s = s.replace(/[「『""]([^「『""\n]+?)[」』""]/g,
    '<span style="display:inline-block;margin:6px 0;padding:8px 14px;background:rgba(150,170,200,.08);border-left:3px solid rgba(150,170,200,.4);border-radius:0 6px 6px 0;color:#3a4a5c;font-style:normal;letter-spacing:.5px">「$1」</span>')
  s = s.replace(/"([^"\n]{2,}?)"/g,
    '<span style="display:inline-block;margin:6px 0;padding:8px 14px;background:rgba(150,170,200,.08);border-left:3px solid rgba(150,170,200,.4);border-radius:0 6px 6px 0;color:#3a4a5c;letter-spacing:.5px">"$1"</span>')
  return s
}

function fmtStamp(iso: string): string {
  try {
    const d = new Date(iso)
    const mm = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    const hh = String(d.getHours()).padStart(2,'0')
    const mi = String(d.getMinutes()).padStart(2,'0')
    return `${mm}/${dd} ${hh}:${mi}`
  } catch { return '' }
}
