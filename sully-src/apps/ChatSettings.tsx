import { useState } from 'react'

export type ChatSkin = 'default' | 'rabbit_ears' | 'wechat' | 'dark' | 'cream' | 'ancient' | 'qq'

export interface ChatPrefs {
  peerName: string
  peerStatus: string
  peerAvatar?: string
  myAvatar?: string
  bgImage?: string
  accentColor: string
  fontSize: number
  skin?: ChatSkin
}

export const DEFAULT_PREFS: ChatPrefs = {
  peerName: '小宝',
  peerStatus: '在线',
  accentColor: '#FF8FA3',
  fontSize: 15,
  skin: 'default',
}

const SKINS: {id:ChatSkin; name:string; sample:{bg:string; color:string; deco?:string}}[] = [
  {id:'default',     name:'默认樱花',  sample:{bg:'#FFEEF2', color:'#585858'}},
  {id:'rabbit_ears', name:'粉萌兔耳',  sample:{bg:'#FFF5F7', color:'#BF7A85'}},
  {id:'wechat',      name:'经典微信',  sample:{bg:'#95EC69', color:'#1a1a1a'}},
  {id:'cream',       name:'奶油泡',    sample:{bg:'#FFFAF0', color:'#6B4F3F'}},
  {id:'dark',        name:'暗夜',      sample:{bg:'#2c2c2e', color:'#E8E8EA'}},
  {id:'ancient',     name:'古书',      sample:{bg:'#FBF6EE', color:'#3a2820'}},
  {id:'qq',          name:'仿 QQ',     sample:{bg:'#4397F7', color:'#fff'}},
]

const PRESET_COLORS = [
  {n:'樱花粉', c:'#FF8FA3'},
  {n:'微信绿', c:'#34C759'},
  {n:'天空蓝', c:'#5AC8FA'},
  {n:'葡萄紫', c:'#AF52DE'},
  {n:'落日橙', c:'#FF9F0A'},
  {n:'墨黑',   c:'#2C2C2E'},
]

const FONT_SIZES = [13, 15, 17, 19]

interface Props {
  open: boolean
  prefs: ChatPrefs
  onUpdate: (p: Partial<ChatPrefs>)=>void
  onClose: ()=>void
  onPoke: ()=>void
  onNewSession: ()=>void
  onClear: ()=>void
}

export default function ChatSettings({open, prefs, onUpdate, onClose, onPoke, onNewSession, onClear}: Props){
  if (!open) return null

  return (
    <>
      {/* mask */}
      <div onClick={onClose} style={{
        position:'absolute', inset:0,
        background:'rgba(0,0,0,.3)',
        zIndex:50,
        animation:'maskIn .2s ease-out',
      }}/>
      {/* drawer */}
      <div style={{
        position:'absolute', top:0, right:0, bottom:0,
        width:'88%', maxWidth:340,
        background:'#F2F2F7',
        zIndex:51,
        display:'flex', flexDirection:'column',
        animation:'drawerIn .25s ease-out',
        overflowY:'auto',
      }}>
        {/* header */}
        <div style={{
          padding:'12px 16px',
          paddingTop:'max(12px, env(safe-area-inset-top))',
          background:'rgba(255,255,255,.85)',
          backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          display:'flex', alignItems:'center', gap:8,
          borderBottom:'.5px solid rgba(0,0,0,.06)',
          position:'sticky', top:0, zIndex:2,
        }}>
          <div style={{flex:1, fontSize:17, fontWeight:600, color:'#1a1a1a'}}>聊天设置</div>
          <button onClick={onClose} style={{
            background:'none', border:0, color:'#FF8FA3',
            fontSize:15, cursor:'pointer', padding:'4px 8px',
          }}>完成</button>
        </div>

        <div style={{padding:'14px 0 30px'}}>
          {/* 对方信息 */}
          <Section title="对方">
            <Avatar
              label="对方头像"
              src={prefs.peerAvatar}
              onChange={(src)=>onUpdate({peerAvatar: src})}
              fallback={prefs.peerName[0]}
              fallbackBg={prefs.accentColor}
            />
            <TextRow label="昵称" value={prefs.peerName} onChange={(v)=>onUpdate({peerName: v})}/>
            <TextRow label="状态" value={prefs.peerStatus} placeholder="在线 / 离线 / 上次活跃..." onChange={(v)=>onUpdate({peerStatus: v})}/>
          </Section>

          {/* 我的 */}
          <Section title="我的">
            <Avatar
              label="我的头像"
              src={prefs.myAvatar}
              onChange={(src)=>onUpdate({myAvatar: src})}
              fallback="铭"
              fallbackBg="#5AC8FA"
            />
          </Section>

          {/* 外观 */}
          <Section title="外观">
            <Row label="整体主题">
              <div style={{display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:'70%'}}>
                {SKINS.map(s => (
                  <button key={s.id} onClick={()=>onUpdate({skin: s.id})}
                    title={s.name}
                    style={{
                      padding:'4px 9px',
                      background: s.sample.bg, color: s.sample.color,
                      border: prefs.skin === s.id ? '1.5px solid #FF8FA3' : '1.5px solid transparent',
                      borderRadius:8, fontSize:11, cursor:'pointer',
                      whiteSpace:'nowrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,.06)',
                    }}>
                    {s.sample.deco}{s.name}
                  </button>
                ))}
              </div>
            </Row>
            <Avatar
              label="聊天背景"
              src={prefs.bgImage}
              onChange={(src)=>onUpdate({bgImage: src})}
              fallback="无"
              fallbackBg="#ddd"
              wide
            />
            <Row label="气泡主色">
              <div style={{display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end'}}>
                {PRESET_COLORS.map(c => (
                  <button key={c.c} onClick={()=>onUpdate({accentColor: c.c})}
                    title={c.n}
                    style={{
                      width:24, height:24, borderRadius:'50%',
                      background:c.c,
                      border: prefs.accentColor === c.c ? '2.5px solid #fff' : '2.5px solid transparent',
                      boxShadow: prefs.accentColor === c.c ? `0 0 0 1.5px ${c.c}` : '0 1px 2px rgba(0,0,0,.1)',
                      cursor:'pointer', padding:0,
                    }}/>
                ))}
              </div>
            </Row>
            <Row label="字号">
              <div style={{display:'flex', gap:6}}>
                {FONT_SIZES.map(s => (
                  <button key={s} onClick={()=>onUpdate({fontSize: s})}
                    style={{
                      padding:'4px 10px',
                      background: prefs.fontSize === s ? prefs.accentColor : '#fff',
                      color: prefs.fontSize === s ? '#fff' : '#666',
                      border:0, borderRadius:6, fontSize:12, cursor:'pointer',
                    }}>{s === 13 ? '小' : s === 15 ? '标准' : s === 17 ? '大' : '特大'}</button>
                ))}
              </div>
            </Row>
          </Section>

          {/* 动作 */}
          <Section title="互动">
            <ActionRow icon="👋" label="戳一戳" desc="给对方发个提醒" onClick={onPoke}/>
            <ActionRow icon="🗨️" label="新开一个会话" desc="历史保留, 开启新对话" onClick={onNewSession}/>
            <ActionRow icon="🧹" label="清空聊天记录" desc="只清前端显示" danger onClick={onClear}/>
          </Section>
        </div>
      </div>

      <style>{`
        @keyframes maskIn { from{opacity:0} to{opacity:1} }
        @keyframes drawerIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
      `}</style>
    </>
  )
}

function Section({title, children}:{title:string; children:React.ReactNode}){
  return (
    <>
      <div style={{padding:'18px 18px 4px', fontSize:12, color:'#999', letterSpacing:'.5px', textTransform:'uppercase'}}>
        {title}
      </div>
      <div style={{background:'#fff', margin:'0 14px', borderRadius:12, overflow:'hidden'}}>
        {children}
      </div>
    </>
  )
}

function Row({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 14px',
      borderBottom:'.5px solid rgba(0,0,0,.05)',
      minHeight:42,
    }}>
      <div style={{flex:1, fontSize:14, color:'#1a1a1a'}}>{label}</div>
      {children}
    </div>
  )
}

