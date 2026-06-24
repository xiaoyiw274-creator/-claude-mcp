import { ReactNode } from 'react'
import StatusBar from './StatusBar'

export default function AppShell({ title, onBack, children, rightAction, tint='#3a2820', bg='#FFF8FA' }:{
  title: string
  onBack: ()=>void
  children: ReactNode
  rightAction?: ReactNode
  tint?: string
  bg?: string
}){
  return (
    <div style={{
      position:'absolute', inset:0,
      background: bg,
      display:'flex', flexDirection:'column',
      animation:'slideIn .25s ease-out',
    }}>
      <StatusBar tint={tint}/>
      <div style={{
        flex:'0 0 auto',
        display:'flex', alignItems:'center',
        padding:'8px 12px',
        background:'rgba(255,255,255,.85)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(184,122,140,.12)',
        minHeight:44,
      }}>
        <button onClick={onBack} style={{
          background:'none', border:0, display:'flex', alignItems:'center', gap:4,
          color:'#FF8FA3', fontSize:15, cursor:'pointer', padding:'6px 4px',
        }}>
          <svg width="11" height="20" viewBox="0 0 11 20" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 2 2 10 9 18" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>主页</span>
        </button>
        <div style={{
          flex:1, textAlign:'center', fontSize:17, fontWeight:600,
          color:'#1a1a1a', marginRight: rightAction ? 0 : 50, letterSpacing:'.3px',
        }}>{title}</div>
        {rightAction}
      </div>
      <div style={{flex:1, overflowY:'auto', minHeight:0}}>
        {children}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
