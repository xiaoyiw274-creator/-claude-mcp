import { useState, useRef } from 'react'

interface ModalProps {
  title: string
  onClose: ()=>void
  children: React.ReactNode
}
function Modal({title, onClose, children}: ModalProps){
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:60,
      background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:20,
      animation:'fadeIn .15s ease-out',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14,
        width:'100%', maxWidth:320,
        padding:'18px 18px 14px',
        animation:'popIn .2s ease-out',
      }}>
        <div style={{fontSize:16, fontWeight:600, color:'#1a1a1a', marginBottom:12}}>{title}</div>
        {children}
      </div>
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  )
}

// === 真图片上传 ===
export function PickImage({onPicked, onCancel, accent}:{
  onPicked:(url:string)=>void
  onCancel:()=>void
  accent:string
}){
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handle = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    const dataUrl = await new Promise<string>(res=>{
      const r = new FileReader(); r.onload=()=>res(r.result as string); r.readAsDataURL(f)
    })
    try {
      const r = await fetch('/api/upload', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({data: dataUrl}),
      }).then(r=>r.json())
      if (r.path) onPicked(r.path)
      else alert('上传失败')
    } catch(ex:any){ alert(ex.message) }
    setBusy(false)
  }

  return (
    <Modal title="发送图片" onClose={onCancel}>
      <button onClick={()=>ref.current?.click()} style={btnFill(accent)}>
        {busy ? '上传中…' : '从相册选择'}
      </button>
      <button onClick={onCancel} style={btnGhost}>取消</button>
      <input ref={ref} type="file" accept="image/*" onChange={handle} style={{display:'none'}}/>
    </Modal>
  )
}

// === 假图片 (描述) ===
export function PickFakeImage({onPicked, onCancel, accent}:{
  onPicked:(desc:string)=>void
  onCancel:()=>void
  accent:string
}){
  const [v, setV] = useState('')
  return (
    <Modal title="发个假图片" onClose={onCancel}>
      <div style={{fontSize:12, color:'#888', marginBottom:10}}>形容这张图片的内容</div>
      <textarea value={v} onChange={e=>setV(e.target.value)} placeholder="例: 我家猫趴在窗台晒太阳"
        autoFocus style={inputStyle}/>
      <button onClick={()=>v.trim() && onPicked(v.trim())} disabled={!v.trim()} style={btnFill(accent, !v.trim())}>发送</button>
      <button onClick={onCancel} style={btnGhost}>取消</button>
    </Modal>
  )
}

// === 语音 (按住录音 mock) ===
export function PickVoice({onPicked, onCancel, accent}:{
  onPicked:(duration:number, transcript?:string)=>void
  onCancel:()=>void
  accent:string
}){
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const timerRef = useRef<number | null>(null)

  const start = ()=>{
    setRecording(true)
    setDuration(0)
    const t0 = Date.now()
    timerRef.current = window.setInterval(()=>{
      setDuration(Math.floor((Date.now() - t0)/1000))
    }, 200)
  }
  const stop = ()=>{
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  return (
    <Modal title="发个语音" onClose={onCancel}>
      <div style={{textAlign:'center', padding:'12px 0'}}>
        <button
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          style={{
            width:96, height:96, borderRadius:'50%',
            background: recording ? '#FF3B30' : accent,
            color:'#fff', border:0,
            fontSize:40, cursor:'pointer',
            transition:'transform .15s',
            transform: recording ? 'scale(1.1)' : 'scale(1)',
            boxShadow: recording ? '0 0 0 8px rgba(255,59,48,.2)' : `0 4px 12px ${accent}40`,
          }}>🎤</button>
        <div style={{marginTop:14, fontSize:14, color:'#666'}}>
          {recording ? `录音中 ${duration}″` : duration > 0 ? `${duration}″` : '按住录音'}
        </div>
      </div>
      <div style={{fontSize:12, color:'#888', marginBottom:6}}>转录文字 (可选)</div>
      <input value={transcript} onChange={e=>setTranscript(e.target.value)}
        placeholder="语音里说了什么"
        style={{...inputStyle, height:36, padding:'6px 10px'}}/>
      <button onClick={()=>duration > 0 ? onPicked(duration || 1, transcript || undefined) : onCancel()}
        style={btnFill(accent, duration === 0 && !transcript)}>
        {duration > 0 ? '发送' : '取消'}
      </button>
    </Modal>
  )
}

// === 转账 ===
export function PickTransfer({onPicked, onCancel, accent}:{
  onPicked:(amount:number, note:string)=>void
  onCancel:()=>void
  accent:string
}){
  const [amt, setAmt] = useState('')
  const [note, setNote] = useState('')
  return (
    <Modal title="转账" onClose={onCancel}>
      <div style={{
        textAlign:'center', padding:'18px 0',
        background:'linear-gradient(135deg, #FF9A56, #FF6B35)',
        borderRadius:10, marginBottom:14, color:'#fff',
      }}>
        <div style={{fontSize:11, opacity:.85, marginBottom:4}}>金额</div>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'center'}}>
          <span style={{fontSize:24, fontWeight:300, marginRight:4}}>¥</span>
          <input value={amt} onChange={e=>setAmt(e.target.value.replace(/[^\d.]/g,''))}
            placeholder="0.00" autoFocus
            style={{
              background:'transparent', border:0, outline:0,
              color:'#fff', fontSize:36, fontWeight:600,
              textAlign:'center', width:160,
            }}/>
        </div>
      </div>
      <div style={{fontSize:12, color:'#888', marginBottom:6}}>留言</div>
      <input value={note} onChange={e=>setNote(e.target.value)}
        placeholder="转账给你" style={{...inputStyle, height:36, padding:'6px 10px'}}/>
      <button onClick={()=>{
        const n = parseFloat(amt)
        if (n > 0) onPicked(n, note || '转账给你')
      }} disabled={!parseFloat(amt)} style={btnFill('#FF6B35', !parseFloat(amt))}>转账</button>
      <button onClick={onCancel} style={btnGhost}>取消</button>
    </Modal>
  )
}

