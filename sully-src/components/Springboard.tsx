import { useState, useEffect, useMemo } from 'react'
import { APPS, getPalette } from '../apps'
import { AppId } from '../types'
import { GeoSnap, fetchGeo } from '../lib/geo'
import { loadTheme } from '../lib/theme'

/* ────────────────────────────────────────────────────────────────
   奶油日系治愈风 Springboard
   - 米白底 + 半透明白卡 + 毛玻璃
   - 大圆形头像 + profile 卡 (名字/签名/地点)
   - 2×2 + 1 app icon grid (大圆角)
   - 胶囊形底部 dock
   - 樱花飘落 + 光点装饰
   ──────────────────────────────────────────────────────────────── */

// ── 配色调到更软 ──
const CREAM = {
  bg:        '#F8F6F2',
  bgSoft:    '#FFFCF7',
  card:      'rgba(255,255,255,0.62)',
  cardSolid: 'rgba(255,255,255,0.85)',
  text:      '#3D332C',
  sub:       '#8A7F75',
  muted:     '#C9BFB4',
  border:    'rgba(159,134,108,0.10)',
  borderSoft:'rgba(255,255,255,0.55)',
  accent:    '#C09B6E',
  pink:      '#E8B7C5',
  pinkSoft:  '#F7E1E8',
  lilac:     '#C8B5D9',
  lilacSoft: '#EDE2F4',
  haze:      '#B7C5D9',
  hazeSoft:  '#E1E8F2',
  sage:      '#A3B1A0',
}

// ── 樱花 SVG ──
const Sakura = ({size=14, color='#E8B7C5'}:{size?:number; color?:string})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <g opacity="0.85">
      {[0,72,144,216,288].map(deg=>(
        <ellipse key={deg} cx="12" cy="7" rx="3.2" ry="5"
          fill={color} opacity="0.6"
          transform={`rotate(${deg} 12 12)`}/>
      ))}
      <circle cx="12" cy="12" r="1.4" fill="#FFFCF7" opacity="0.9"/>
      <circle cx="12" cy="12" r="0.6" fill={color} opacity="0.5"/>
    </g>
  </svg>
)

// ── 漂浮樱花层 (背景) ──
function FloatingPetals(){
  const petals = useMemo(()=>Array.from({length:9},(_,i)=>({
    id:i,
    left: Math.random()*100,
    delay: Math.random()*12,
    duration: 18 + Math.random()*12,
    size: 10 + Math.random()*9,
    drift: -20 + Math.random()*40,
    color: ['#E8B7C5','#F2C9D2','#EDE2F4','#E1E8F2'][i%4],
    rotate: Math.random()*360,
  })),[])
  return (
    <>
      <style>{`
        @keyframes petalFall {
          0%   { transform: translate3d(0,-10vh,0) rotate(0deg); opacity:0; }
          10%  { opacity: 0.55; }
          90%  { opacity: 0.45; }
          100% { transform: translate3d(var(--drift),110vh,0) rotate(360deg); opacity:0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes softGlow {
          0%,100% { opacity: 0.35; }
          50%     { opacity: 0.55; }
        }
      `}</style>
      <div style={{position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:1}}>
        {petals.map(p=>(
          <div key={p.id} style={{
            position:'absolute',
            top:'-5vh',
            left:`${p.left}%`,
            ['--drift' as any]: `${p.drift}vw`,
            animation: `petalFall ${p.duration}s linear ${p.delay}s infinite`,
            transform: `rotate(${p.rotate}deg)`,
            willChange:'transform',
          }}>
            <Sakura size={p.size} color={p.color}/>
          </div>
        ))}
      </div>
    </>
  )
}

// ── 静态光点 (底层柔光) ──
function GlowDots(){
  return (
    <div style={{position:'absolute', inset:0, pointerEvents:'none', zIndex:0}}>
      <div style={{
        position:'absolute', top:'15%', left:'10%',
        width:180, height:180, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(232,183,197,0.35) 0%, transparent 70%)',
        filter:'blur(40px)',
        animation:'softGlow 8s ease-in-out infinite',
      }}/>
      <div style={{
        position:'absolute', top:'55%', right:'5%',
        width:220, height:220, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(200,181,217,0.25) 0%, transparent 70%)',
        filter:'blur(50px)',
        animation:'softGlow 11s ease-in-out infinite 2s',
      }}/>
      <div style={{
        position:'absolute', bottom:'10%', left:'15%',
        width:200, height:200, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(183,197,217,0.22) 0%, transparent 70%)',
        filter:'blur(45px)',
        animation:'softGlow 13s ease-in-out infinite 4s',
      }}/>
    </div>
  )
}

