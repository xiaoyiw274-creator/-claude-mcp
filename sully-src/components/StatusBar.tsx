import { useEffect, useState } from 'react'

function fmt(d: Date){
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function StatusBar({ tint = '#3a2820' }: { tint?: string }){
  const [t, setT] = useState(fmt(new Date()))
  useEffect(()=>{
    const id = setInterval(()=> setT(fmt(new Date())), 15000)
    return ()=> clearInterval(id)
  },[])
  return (
    <div style={{
      flex:'0 0 auto',
      display:'flex',
      justifyContent:'space-between',
      alignItems:'center',
      padding:'12px 22px 4px',
      paddingTop:'max(12px, env(safe-area-inset-top))',
      color: tint,
      fontSize:14,
      fontWeight:600,
      letterSpacing:'.3px',
      fontVariantNumeric:'tabular-nums',
    }}>
      <span style={{fontSize:16}}>{t}</span>
      {/* 动态岛/胶囊 */}
      <div style={{
        position:'absolute',
        left:'50%',
        top:'calc(env(safe-area-inset-top, 0px) + 6px)',
        transform:'translateX(-50%)',
        width:110,
        height:30,
        background:'#000',
        borderRadius:20,
      }} />
      {/* 右侧信号 / wifi / 电量 */}
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <Signal color={tint}/>
        <Wifi color={tint}/>
        <Battery color={tint}/>
      </div>
    </div>
  )
}

const Signal = ({color}:{color:string}) => (
  <svg width="18" height="11" viewBox="0 0 18 11"><g fill={color}>
    <rect x="0" y="7" width="3" height="4" rx=".5"/>
    <rect x="5" y="4.5" width="3" height="6.5" rx=".5"/>
    <rect x="10" y="2" width="3" height="9" rx=".5"/>
    <rect x="15" y="0" width="3" height="11" rx=".5"/>
  </g></svg>
)
const Wifi = ({color}:{color:string}) => (
  <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={color} strokeWidth="1.4">
    <path d="M1 4.5a10 10 0 0 1 14 0M3.5 7a6 6 0 0 1 9 0" strokeLinecap="round"/>
    <circle cx="8" cy="10" r="1" fill={color}/>
  </svg>
)
const Battery = ({color}:{color:string}) => (
  <svg width="26" height="12" viewBox="0 0 26 12">
    <rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke={color} strokeOpacity=".5"/>
    <rect x="23" y="4" width="2" height="4" rx=".5" fill={color} fillOpacity=".5"/>
    <rect x="2" y="2" width="18" height="8" rx="1.5" fill={color}/>
  </svg>
)