// === 位置 ===
export function PickLocation({onPicked, onCancel, accent}:{
  onPicked:(poi:string, addr:string)=>void
  onCancel:()=>void
  accent:string
}){
  const [poi, setPoi] = useState('')
  const [addr, setAddr] = useState('')
  const PRESETS = [
    {p:'家',     a:'温暖的小窝'},
    {p:'公司',   a:'每天搬砖的地方'},
    {p:'樱花树下', a:'我们第一次见面的地方'},
    {p:'海边',   a:'在听浪'},
  ]
  return (
    <Modal title="发送位置" onClose={onCancel}>
      <input value={poi} onChange={e=>setPoi(e.target.value)} placeholder="地点名 (如: 中关村)"
        autoFocus style={{...inputStyle, height:36, padding:'6px 10px', marginBottom:8}}/>
      <input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="详细地址"
        style={{...inputStyle, height:36, padding:'6px 10px'}}/>
      <div style={{fontSize:12, color:'#888', margin:'10px 0 6px'}}>快速选择</div>
      <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:8}}>
        {PRESETS.map(p => (
          <button key={p.p} onClick={()=>{setPoi(p.p); setAddr(p.a)}}
            style={{
              padding:'5px 10px', fontSize:12,
              background:'#f5f5f7', border:0, borderRadius:6,
              color:'#666', cursor:'pointer',
            }}>{p.p}</button>
        ))}
      </div>
      <button onClick={()=>poi.trim() && onPicked(poi.trim(), addr.trim())}
        disabled={!poi.trim()} style={btnFill(accent, !poi.trim())}>发送</button>
      <button onClick={onCancel} style={btnGhost}>取消</button>
    </Modal>
  )
}

// === 共用样式 ===
const inputStyle: React.CSSProperties = {
  width:'100%', padding:'8px 10px',
  border:'1px solid #e0e0e5', borderRadius:8,
  fontSize:14, fontFamily:'inherit',
  outline:'none', resize:'none',
  background:'#fafafa', boxSizing:'border-box',
  minHeight:60, marginBottom:10,
}
function btnFill(color: string, disabled?: boolean): React.CSSProperties{
  return {
    width:'100%', padding:'10px',
    background: disabled ? '#ccc' : color, color:'#fff', border:0, borderRadius:8,
    fontSize:14, fontWeight:600, cursor: disabled ? 'default' : 'pointer',
    marginTop:4,
  }
}
const btnGhost: React.CSSProperties = {
  width:'100%', padding:'10px',
  background:'#f5f5f7', color:'#666', border:0, borderRadius:8,
  fontSize:14, cursor:'pointer',
  marginTop:6,
}