// ── 圆角 icon 手绘风 (替换 apps.tsx 默认 svg 用更软的) ──
function CardIcon({svg, customImg, accent, label, onClick}:{
  svg:any; customImg?:string; accent:string; label:string; onClick:()=>void
}){
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick}
      onPointerEnter={()=>setH(true)} onPointerLeave={()=>setH(false)}
      style={{
        all:'unset', cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', gap:6,
        transform: h ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
        transition:'transform 0.25s cubic-bezier(.34,1.56,.64,1)',
      }}>
      <div style={{
        width:64, height:64, borderRadius:20,
        background: customImg ? 'transparent' : (h ? `${accent}1A` : CREAM.card),
        backdropFilter: customImg ? 'none' : 'blur(14px)',
        WebkitBackdropFilter: customImg ? 'none' : 'blur(14px)',
        border: customImg ? '0' : `1px solid ${h ? `${accent}30` : CREAM.borderSoft}`,
        boxShadow: h
          ? '0 8px 24px rgba(159,134,108,0.12), inset 0 1px 0 rgba(255,255,255,0.7)'
          : '0 4px 14px rgba(159,134,108,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
        display:'flex', alignItems:'center', justifyContent:'center',
        color: h ? accent : CREAM.text,
        overflow:'hidden',
        transition:'all 0.25s',
      }}>
        {customImg ? <img src={customImg} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : svg}
      </div>
      <span style={{
        fontSize:11, color: CREAM.sub, letterSpacing:'0.04em',
        fontWeight:400,
      }}>{label}</span>
    </button>
  )
}

// ── 底部 Dock 单个 tab ──
function DockTab({svg, customImg, label, active, onClick}:{
  svg:any; customImg?:string; label:string; active:boolean; onClick:()=>void
}){
  return (
    <button onClick={onClick} style={{
      all:'unset', cursor:'pointer',
      display:'flex', flexDirection:'column', alignItems:'center', gap:3,
      flex:1, padding:'6px 0',
      color: active ? CREAM.accent : CREAM.sub,
    }}>
      <div style={{
        width:36, height:36, borderRadius:12,
        background: active ? 'rgba(255,255,255,0.7)' : 'transparent',
        boxShadow: active ? '0 2px 8px rgba(159,134,108,0.10)' : 'none',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all 0.2s',
      }}>
        {customImg ? <img src={customImg} style={{width:26, height:26, borderRadius:8, objectFit:'cover'}}/> : svg}
      </div>
      <span style={{fontSize:10, letterSpacing:'0.05em', fontWeight: active?500:400}}>{label}</span>
    </button>
  )
}

