import { Msg, MsgMeta } from '../lib/api'
import { applyRules } from '../lib/regex'
import { ChatPrefs } from '../apps/ChatSettings'

export function TextBubble({msg, streaming, accent, prefs}:{
  msg: Msg; streaming?: boolean; accent: string; prefs: ChatPrefs
}){
  const isUser = msg.role === 'user'
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs}>
      <div
        className={`bubble-content ${isUser ? 'is-user' : 'is-ai'}`}
        style={{
          padding:'9px 13px',
          background: isUser ? 'var(--bubble-user-bg)' : 'var(--bubble-ai-bg)',
          backdropFilter:'blur(var(--bubble-blur, 8px))',
          WebkitBackdropFilter:'blur(var(--bubble-blur, 8px))',
          color: isUser ? 'var(--bubble-user-color)' : 'var(--bubble-ai-color)',
          borderRadius: isUser ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
          fontSize: prefs.fontSize, lineHeight:1.55,
          whiteSpace:'pre-wrap', wordBreak:'break-word',
          boxShadow:'0 1px 3px rgba(0,0,0,.04)',
          position:'relative',
        }}>
        {applyRules(msg.content) || (streaming ? <Typing/> : '')}
      </div>
    </BubbleWrap>
  )
}

export function ImageBubble({msg, accent, prefs, onView}:{
  msg: Msg; accent: string; prefs: ChatPrefs; onView:(url:string)=>void
}){
  const url = msg.meta?.url || ''
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs}>
      <div onClick={()=>url && onView(url)} style={{
        maxWidth:200, padding:3,
        background:'rgba(255,255,255,.78)',
        borderRadius: msg.role === 'user' ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
        boxShadow:'0 1px 3px rgba(0,0,0,.04)',
        cursor:'pointer', overflow:'hidden',
      }}>
        <img src={url} style={{
          width:'100%', display:'block',
          borderRadius: msg.role === 'user' ? '8px 0px 8px 8px' : '0px 8px 8px 8px',
        }}/>
      </div>
    </BubbleWrap>
  )
}

export function FakeImageBubble({msg, accent, prefs}:{
  msg: Msg; accent: string; prefs: ChatPrefs
}){
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs}>
      <div style={{
        maxWidth:200,
        background:'linear-gradient(135deg, #f0f0f3, #e3e3e8)',
        borderRadius: msg.role === 'user' ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
        boxShadow:'0 1px 3px rgba(0,0,0,.04)',
        overflow:'hidden',
      }}>
        <div style={{
          height:140,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'linear-gradient(135deg, #d0d0d8, #b8b8c2)',
          color:'#888', fontSize:32,
        }}>📷</div>
        <div style={{padding:'8px 10px'}}>
          <div style={{fontSize:11, color:'#999', marginBottom:2}}>图片</div>
          <div style={{fontSize:13, color:'#666', lineHeight:1.4}}>{msg.meta?.desc || msg.content}</div>
        </div>
      </div>
    </BubbleWrap>
  )
}

export function VoiceBubble({msg, accent, prefs}:{
  msg: Msg; accent: string; prefs: ChatPrefs
}){
  const dur = msg.meta?.duration ?? 3
  const isUser = msg.role === 'user'
  // 时长决定气泡宽度 (3s=70px, 60s=200px)
  const width = Math.min(200, 60 + Math.max(0, dur-1) * 6)
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs}>
      <div style={{
        width,
        padding:'10px 14px',
        background:'rgba(255,255,255,.78)',
        borderRadius: isUser ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
        boxShadow:'0 1px 3px rgba(0,0,0,.04)',
        display:'flex', alignItems:'center', gap:8,
        cursor:'pointer',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}>
        <Speaker color={accent}/>
        <span style={{flex:1, color:'#888', fontSize:13, textAlign: isUser ? 'right' : 'left'}}>{dur}″</span>
      </div>
      {msg.meta?.transcript && (
        <div style={{
          fontSize:11, color:'#999', marginTop:4,
          fontStyle:'italic', maxWidth:200,
        }}>"{msg.meta.transcript}"</div>
      )}
    </BubbleWrap>
  )
}

