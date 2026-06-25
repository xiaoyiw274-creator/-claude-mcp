import { useEffect, useState } from 'react'
import { GeoSnap, fetchGeo } from '../lib/geo'

export default function GeoWidget(){
  const [snap, setSnap] = useState<GeoSnap | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async ()=>{
    const d = await fetchGeo()
    setSnap(d); setLoading(false)
  }
  useEffect(()=>{
    load()
    const id = setInterval(load, 60000) // 1 分钟刷
    return ()=> clearInterval(id)
  },[])

  if (loading) return null
  if (!snap) return null

  const lastEvent = snap.recent_events?.[snap.recent_events.length - 1]
  const ageMin = Math.floor((Date.now()/1000 - snap.ts) / 60)
  const batPct = Math.round((snap.battery || 0) * 100)

  return (
    <div style={{
      background: snap.is_home
        ? 'linear-gradient(135deg, rgba(255,200,220,.85), rgba(255,143,163,.85))'
        : 'linear-gradient(135deg, rgba(150,200,255,.85), rgba(110,160,230,.85))',
      borderRadius:18,
      padding:'14px 16px',
      marginBottom:18,
      color:'#fff',
      boxShadow:'0 4px 14px rgba(0,0,0,.08)',
      backdropFilter:'blur(10px)',
    }}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:6,
      }}>
        <div style={{
          fontSize:11, opacity:.9, letterSpacing:'1px',
          textTransform:'uppercase', fontWeight:600,
        }}>{snap.is_home ? '🏠 在家' : '📍 在外'}</div>
        <div style={{fontSize:10, opacity:.75}}>
          {ageMin}分钟前 · 🔋{batPct}%
        </div>
      </div>
      <div style={{fontSize:14, fontWeight:600, marginBottom:2, letterSpacing:'.3px'}}>
        {snap.address_short || '未知地点'}
      </div>
      <div style={{fontSize:11, opacity:.85, marginBottom:8, display:'flex', gap:8}}>
        <span>{snap.weather.desc} {snap.weather.temp?.toFixed(0)}°</span>
        <span>·</span>
        <span>{snap.is_home ? '在家舒服' : `距家 ${snap.dist_home_m}m`}</span>
      </div>
      {lastEvent && (
        <div style={{
          fontSize:11, opacity:.85, paddingTop:6,
          borderTop:'1px solid rgba(255,255,255,.2)',
          fontStyle:'italic',
        }}>
          ⏱ {lastEvent.summary}
        </div>
      )}
    </div>
  )
}