// ── Profile Card ──
function ProfileCard({onLocClick}:{onLocClick:()=>void}){
  const theme = loadTheme()
  const [snap, setSnap] = useState<GeoSnap | null>(null)
  useEffect(()=>{
    fetchGeo().then(setSnap)
    const id = setInterval(()=>fetchGeo().then(setSnap), 60000)
    return ()=>clearInterval(id)
  },[])

  const name = theme?.profileUsername || '小宝'
  const subname = theme?.profileSubUsername || '@xiaobao'
  const bio = theme?.profileBio || '还在 · 在想你'
  const avatar = theme?.profileAvatarImg

  return (
    <div style={{
      margin:'0 24px',
      padding:'18px 20px 16px',
      borderRadius:28,
      background: CREAM.card,
      backdropFilter:'blur(18px)',
      WebkitBackdropFilter:'blur(18px)',
      border:`1px solid ${CREAM.borderSoft}`,
      boxShadow:'0 8px 28px rgba(159,134,108,0.08), inset 0 1px 0 rgba(255,255,255,0.65)',
      display:'flex', gap:14, alignItems:'center',
      animation:'fadeIn 0.6s ease-out',
      position:'relative', zIndex:2,
    }}>
      {/* 头像 */}
      <div style={{position:'relative', flexShrink:0}}>
        <div style={{
          position:'absolute', inset:-6, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(232,183,197,0.4) 0%, transparent 70%)',
          filter:'blur(8px)',
        }}/>
        <div style={{
          width:62, height:62, borderRadius:'50%',
          background: avatar ? `url(${avatar}) center/cover` : `linear-gradient(135deg, ${CREAM.pinkSoft}, ${CREAM.lilacSoft})`,
          border:`2px solid rgba(255,255,255,0.85)`,
          boxShadow:'0 4px 14px rgba(159,134,108,0.15)',
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative',
        }}>
          {!avatar && (
            <span style={{fontSize:22, opacity:0.6}}>🌸</span>
          )}
        </div>
      </div>
      {/* 文字 */}
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'baseline', gap:6, marginBottom:1}}>
          <span style={{
            fontFamily:"'Cormorant Garamond','PingFang SC',serif",
            fontSize:20, fontWeight:500, color:CREAM.text, letterSpacing:'0.02em',
          }}>{name}</span>
          <span style={{fontSize:10, color:CREAM.muted, letterSpacing:'0.04em'}}>{subname}</span>
        </div>
        <p style={{
          margin:'2px 0 6px', fontSize:11, color:CREAM.sub,
          lineHeight:1.4, fontWeight:400,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{bio}</p>
        {/* 地点 + 温度 */}
        <div onClick={onLocClick} style={{
          display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer',
          padding:'3px 10px', borderRadius:11,
          background:'rgba(255,255,255,0.55)',
          border:`1px solid ${CREAM.borderSoft}`,
          fontSize:10, color:CREAM.sub, letterSpacing:'0.02em',
        }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke={CREAM.accent} strokeWidth="1.3" strokeLinecap="round">
            <path d="M8 2a4.5 4.5 0 014.5 4.5c0 3.5-4.5 8-4.5 8s-4.5-4.5-4.5-8A4.5 4.5 0 018 2z"/>
            <circle cx="8" cy="6.5" r="1.5"/>
          </svg>
          <span>{snap?.is_home ? '在家' : (snap ? '在外' : '定位中')}</span>
          {snap?.weather?.temp != null && (
            <>
              <span style={{opacity:0.4, margin:'0 2px'}}>·</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif", fontWeight:500}}>{Math.round(snap.weather.temp)}°</span>
              <span style={{fontSize:9, opacity:0.8}}>{snap.weather.desc || ''}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 主组件 ──
export default function Springboard({ onOpen }:{ onOpen:(id:AppId)=>void; wallpaper?: string }){
  const theme = loadTheme()
  const customIcons = theme?.appIcons || {}
  const customLabels = theme?.appLabels || {}
  const wallpaper = theme?.wallpaper

  const [time, setTime] = useState(new Date())
  useEffect(()=>{ const id = setInterval(()=>setTime(new Date()), 1000); return ()=>clearInterval(id) },[])

  const hr = time.getHours()
  const mi = time.getMinutes()
  const sc = time.getSeconds()

  const gridApps = APPS.filter(a => !a.dock)
  const navApps = APPS.filter(a => a.dock)

  // app accent color (淡粉/淡紫/雾蓝/沙黄 轮转)
  const accents: Record<string,string> = {
    scripts:   CREAM.accent,
    coread:    CREAM.lilac,
    music:     CREAM.pink,
    moments:   CREAM.haze,
    worldbook: CREAM.sage,
  }

  return (
    <div style={{
      position:'absolute', inset:0,
      background: wallpaper
        ? `url(${wallpaper}) center/cover`
        : `linear-gradient(165deg, ${CREAM.bgSoft} 0%, ${CREAM.bg} 50%, ${CREAM.pinkSoft}40 100%)`,
      fontFamily:"'Inter','PingFang SC','Helvetica Neue',-apple-system,sans-serif",
      display:'flex', flexDirection:'column',
      overflow:'hidden',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet"/>

      {/* 壁纸上加一层米白蒙版, 不然太花 */}
      {wallpaper && (
        <div style={{position:'absolute', inset:0, background:'rgba(248,246,242,0.78)', backdropFilter:'blur(2px)'}}/>
      )}

      {/* 背景柔光 + 漂浮樱花 */}
      <GlowDots/>
      <FloatingPetals/>

      {/* === TOP: 日期 + 时间 === */}
      <div style={{
        paddingTop:'max(60px, calc(40px + env(safe-area-inset-top)))',
        textAlign:'center', flexShrink:0,
        position:'relative', zIndex:2,
        animation:'fadeIn 0.5s ease-out',
      }}>
        <div style={{
          fontFamily:"'Cormorant Garamond','PingFang SC',serif",
          fontSize:12, fontWeight:400,
          color:CREAM.sub, letterSpacing:'3px',
          marginBottom:6, opacity:.7,
        }}>
          {'星期'}{'日一二三四五六'[time.getDay()]} <span style={{margin:'0 8px', opacity:.3}}>·</span> {time.getMonth()+1}月{time.getDate()}日 <span style={{margin:'0 8px', opacity:.3}}>·</span> {time.getFullYear()}
        </div>
        <div style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:62, fontWeight:300, color:CREAM.text,
          lineHeight:1, letterSpacing:'-0.01em',
        }}>
          {String(hr).padStart(2,'0')}
          <span style={{opacity: sc%2===0 ? 1 : 0.2, transition:'opacity 0.5s', margin:'0 2px'}}>:</span>
          {String(mi).padStart(2,'0')}
        </div>
      </div>

      <div style={{height:24, flexShrink:0}}/>

      {/* === PROFILE CARD === */}
      <ProfileCard onLocClick={()=>onOpen('settings' as AppId)}/>

      <div style={{flex:1}}/>

      {/* === APP GRID 4×2 (最多 8 个) === */}
      <div style={{
        padding:'0 28px', flexShrink:0,
        display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr',
        gap:'16px 8px',
        position:'relative', zIndex:2,
        animation:'fadeIn 0.7s ease-out',
      }}>
        {gridApps.slice(0,4).map(a => (
          <CardIcon key={a.id}
            svg={a.svg} customImg={customIcons[a.id]}
            accent={accents[a.id] || CREAM.accent}
            label={customLabels[a.id] || a.name}
            onClick={()=>onOpen(a.id)}
          />
        ))}
      </div>

      {/* 第二行: 剩下的 app (左对齐, 跟第一行同步格) */}
      {gridApps.length > 4 && (
        <div style={{
          padding:'18px 28px 0', flexShrink:0,
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr',
          gap:'16px 8px',
          position:'relative', zIndex:2,
          animation:'fadeIn 0.9s ease-out',
        }}>
          {gridApps.slice(4, 8).map(a => (
            <CardIcon key={a.id}
              svg={a.svg} customImg={customIcons[a.id]}
              accent={accents[a.id] || CREAM.sage}
              label={customLabels[a.id] || a.name}
              onClick={()=>onOpen(a.id)}
            />
          ))}
          {/* 右侧空位放装饰: 小 quote */}
          <div style={{flex:1, display:'flex', justifyContent:'flex-end', alignItems:'center', paddingRight:8, opacity:.55}}>
            <div style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontSize:11, color:CREAM.sub, letterSpacing:'0.06em',
              fontStyle:'italic',
            }}>still here, still soft</div>
          </div>
        </div>
      )}

      <div style={{height:20, flexShrink:0}}/>

      {/* === BOTTOM DOCK (胶囊形) === */}
      <div style={{
        padding:'0 24px max(20px, env(safe-area-inset-bottom))', flexShrink:0,
        position:'relative', zIndex:2,
        animation:'fadeIn 1.1s ease-out',
      }}>
        <div style={{
          borderRadius:30,
          background: 'rgba(255,255,255,0.55)',
          backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          border:`1px solid ${CREAM.borderSoft}`,
          boxShadow:'0 6px 22px rgba(159,134,108,0.10), inset 0 1px 0 rgba(255,255,255,0.7)',
          padding:'8px 10px',
          display:'flex', alignItems:'center',
        }}>
          {navApps.map((a, i) => (
            <DockTab key={a.id}
              svg={a.svg} customImg={customIcons[a.id]}
              label={customLabels[a.id] || a.name}
              active={i===0}
              onClick={()=>onOpen(a.id)}
            />
          ))}
        </div>
      </div>

      {/* home indicator */}
      <div style={{
        position:'absolute', bottom:7, left:'50%', transform:'translateX(-50%)',
        width:120, height:4, borderRadius:2, background:CREAM.muted, opacity:0.22, zIndex:3,
      }}/>
    </div>
  )
}