export function TransferBubble({msg, accent, prefs}:{
  msg: Msg; accent: string; prefs: ChatPrefs
}){
  const amount = msg.meta?.amount ?? 0
  const note = msg.meta?.note || '恭喜发财'
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs}>
      <div style={{
        width:200,
        background:'linear-gradient(135deg, #FF9A56, #FF6B35)',
        borderRadius:10,
        boxShadow:'0 2px 8px rgba(255,107,53,.25)',
        overflow:'hidden',
        cursor:'pointer',
      }}>
        <div style={{padding:'12px 14px', color:'#fff'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
            <span style={{fontSize:24}}>🧧</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11, opacity:.85}}>转账给你</div>
              <div style={{fontSize:18, fontWeight:700, marginTop:1}}>¥{amount.toFixed(2)}</div>
            </div>
          </div>
          <div style={{fontSize:12, opacity:.9, marginTop:4, lineHeight:1.4}}>{note}</div>
        </div>
        <div style={{
          background:'rgba(0,0,0,.1)',
          padding:'6px 14px',
          fontSize:11, color:'#fff', opacity:.85,
        }}>微信转账</div>
      </div>
    </BubbleWrap>
  )
}

export function LocationBubble({msg, accent, prefs}:{
  msg: Msg; accent: string; prefs: ChatPrefs
}){
  const poi = msg.meta?.poi || '某个地方'
  const addr = msg.meta?.addr || ''
  const isUser = msg.role === 'user'
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs}>
      <div style={{
        width:220,
        background:'#fff',
        borderRadius: isUser ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
        boxShadow:'0 1px 3px rgba(0,0,0,.06)',
        overflow:'hidden',
      }}>
        <div style={{
          height:110,
          background:`linear-gradient(135deg, #B8E0D2 0%, #A0D4C0 100%)`,
          position:'relative',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {/* 假地图: 网格 + pin */}
          <div style={{
            position:'absolute', inset:0,
            backgroundImage:`linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)`,
            backgroundSize:'20px 20px',
          }}/>
          {/* 假路径 */}
          <svg style={{position:'absolute', inset:0, opacity:.4}} viewBox="0 0 220 110">
            <path d="M0,40 Q60,20 110,55 T220,30" stroke="#fff" strokeWidth="3" fill="none"/>
            <path d="M0,80 L80,75 L160,90 L220,70" stroke="#fff" strokeWidth="2" fill="none" opacity=".7"/>
          </svg>
          <div style={{
            position:'relative', zIndex:1, fontSize:32,
            filter:'drop-shadow(0 2px 4px rgba(0,0,0,.2))',
          }}>📍</div>
        </div>
        <div style={{padding:'8px 12px'}}>
          <div style={{fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:2}}>{poi}</div>
          <div style={{fontSize:11, color:'#888', lineHeight:1.4}}>{addr}</div>
        </div>
      </div>
    </BubbleWrap>
  )
}

export function StickerBubble({msg, accent, prefs}:{
  msg: Msg; accent: string; prefs: ChatPrefs
}){
  return (
    <BubbleWrap msg={msg} accent={accent} prefs={prefs} noPad>
      <div style={{padding:4, fontSize:80, lineHeight:1}}>
        {msg.content}
      </div>
    </BubbleWrap>
  )
}

// === RP 模式: 沉浸大段排版, 无头像, 全宽, 衬线 ===
export function RpBubble({msg, streaming, prefs}:{
  msg: Msg; streaming?: boolean; prefs: ChatPrefs
}){
  const isUser = msg.role === 'user'
  const isOOC = (msg as any).meta?.ooc

  if (isOOC){
    // OOC 戏外发言 - 虚线灰底, 居中
    return (
      <div style={{textAlign:'center', margin:'12px 0', animation:'bubbleIn .2s ease-out'}}>
        <div style={{
          display:'inline-block', maxWidth:'85%',
          padding:'8px 14px',
          background:'rgba(0,0,0,.04)',
          border:'1px dashed rgba(120,80,60,.3)',
          borderRadius:8,
          fontSize:13, color:'#9c8060', fontStyle:'italic',
          fontFamily:'"Cormorant Garamond","PingFang SC",serif',
          textAlign:'left', whiteSpace:'pre-wrap',
        }}>
          <span style={{fontSize:10, color:'#c9a77e', letterSpacing:'1.5px', marginRight:8, fontStyle:'normal'}}>OOC</span>
          {msg.content}
        </div>
      </div>
    )
  }

  // 正常 RP 段落
  return (
    <div style={{
      animation:'bubbleIn .25s ease-out',
      padding: isUser ? '4px 0 4px 40px' : '4px 40px 4px 0',
      borderLeft: isUser ? 'none' : '2px solid rgba(184,122,140,.25)',
      borderRight: isUser ? '2px solid rgba(90,200,250,.3)' : 'none',
      marginLeft: isUser ? 16 : 0,
      marginRight: isUser ? 0 : 16,
    }}>
      <div style={{
        fontSize: prefs.fontSize + 1,
        lineHeight: 1.85,
        color: isUser ? '#5c3a4a' : '#3a2820',
        fontFamily:'"Cormorant Garamond","PingFang SC","Source Han Serif SC",serif',
        whiteSpace:'pre-wrap', wordBreak:'break-word',
        letterSpacing: '.3px',
        textAlign: isUser ? 'right' : 'left',
      }}
      dangerouslySetInnerHTML={{__html: rpFormat(msg.content || (streaming ? '...' : ''))}}/>
    </div>
  )
}

