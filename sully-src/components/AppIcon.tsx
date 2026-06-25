import { AppDef, AppId } from '../types'
import { useState } from 'react'

interface AppDefWithSvg extends AppDef {
  svg?: React.ReactNode
}

// 把彩色 SVG icon 转成白线性 (用 currentColor)
function WhiteIcon({children, size=30}:{children:React.ReactNode; size?:number}){
  // SVG fill="rgba(255,255,255,.95)" 改成 currentColor 用 color:#fff
  return (
    <div style={{color:'#fff', display:'flex', alignItems:'center', justifyContent:'center'}}>
      {children}
    </div>
  )
}

export default function AppIcon({ app, dock=false, onOpen }:{
  app: AppDefWithSvg
  dock?: boolean
  onOpen:(id:AppId)=>void
}){
  const [pressed, setPressed] = useState(false)
  const size = dock ? 54 : 64
  return (
    <button
      onPointerDown={()=>setPressed(true)}
      onPointerUp={()=>setPressed(false)}
      onPointerLeave={()=>setPressed(false)}
      onClick={()=>onOpen(app.id)}
      style={{
        background:'none', border:0, padding:0, cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', gap:6,
        transform: pressed ? 'scale(.93)' : 'scale(1)',
        transition:'transform .15s',
      }}>
      <div style={{
        width:size, height:size, borderRadius:18,
        background: 'rgba(255,255,255,.45)',
        backdropFilter:'blur(20px) saturate(150%)',
        WebkitBackdropFilter:'blur(20px) saturate(150%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: '0 4px 16px rgba(100,80,160,.08), inset 0 1px 1px rgba(255,255,255,.6)',
        border: '0.5px solid rgba(255,255,255,.5)',
        color:'#fff',
      }}>
        <WhiteIcon size={dock ? 26 : 30}>{app.svg}</WhiteIcon>
      </div>
      {!dock && <div style={{
        fontSize:11, color:'rgba(80,70,110,.85)', fontWeight:500,
        letterSpacing:'1px',
      }}>{app.name}</div>}
    </button>
  )
}
