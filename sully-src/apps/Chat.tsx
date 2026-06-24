import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import StatusBar from '../components/StatusBar'
import { Msg, fetchMessages, streamChat, newSession } from '../lib/api'
import ChatSettings, { ChatPrefs, DEFAULT_PREFS } from './ChatSettings'
import {
  TextBubble, ImageBubble, FakeImageBubble, VoiceBubble,
  TransferBubble, LocationBubble, StickerBubble, SystemBubble, RpBubble,
} from '../components/Bubbles'
import {
  PickImage, PickFakeImage, PickVoice, PickTransfer, PickLocation,
} from '../components/PlusActions'

interface Props { onBack: ()=>void; title?: string; subtitle?: string; chatId?: string; rpMode?: boolean; defaultSkin?: string }

type PlusModal = null | 'image' | 'fake_image' | 'voice' | 'transfer' | 'location'

export default function Chat({onBack, title='小宝', subtitle='在线', chatId='default', rpMode=false, defaultSkin='default'}: Props){
  const prefsKey = `chat_prefs_${chatId}`
  const [prefs, setPrefs] = useState<ChatPrefs>(()=>{
    try {
      const saved = localStorage.getItem(prefsKey)
      if (saved) return {...DEFAULT_PREFS, peerName: title, peerStatus: subtitle, ...JSON.parse(saved)}
    } catch {}
    return {...DEFAULT_PREFS, peerName: title, peerStatus: subtitle, skin: defaultSkin as any}
  })
  const updatePrefs = (p: Partial<ChatPrefs>) => {
    setPrefs(prev => {
      const next = {...prev, ...p}
      try { localStorage.setItem(prefsKey, JSON.stringify(next)) } catch {}
      return next
    })
  }
  const accentColor = prefs.accentColor
  const bgImage = prefs.bgImage

  const [msgs, setMsgs] = useState<Msg[]>([])
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingId, setStreamingId] = useState<number | null>(null)
  const [oocMode, setOocMode] = useState(false)
  const [showPlus, setShowPlus] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [plusModal, setPlusModal] = useState<PlusModal>(null)
  const [imgView, setImgView] = useState<string | null>(null)
  const msgsRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(()=>{
    fetchMessages().then(d => setMsgs(d.messages || []))
  },[])

  const scrollBottom = useCallback(()=>{
    const el = msgsRef.current
    if (el) el.scrollTop = el.scrollHeight
  },[])
  useEffect(()=> scrollBottom(), [msgs, streamingId, scrollBottom])

  useEffect(()=>{
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
  }, [inp])

  const grouped = useMemo(()=>{
    const out: ({type:'time', t:string} | {type:'msg', m:Msg})[] = []
    let lastTs = 0
    for (const m of msgs){
      const ts = new Date(m.created_at).getTime()
      if (ts - lastTs > 5*60*1000){
        out.push({type:'time', t: fmtTime(m.created_at)})
        lastTs = ts
      }
      out.push({type:'msg', m})
    }
    return out
  }, [msgs])

  // 发文字 (流式调后端)
  const sendText = async (text: string, imagePath?: string)=>{
    let apiText = text
    if ((!text.trim() && !imagePath) || sending) return
    setSending(true); setShowPlus(false); setShowEmoji(false)

    if (text.trim()){
      setMsgs(p => [...p, {
        id: Date.now(), role:'user', content: text,
        created_at: new Date().toISOString(), kind:'text',
        ...(oocMode ? {meta:{ooc:true} as any} : {}),
      }])
    }
    apiText = oocMode ? `[OOC: ${text}]` : text

    const placeholderId = Date.now() + 1
    setStreamingId(placeholderId)
    setMsgs(p => [...p, {id: placeholderId, role:'assistant', content:'', created_at:new Date().toISOString(), kind:'text'}])

    abortRef.current = new AbortController()
    let assembled = ''
    try {
      await streamChat({
        content: apiText || (imagePath ? '看下这张图' : ''),
        image_paths: imagePath ? [imagePath] : undefined,
      }, (ev)=>{
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
    }
  }

  const handleSendText = ()=>{
    const text = inp.trim()
    if (!text) return
    setInp('')
    sendText(text)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSendText() }
  }

  const insertEmoji = (em: string) => { setInp(p => p + em); taRef.current?.focus() }

  // 添加本地消息 (不调后端)
  const pushLocal = (msg: Msg) => setMsgs(p => [...p, msg])

  return (
    <div className={`chat-skin-${prefs.skin || 'default'}`} style={{
      position:'absolute', inset:0,
      background: bgImage
        ? `url("${bgImage}") center/cover no-repeat fixed`
        : 'var(--chat-bg)',
      display:'flex', flexDirection:'column',
      animation:'chatSlide .25s ease-out',
    }}>
      <StatusBar tint="var(--status-tint, #3a2820)"/>

      {/* 标题栏 */}
      <div style={{
        flex:'0 0 auto',
        display:'flex', alignItems:'center', gap:10,
        padding:'8px 12px',
        background:'var(--nav-bg)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderBottom:'.5px solid var(--border-color)',
        minHeight:44,
      }}>
        <button onClick={onBack} style={iconBtn(accentColor, 24)}>‹</button>
        <div style={{flex:1, display:'flex', alignItems:'center', gap:10, justifyContent:'center'}}>
          <div style={{
            width:30, height:30, borderRadius:'50%',
            background: prefs.peerAvatar ? `url("${prefs.peerAvatar}") center/cover` : `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontWeight:600, fontSize:12,
            border:'1.5px solid rgba(255,255,255,.6)',
          }}>{!prefs.peerAvatar && prefs.peerName[0]}</div>
          <div style={{textAlign:'left'}}>
            <div style={{fontSize:15, fontWeight:600, color:'var(--nav-color)'}}>{prefs.peerName}</div>
            <div style={{fontSize:10, color:'var(--nav-sub)'}}>{prefs.peerStatus}</div>
          </div>
        </div>
        <button onClick={()=>setShowSettings(true)} style={iconBtn('var(--nav-color)', 22)}>⋯</button>
      </div>

      {/* 消息流 */}
      <div ref={msgsRef} style={{
        flex:1, overflowY:'auto', padding:'14px 12px 8px',
        display:'flex', flexDirection:'column', gap:14,
      }}>
        {grouped.length === 0 && (
          <div style={{textAlign:'center', padding:'40px 0'}}>
            <span style={{display:'inline-block', padding:'4px 10px', background:'rgba(255,255,255,.5)', borderRadius:10, fontSize:11, color:'#999'}}>
              开始聊天吧
            </span>
          </div>
        )}
        {grouped.map((g, i) =>
          g.type === 'time' ? <TimeRow key={'t'+i} t={g.t}/> : renderMsg(g.m)
        )}
      </div>

      {/* 设置 drawer */}
      <ChatSettings
        open={showSettings} prefs={prefs} onUpdate={updatePrefs}
        onClose={()=>setShowSettings(false)}
        onPoke={()=>{
          setShowSettings(false)
          pushLocal({id:Date.now(), role:'user', content:`小铭拍了拍${prefs.peerName}`,
            created_at:new Date().toISOString(), kind:'system'})
        }}
        onNewSession={async ()=>{
          setShowSettings(false); await newSession(); setMsgs([])
        }}
        onClear={()=>{ setShowSettings(false); setMsgs([]) }}
      />

      {/* + 面板 */}
      {showPlus && (
        <PlusPanel accent={accentColor} onPick={(k)=>{ setShowPlus(false); setPlusModal(k) }}/>
      )}
      {/* 表情面板 */}
      {showEmoji && <EmojiPanel onPick={insertEmoji}/>}

      {/* 输入区 */}
      <div style={{
        flex:'0 0 auto',
        padding:'8px 10px',
        paddingBottom:'max(8px, env(safe-area-inset-bottom))',
        background:'var(--input-area-bg)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderTop:'.5px solid var(--border-color)',
        display:'flex', gap:8, alignItems:'flex-end',
      }}>
        {rpMode && (
          <button onClick={()=>setOocMode(v=>!v)} title={oocMode ? 'OOC 模式 (戏外)' : '点击切换 OOC'}
            style={{
              background: oocMode ? '#FF6B5C' : 'transparent',
              border: oocMode ? 0 : '1px solid var(--border-color)',
              color: oocMode ? '#fff' : 'var(--input-color)',
              cursor:'pointer', fontSize:11, fontWeight:600,
              padding:'0 10px', borderRadius:18, height:36,
              display:'flex', alignItems:'center',
              letterSpacing:'.5px',
            }}>OOC</button>
        )}
        {!rpMode && (
          <button onClick={()=>{setShowEmoji(v=>!v); setShowPlus(false)}}
            style={iconBtn(showEmoji ? accentColor : '#666', 0)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round"/>
              <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round"/>
              <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <textarea ref={taRef} value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={onKeyDown}
          onFocus={()=>{setShowPlus(false); setShowEmoji(false)}} placeholder={oocMode ? "戏外发言 (OOC)..." : (rpMode ? "用动作和对话推进剧情..." : "想聊点什么...")} rows={1}
          className="chat-input"
          style={{
            flex:1, resize:'none', border:'0', outline:'0',
            padding:'8px 14px', background:'var(--input-bg)', borderRadius:20,
            fontSize:15, fontFamily:'inherit', lineHeight:1.4, maxHeight:100, minHeight:36, color:'var(--input-color)',
          }}/>
        {inp.trim() ? (
          <button onClick={handleSendText} disabled={sending} style={{
            background: accentColor, color:'#fff', border:0, borderRadius:20,
            padding:'8px 16px', fontSize:14, fontWeight:600, cursor:'pointer',
            height:36, minWidth:60, boxShadow:`0 2px 6px ${accentColor}33`,
          }}>{sending ? '…' : '发送'}</button>
        ) : (
          <button onClick={()=>{setShowPlus(v=>!v); setShowEmoji(false)}}
            style={iconBtn(showPlus ? accentColor : '#666', 0)}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="13" cy="13" r="10"/>
              <line x1="13" y1="9" x2="13" y2="17" strokeLinecap="round"/>
              <line x1="9" y1="13" x2="17" y2="13" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Plus 各种动作 modal */}
      {plusModal === 'image' && (
        <PickImage accent={accentColor} onCancel={()=>setPlusModal(null)}
          onPicked={async (url)=>{
            setPlusModal(null)
            pushLocal({id:Date.now(), role:'user', content:'[图片]',
              created_at:new Date().toISOString(), kind:'image', meta:{url}})
            // 调后端识图
            await sendText('', url)
          }}/>
      )}
      {plusModal === 'fake_image' && (
        <PickFakeImage accent={accentColor} onCancel={()=>setPlusModal(null)}
          onPicked={(desc)=>{
            setPlusModal(null)
            pushLocal({id:Date.now(), role:'user', content:desc,
              created_at:new Date().toISOString(), kind:'fake_image', meta:{desc}})
            sendText(`(我刚发给你一张图: ${desc})`)
          }}/>
      )}
      {plusModal === 'voice' && (
        <PickVoice accent={accentColor} onCancel={()=>setPlusModal(null)}
          onPicked={(duration, transcript)=>{
            setPlusModal(null)
            pushLocal({id:Date.now(), role:'user', content:transcript || `[语音 ${duration}″]`,
              created_at:new Date().toISOString(), kind:'voice', meta:{duration, transcript}})
            if (transcript) sendText(`(我刚发了条 ${duration}″ 语音): ${transcript}`)
          }}/>
      )}
      {plusModal === 'transfer' && (
        <PickTransfer accent={accentColor} onCancel={()=>setPlusModal(null)}
          onPicked={(amount, note)=>{
            setPlusModal(null)
            pushLocal({id:Date.now(), role:'user', content:`转账 ¥${amount}`,
              created_at:new Date().toISOString(), kind:'transfer', meta:{amount, note}})
            sendText(`(我给你转了 ¥${amount}: ${note})`)
          }}/>
      )}
      {plusModal === 'location' && (
        <PickLocation accent={accentColor} onCancel={()=>setPlusModal(null)}
          onPicked={(poi, addr)=>{
            setPlusModal(null)
            pushLocal({id:Date.now(), role:'user', content:poi,
              created_at:new Date().toISOString(), kind:'location', meta:{poi, addr}})
            sendText(`(我把位置发给你了: ${poi}${addr ? ' - ' + addr : ''})`)
          }}/>
      )}

      {/* 图片大图查看 */}
      {imgView && (
        <div onClick={()=>setImgView(null)} style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.92)', zIndex:70,
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
        }}>
          <img src={imgView} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}/>
        </div>
      )}

      <style>{`
        @keyframes chatSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes bubbleIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes panelIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>
    </div>
  )

  function renderMsg(m: Msg){
    const k = m.kind || 'text'
    if (k === 'system') return <SystemBubble key={m.id} text={m.content}/>
    if (k === 'image')     return <ImageBubble key={m.id} msg={m} accent={accentColor} prefs={prefs} onView={setImgView}/>
    if (k === 'fake_image')return <FakeImageBubble key={m.id} msg={m} accent={accentColor} prefs={prefs}/>
    if (k === 'voice')     return <VoiceBubble key={m.id} msg={m} accent={accentColor} prefs={prefs}/>
    if (k === 'transfer')  return <TransferBubble key={m.id} msg={m} accent={accentColor} prefs={prefs}/>
    if (k === 'location')  return <LocationBubble key={m.id} msg={m} accent={accentColor} prefs={prefs}/>
    if (k === 'sticker')   return <StickerBubble key={m.id} msg={m} accent={accentColor} prefs={prefs}/>
    if (rpMode)            return <RpBubble key={m.id} msg={m} streaming={m.id === streamingId} prefs={prefs}/>
    return <TextBubble key={m.id} msg={m} streaming={m.id === streamingId} accent={accentColor} prefs={prefs}/>
  }
}

function iconBtn(color: string, fontSize: number): React.CSSProperties{
  return {
    background:'none', border:0, color, fontSize: fontSize || 22,
    cursor:'pointer', padding:'4px 8px', lineHeight:1,
    display:'flex', alignItems:'center', justifyContent:'center',
    height: fontSize ? 'auto' : 36, width: fontSize ? 'auto' : 36,
  }
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const today = now.toDateString() === d.toDateString()
    const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
    const hh = String(d.getHours()).padStart(2,'0')
    const mm = String(d.getMinutes()).padStart(2,'0')
    if (today) return `${hh}:${mm}`
    if (yesterday) return `昨天 ${hh}:${mm}`
    return `${d.getMonth()+1}月${d.getDate()}日 ${hh}:${mm}`
  } catch { return '' }
}

function TimeRow({t}:{t:string}){
  return (
    <div style={{textAlign:'center', margin:'4px 0'}}>
      <span style={{display:'inline-block', padding:'2px 10px', background:'var(--time-bg)', color:'var(--time-color)', fontSize:11, borderRadius:8}}>{t}</span>
    </div>
  )
}

function PlusPanel({accent, onPick}:{accent:string; onPick:(k:'image'|'fake_image'|'voice'|'transfer'|'location')=>void}){
  const items: {k:'image'|'fake_image'|'voice'|'transfer'|'location'; icon:string; name:string}[] = [
    {k:'image',      icon:'📷', name:'相册'},
    {k:'fake_image', icon:'🖼️', name:'假图片'},
    {k:'voice',      icon:'🎤', name:'语音'},
    {k:'transfer',   icon:'🧧', name:'转账'},
    {k:'location',   icon:'📍', name:'位置'},
  ]
  return (
    <div style={{
      flex:'0 0 auto',
      background:'var(--panel-bg)',
      backdropFilter:'blur(20px)',
      WebkitBackdropFilter:'blur(20px)',
      borderTop:'.5px solid var(--border-color)',
      padding:'14px 18px 8px',
      animation:'panelIn .2s ease-out',
    }}>
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px 8px'}}>
        {items.map(it => (
          <button key={it.k} onClick={()=>onPick(it.k)} style={{
            background:'none', border:0, cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:6,
          }}>
            <div className="plus-tile" style={{
              width:52, height:52, borderRadius:12,
              background:'var(--plus-tile-bg)', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:24, boxShadow:'0 2px 6px rgba(0,0,0,.06)',
            }}>{it.icon}</div>
            <div style={{fontSize:11, color:'var(--plus-tile-color)'}}>{it.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

const EMOJI = ['😊','😂','🥺','😘','😍','🤔','😴','🥰','😎','😢','😡','😋','🤗','😉','😏','🙄','😬','🤤','😌','🥲','😇','🥳','😤','🙂','😐','🤭','😪','🤧','😷','🤒','💖','💕','💗','💓','💝','💞','🌸','🌹','🌺','🌷','✨','⭐','💫','🌙','☀️','☁️','🌈','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💌','💐']
function EmojiPanel({onPick}:{onPick:(e:string)=>void}){
  return (
    <div style={{
      flex:'0 0 auto', maxHeight:240, overflowY:'auto',
      background:'rgba(247,247,247,.92)',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      borderTop:'.5px solid rgba(0,0,0,.06)', padding:'14px 14px',
      animation:'panelIn .2s ease-out',
    }}>
      <div style={{display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:'8px 4px'}}>
        {EMOJI.map(e => (
          <button key={e} onClick={()=>onPick(e)} style={{
            background:'none', border:0, cursor:'pointer', fontSize:22, padding:6, borderRadius:8,
          }}>{e}</button>
        ))}
      </div>
    </div>
  )
}