// RP 文本格式化: 对话/动作/旁白
function rpFormat(text: string): string {
  if (!text) return ''
  // 转义 HTML
  let s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  // **粗体** → 加重
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#8B4513">$1</strong>')
  // *动作描写* → 斜体古铜
  s = s.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em style="color:#8B7068;font-style:italic">$1</em>')
  // "对话" / "对话" → 加引号样式
  s = s.replace(/[""]([^""\n]+?)[""]/g, '<span style="color:#2b1820;font-weight:500">"$1"</span>')
  s = s.replace(/"([^"\n]+?)"/g, '<span style="color:#2b1820;font-weight:500">"$1"</span>')
  return s
}

export function SystemBubble({text}: {text:string}){
  return (
    <div style={{textAlign:'center', margin:'4px 0'}}>
      <span style={{
        display:'inline-block', padding:'4px 14px',
        background:'rgba(0,0,0,.05)', color:'#888',
        fontSize:12, borderRadius:10,
      }}>{text}</span>
    </div>
  )
}

// === 通用包装 (头像 + 排列) ===
function BubbleWrap({msg, accent, prefs, children, noPad}:{
  msg: Msg; accent: string; prefs: ChatPrefs; children: React.ReactNode; noPad?: boolean
}){
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display:'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems:'flex-start', gap:8,
      animation:'bubbleIn .2s ease-out',
    }}>
      <Avatar role={msg.role} accent={accent} prefs={prefs}/>
      <div style={{display:'flex', flexDirection:'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap:2, maxWidth:'72%'}}>
        {children}
      </div>
    </div>
  )
}

export function Avatar({role, accent, prefs}: {role:'user'|'assistant'; accent:string; prefs:ChatPrefs}){
  const isUser = role === 'user'
  const src = isUser ? prefs.myAvatar : prefs.peerAvatar
  const fallback = isUser ? '铭' : (prefs.peerName[0] || '宝')
  return (
    <div style={{
      width:42, height:42, borderRadius:'50%',
      background: src ? `url("${src}") center/cover`
        : (isUser ? 'linear-gradient(135deg,#5AC8FA,#34AADC)' : `linear-gradient(135deg, ${accent}, ${accent}CC)`),
      flex:'0 0 42px',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#fff', fontWeight:600, fontSize:15,
      boxShadow:'0 1px 3px rgba(0,0,0,.08)',
      border:'2px solid rgba(255,255,255,.6)',
    }}>{!src && fallback}</div>
  )
}

function Speaker({color}: {color: string}){
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <path d="M1 5v4a1 1 0 0 0 1 1h2l4 3V1L4 4H2a1 1 0 0 0-1 1z" fill={color}/>
      <path d="M11 4a3 3 0 0 1 0 6M13 1a6 6 0 0 1 0 12" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function Typing(){
  return (
    <span style={{display:'inline-flex', gap:3, padding:'4px 0'}}>
      <Dot delay={0}/>
      <Dot delay={.15}/>
      <Dot delay={.3}/>
      <style>{`@keyframes typingDot{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
    </span>
  )
}
function Dot({delay}:{delay:number}){
  return <span style={{
    width:6, height:6, borderRadius:'50%', background:'#999',
    animation:`typingDot 1.2s ${delay}s infinite ease-in-out`,
  }}/>
}
