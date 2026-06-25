import { useEffect, useRef, useState } from 'react'

export default function Splash({onDone}: {onDone: ()=>void}){
  const [time, setTime] = useState(new Date())
  const [dragY, setDragY] = useState(0)
  const [unlocking, setUnlocking] = useState(false)
  const dragRef = useRef<{startY:number} | null>(null)

  useEffect(()=>{
    const id = setInterval(()=>setTime(new Date()), 1000)
    return ()=> clearInterval(id)
  },[])

  const onDown = (e: React.PointerEvent)=>{
    if (unlocking) return
    dragRef.current = {startY: e.clientY}
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent)=>{
    if (!dragRef.current) return
    const dy = e.clientY - dragRef.current.startY
    if (dy < 0) setDragY(dy)  // 只跟随上滑
  }
  const onUp = ()=>{
    if (!dragRef.current) return
    dragRef.current = null
    if (dragY < -80){
      // 触发解锁
      setUnlocking(true)
      setTimeout(onDone, 400)
    } else {
      setDragY(0)  // 回弹
    }
  }

  const wd = '日一二三四五六'[time.getDay()]

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position:'absolute', inset:0, zIndex:1000,
        background:'linear-gradient(180deg, #F6F4F1 0%, #EFE8DD 50%, #E8DFD0 100%)',
        display:'flex', flexDirection:'column',
        transform: unlocking ? 'translateY(-100%)' : `translateY(${dragY}px)`,
        transition: unlocking
          ? 'transform .4s cubic-bezier(.4,0,.2,1), opacity .4s'
          : (dragY === 0 ? 'transform .3s cubic-bezier(.4,0,.2,1)' : 'none'),
        opacity: unlocking ? 0 : 1,
        overflow:'hidden',
        touchAction:'none',
        cursor:'grab',
      }}>

      {/* 顶部状态栏 (iOS 风) */}
      <div style={{
        flex:'0 0 auto',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 22px 0',
        paddingTop:'max(14px, env(safe-area-inset-top))',
        fontSize:13, color:'rgba(80,70,110,.65)', fontWeight:500,
      }}>
        <span style={{fontSize:14, fontWeight:600}}>
          {String(time.getHours()).padStart(2,'0')}:{String(time.getMinutes()).padStart(2,'0')}
        </span>
        <div style={{display:'flex', gap:5, alignItems:'center'}}>
          <span style={{letterSpacing:'-1px', fontSize:11}}>●●●●</span>
          <svg width="13" height="10" viewBox="0 0 16 12" fill="currentColor">
            <path d="M8 1.5C5.5 1.5 3.3 2.5 1.8 4.2L0.4 2.8C2.3 0.7 5 -0.5 8 -0.5s5.7 1.2 7.6 3.3L14.2 4.2C12.7 2.5 10.5 1.5 8 1.5zM8 5.5c-1.7 0-3.2 0.7-4.3 1.8L2.3 5.9C3.7 4.4 5.7 3.5 8 3.5s4.3 0.9 5.7 2.4L12.3 7.3C11.2 6.2 9.7 5.5 8 5.5zM8 9.5c-0.8 0-1.6 0.3-2.1 0.9L8 12.5l2.1-2.1C9.6 9.8 8.8 9.5 8 9.5z"/>
          </svg>
          <span style={{fontSize:11, fontWeight:600}}>100%</span>
        </div>
      </div>

      {/* 大时间 + 日期 (居中偏上) */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        paddingTop:40,
      }}>
        <div style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:96, fontWeight:300,
          color:'#2A2520', lineHeight:1, letterSpacing:'-0.03em',
          fontVariantNumeric:'tabular-nums',
        }}>
          {String(time.getHours()).padStart(2,'0')}
          <span style={{opacity:time.getSeconds()%2===0?1:0.15, transition:'opacity .5s'}}>:</span>
          {String(time.getMinutes()).padStart(2,'0')}
        </div>
        <div style={{
          marginTop:12,
          fontFamily:"'Cormorant Garamond','PingFang SC',serif",
          fontSize:14, color:'#9B9187', letterSpacing:'2px',
        }}>
          {time.getMonth()+1}月{time.getDate()}日 · 星期{wd}
        </div>
      </div>

      {/* 底部品牌 + 上滑提示 */}
      <div style={{
        flex:'0 0 auto', textAlign:'center',
        padding:'0 0 max(28px, env(safe-area-inset-bottom))',
      }}>


        {/* 向上滑动提示 */}
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', gap:6,
          opacity: dragY < -20 ? 0 : 1,
          transition:'opacity .2s',
        }}>
          <svg width="20" height="12" viewBox="0 0 20 12" fill="none" style={{
            animation:'arrowBob 1.6s ease-in-out infinite',
          }}>
            <path d="M2 10 L10 2 L18 10" stroke="rgba(80,70,110,.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{
            fontSize:11, color:'rgba(80,70,110,.5)',
            letterSpacing:'2px',
          }}>向上滑动解锁</div>
        </div>

        {/* home indicator */}
        <div style={{
          margin:'14px auto 0',
          width:134, height:4, borderRadius:2,
          background:'rgba(80,70,110,.25)',
        }}/>
      </div>

      <style>{`
        @keyframes arrowBob {
          0%, 100% { transform: translateY(0); opacity: .5; }
          50%      { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