function TextRow({label, value, onChange, placeholder}:{
  label:string; value:string; placeholder?:string;
  onChange:(v:string)=>void;
}){
  return (
    <Row label={label}>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{
          flex:'0 0 60%',
          border:0, outline:0, textAlign:'right',
          fontSize:14, color:'#666', background:'transparent',
        }}/>
    </Row>
  )
}

function Avatar({label, src, onChange, fallback, fallbackBg, wide}:{
  label:string; src?:string; onChange:(src:string|undefined)=>void;
  fallback:string; fallbackBg:string; wide?:boolean;
}){
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const dataUrl = await new Promise<string>(res=>{
      const r = new FileReader()
      r.onload = ()=> res(r.result as string)
      r.readAsDataURL(f)
    })
    // 上传到 VPS
    try {
      const r = await fetch('/api/upload', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({data: dataUrl}),
      }).then(r=>r.json())
      if (r.path) onChange(r.path)
      else alert('上传失败: ' + (r.error || ''))
    } catch (ex:any){ alert('错误: ' + ex.message) }
    e.target.value = ''
  }

  const id = `f-${label}`
  return (
    <Row label={label}>
      <label htmlFor={id} style={{cursor:'pointer'}}>
        {wide ? (
          <div style={{
            width:60, height:36, borderRadius:6,
            background: src ? `url("${src}") center/cover` : fallbackBg,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:11,
          }}>{!src && fallback}</div>
        ) : (
          <div style={{
            width:36, height:36, borderRadius:'50%',
            background: src ? `url("${src}") center/cover` : fallbackBg,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', fontSize:14, fontWeight:600,
          }}>{!src && fallback}</div>
        )}
      </label>
      {src && (
        <button onClick={()=>onChange(undefined)} style={{
          background:'none', border:0, color:'#FF3B30',
          fontSize:13, cursor:'pointer', padding:'4px 8px',
        }}>清除</button>
      )}
      <input id={id} type="file" accept="image/*" onChange={onFile} style={{display:'none'}}/>
    </Row>
  )
}

function ActionRow({icon, label, desc, danger, onClick}:{
  icon:string; label:string; desc?:string;
  danger?:boolean; onClick:()=>void;
}){
  return (
    <button onClick={onClick} style={{
      width:'100%', background:'none', border:0, cursor:'pointer',
      padding:'10px 14px',
      borderBottom:'.5px solid rgba(0,0,0,.05)',
      display:'flex', alignItems:'center', gap:12,
      textAlign:'left',
    }}>
      <div style={{
        width:30, height:30, borderRadius:8,
        background:'#f5f5f7',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:16,
      }}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:14, color: danger ? '#FF3B30' : '#1a1a1a'}}>{label}</div>
        {desc && <div style={{fontSize:11, color:'#999', marginTop:2}}>{desc}</div>}
      </div>
      <div style={{color:'#ccc', fontSize:18}}>›</div>
    </button>
  )
}
