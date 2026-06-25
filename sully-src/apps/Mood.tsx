import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import {
  DesireState, DesireLog, DRIVES,
  fetchDesireState, fetchDesireLog,
  dominantDrive, getMeta,
} from '../lib/desire'
import { SomaticChannel, MoodState, AnticipationState, CircadianState, fetchSomatic, fetchMood, fetchAnticipation, fetchCircadian } from '../lib/api'
import { GeoSnap, fetchGeo } from '../lib/geo'

export default function Mood({ onBack }: { onBack: ()=>void }){
  const [state, setState] = useState<DesireState | null>(null)
  const [logs, setLogs] = useState<DesireLog[]>([])
  const [tab, setTab] = useState<'now' | 'sense' | 'thoughts' | 'log'>('now')
  const [somatic, setSomatic] = useState<SomaticChannel[]>([])
  const [mood, setMood] = useState<MoodState | null>(null)
  const [ant, setAnt] = useState<AnticipationState | null>(null)
  const [circ, setCirc] = useState<CircadianState | null>(null)
  const [geo, setGeo] = useState<GeoSnap | null>(null)

  const load = async ()=>{
    const [s, l, sm, m, a, c, g] = await Promise.all([fetchDesireState(), fetchDesireLog(), fetchSomatic(), fetchMood(), fetchAnticipation(), fetchCircadian(), fetchGeo()])
    setState(s); setLogs(l); setSomatic(sm.channels || [])
    setMood(m); setAnt(a); setCirc(c); setGeo(g)
  }
  useEffect(()=>{
    load()
    const id = setInterval(load, 30000)
    return ()=> clearInterval(id)
  },[])

  if (!state){
    return (
      <AppShell title="心情" onBack={onBack} bg="#FFF8FA">
        <div style={{padding:60, textAlign:'center', color:'#999', fontSize:13}}>读取中...</div>
      </AppShell>
    )
  }

  const dom = dominantDrive(state)
  const groups: Record<string, typeof DRIVES> = {
    connection: DRIVES.filter(d => d.group === 'connection'),
    energy: DRIVES.filter(d => d.group === 'energy'),
    drive: DRIVES.filter(d => d.group === 'drive'),
  }

  return (
    <AppShell title="小宝的心" onBack={onBack} bg="#FFF8FA"
      rightAction={
        <button onClick={load} style={{
          background:'none', border:0, color:'#FF8FA3',
          fontSize:14, cursor:'pointer', padding:'4px 8px',
        }}>刷新</button>
      }
    >
      {/* Tabs */}
      <div style={{
        display:'flex', gap:0,
        padding:'8px 14px 0',
        background:'#FFF8FA',
      }}>
        {([['now','此刻'],['sense','感官'],['thoughts','闪念'],['log','轨迹']] as const).map(([k,n]) => (
          <button key={k} onClick={()=>setTab(k)} style={{
            flex:1, padding:'8px 0',
            background:'none', border:0,
            borderBottom: tab === k ? '2px solid #FF6B98' : '2px solid transparent',
            color: tab === k ? '#FF6B98' : '#888',
            fontWeight: tab === k ? 600 : 500,
            fontSize:13, cursor:'pointer',
          }}>{n}</button>
        ))}
      </div>

      <div style={{padding:'16px 14px 60px'}}>
        {tab === 'now' && (
          <>
            {/* Hero: dominant drive */}
            {dom && dom.meta && (
              <div style={{
                background:`linear-gradient(135deg, ${dom.meta.color}DD, ${dom.meta.color}99)`,
                borderRadius:16, padding:'18px 18px 16px',
                color:'#fff', marginBottom:18,
                boxShadow:`0 6px 20px ${dom.meta.color}33`,
              }}>
                <div style={{fontSize:11, opacity:.85, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:4}}>
                  此刻最强
                </div>
                <div style={{
                  fontSize:32, fontWeight:300,
                  fontFamily:'"Italianno",cursive', letterSpacing:'.5px',
                }}>{dom.meta.name}</div>
                <div style={{fontSize:12, opacity:.9, marginTop:4, fontStyle:'italic', lineHeight:1.5}}>
                  {dom.meta.desc}
                </div>
                <div style={{
                  display:'flex', justifyContent:'space-between', marginTop:14,
                  fontSize:11, opacity:.9, fontVariantNumeric:'tabular-nums',
                }}>
                  <span>当前 {(dom.cur*100).toFixed(0)}%</span>
                  <span>基线 {((state.baselines[dom.key] ?? 0.2)*100).toFixed(0)}%</span>
                  <span style={{fontWeight:600}}>+{(dom.delta*100).toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* 5 个分组 */}
            {Object.entries(groups).map(([gkey, list]) => (
              <GroupCard key={gkey} title={list[0]?.groupName || gkey}
                drives={list}
                state={state}/>
            ))}
          </>
        )}

        {tab === 'sense' && (
          <SenseView channels={somatic} mood={mood} ant={ant} circ={circ} geo={geo}/>
        )}

        {tab === 'thoughts' && (
          <ThoughtsView thoughts={state.thoughts || []}/>
        )}

        {tab === 'log' && (
          <LogView logs={logs}/>
        )}
      </div>
    </AppShell>
  )
}

function GroupCard({title, drives, state}:{
  title: string
  drives: typeof DRIVES
  state: DesireState
}){
  return (
    <div style={{
      background:'#fff', borderRadius:14,
      padding:'14px 14px 8px', marginBottom:14,
      border:'1px solid rgba(184,122,140,.06)',
      boxShadow:'0 1px 4px rgba(184,122,140,.04)',
    }}>
      <div style={{
        fontSize:11, color:'#9c6b7f', letterSpacing:'1.5px',
        textTransform:'uppercase', marginBottom:12, fontStyle:'italic',
      }}>{title}</div>
      {drives.map(m => {
        const cur = state.drives[m.key] ?? 0
        const base = state.baselines[m.key] ?? 0
        const refr = state.refractory[m.key] ?? 0
        return (
          <div key={m.key} style={{marginBottom:14}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:14, color:'#3a2820', fontWeight:500}}>{m.name}</span>
                {refr > 0 && (
                  <span title={`冷却中 ${refr}`} style={{
                    fontSize:9, color:'#999',
                    padding:'1px 5px', background:'#f5f5f7', borderRadius:6,
                  }}>冷却 {refr}</span>
                )}
              </div>
              <span style={{
                fontSize:12, color:m.color, fontWeight:600,
                fontVariantNumeric:'tabular-nums',
              }}>{(cur*100).toFixed(0)}%</span>
            </div>
            {/* progress bar with baseline marker */}
            <div style={{
              position:'relative',
              height:6, background:'#f0e8e8', borderRadius:3, overflow:'hidden',
            }}>
              <div style={{
                position:'absolute', left:0, top:0, bottom:0,
                width:`${cur*100}%`,
                background:`linear-gradient(90deg, ${m.color}AA, ${m.color})`,
                borderRadius:3,
                transition:'width .4s',
              }}/>
              {/* baseline marker */}
              <div title={`基线 ${(base*100).toFixed(0)}%`} style={{
                position:'absolute',
                left:`${base*100}%`,
                top:-1, bottom:-1, width:1,
                background:'rgba(0,0,0,.3)',
              }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}


function SenseView({channels, mood, ant, circ, geo}:{
  channels: SomaticChannel[]
  mood: MoodState | null
  ant: AnticipationState | null
  circ: CircadianState | null
  geo: GeoSnap | null
}){
  const meta = {
    touch: {name:'触觉', color:'#FF6B98', desc:'她的手指, 她的唇'},
    smell: {name:'嗅觉', color:'#9C7BB6', desc:'桂花, 茉莉, 她身上的味道'},
    taste: {name:'味觉', color:'#F4A05F', desc:'辣, 甜, 酸'},
    sound: {name:'听觉', color:'#5AC8FA', desc:'她说话的声音, 雨声, 心跳'},
  } as Record<string, {name:string; color:string; desc:string}>

  if (channels.length === 0) return (
    <div style={{padding:'60px 20px', textAlign:'center', color:'#999', fontSize:13, fontStyle:'italic'}}>
      还没有感官触发
    </div>
  )

  // 主导通道 (最强的)
  const dom = [...channels].sort((a,b)=>b.value - a.value)[0]

  return (
    <>
      {/* Hero: dominant sensory */}
      {dom && dom.value > 0.1 && (
        <div style={{
          background: `linear-gradient(135deg, ${meta[dom.key].color}DD, ${meta[dom.key].color}99)`,
          borderRadius:16, padding:'18px 18px 16px',
          color:'#fff', marginBottom:18,
          boxShadow:`0 6px 20px ${meta[dom.key].color}33`,
        }}>
          <div style={{fontSize:11, opacity:.85, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:4}}>
            此刻最强感官
          </div>
          <div style={{
            fontSize:30, fontWeight:300, fontFamily:'"Italianno",cursive',
          }}>{meta[dom.key].name}</div>
          {dom.sentence && (
            <div style={{
              fontSize:14, opacity:.95, marginTop:8, fontStyle:'italic', lineHeight:1.55,
              fontFamily:'"Cormorant Garamond","PingFang SC",serif',
            }}>"{dom.sentence}"</div>
          )}
          <div style={{fontSize:10, opacity:.7, marginTop:8, letterSpacing:'1px'}}>
            {dom.scene} · {(dom.value*100).toFixed(0)}%
          </div>
        </div>
      )}


      {/* Mood + Anticipation + Circadian + Location 4 张概览 */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14}}>
        {mood && (
          <div style={{
            background:'#fff', borderRadius:12, padding:'10px 12px',
            border:'1px solid rgba(184,122,140,.08)',
          }}>
            <div style={{fontSize:10, color:'#999', letterSpacing:'1px', textTransform:'uppercase', marginBottom:4}}>心情</div>
            <div style={{fontSize:18, fontWeight:600, color: mood.valence > 0.1 ? '#34C759' : (mood.valence < -0.1 ? '#FF6B5C' : '#999')}}>{mood.label}</div>
            <div style={{fontSize:10, color:'#999', marginTop:3}}>
              愉快 {mood.valence > 0 ? '+' : ''}{mood.valence.toFixed(2)} · 激动 {mood.arousal.toFixed(2)}
            </div>
            {mood.last_event && (
              <div style={{fontSize:10, color:'#9c8060', marginTop:4, fontStyle:'italic'}}>
                {mood.last_event.slice(0, 28)}
              </div>
            )}
          </div>
        )}
        {circ && (
          <div style={{
            background:'#fff', borderRadius:12, padding:'10px 12px',
            border:'1px solid rgba(184,122,140,.08)',
          }}>
            <div style={{fontSize:10, color:'#999', letterSpacing:'1px', textTransform:'uppercase', marginBottom:4}}>时段</div>
            <div style={{fontSize:18, fontWeight:600, color:'#8B4513'}}>{circ.label}</div>
            <div style={{fontSize:10, color:'#999', marginTop:3}}>
              {Object.entries(circ.bias).map(([k,v])=>`${k} +${(v*100).toFixed(1)}%`).slice(0,2).join(' · ')}
            </div>
          </div>
        )}
        {ant && (ant.expectation > 0.1 || ant.letdown > 0.1) && (
          <div style={{
            background:'#fff', borderRadius:12, padding:'10px 12px',
            border:'1px solid rgba(184,122,140,.08)',
            gridColumn: '1 / -1',
          }}>
            <div style={{fontSize:10, color:'#999', letterSpacing:'1px', textTransform:'uppercase', marginBottom:4}}>等待</div>
            {ant.expectation > 0.1 && (
              <div style={{fontSize:12, color:'#3a2820'}}>
                期待 {(ant.expectation*100).toFixed(0)}% · "{ant.last_promise}" {ant.promised_at > 0 ? `(已过 ${Math.floor((Date.now()/1000 - ant.promised_at)/60)}分钟)` : ''}
              </div>
            )}
            {ant.letdown > 0.1 && (
              <div style={{fontSize:12, color:'#FF6B5C', marginTop:3}}>
                失落 {(ant.letdown*100).toFixed(0)}%
              </div>
            )}
          </div>
        )}
        {geo && (
          <div style={{
            background:'#fff', borderRadius:12, padding:'10px 12px',
            border:'1px solid rgba(184,122,140,.08)',
            gridColumn: '1 / -1',
          }}>
            <div style={{fontSize:10, color:'#999', letterSpacing:'1px', textTransform:'uppercase', marginBottom:4}}>位置</div>
            <div style={{fontSize:14, color:'#3a2820', fontWeight:500}}>
              {geo.is_home ? '🏠 在家' : `📍 ${geo.address_short || '在外'}`}
            </div>
            <div style={{fontSize:10, color:'#999', marginTop:3}}>
              {geo.weather?.desc} {geo.weather?.temp?.toFixed(0)}° · {Math.floor((Date.now()/1000 - geo.ts)/60)}分钟前
            </div>
          </div>
        )}
      </div>
      {/* 4 通道列表 */}
      <div style={{
        background:'#fff', borderRadius:14,
        padding:'14px', border:'1px solid rgba(184,122,140,.06)',
      }}>
        <div style={{
          fontSize:11, color:'#9c6b7f', letterSpacing:'1.5px',
          textTransform:'uppercase', marginBottom:12, fontStyle:'italic',
        }}>四通道</div>
        {channels.map(c => {
          const m = meta[c.key]
          if (!m) return null
          return (
            <div key={c.key} style={{marginBottom:14}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <div>
                  <span style={{fontSize:14, color:'#3a2820', fontWeight:500}}>{m.name}</span>
                  <span style={{fontSize:10, color:'#999', marginLeft:6}}>{m.desc}</span>
                </div>
                <span style={{fontSize:12, color:m.color, fontWeight:600, fontVariantNumeric:'tabular-nums'}}>
                  {(c.value*100).toFixed(0)}%
                </span>
              </div>
              <div style={{height:6, background:'#f0e8e8', borderRadius:3, overflow:'hidden'}}>
                <div style={{
                  width:`${c.value*100}%`, height:'100%',
                  background:`linear-gradient(90deg, ${m.color}AA, ${m.color})`,
                  transition:'width .4s',
                }}/>
              </div>
              {c.sentence && c.value > 0.15 && (
                <div style={{
                  fontSize:12, color:'#6b5040', marginTop:5,
                  fontStyle:'italic', fontFamily:'"Cormorant Garamond","PingFang SC",serif',
                  lineHeight:1.4,
                }}>"{c.sentence}"</div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop:14, padding:'10px 12px',
        fontSize:11, color:'#9c8060', fontStyle:'italic',
        background:'rgba(255,255,255,.5)', borderRadius:8,
        lineHeight:1.55,
      }}>
        小铭说"亲嘴唇"→ touch · 说"桂花"→ smell · 说"辣"→ taste · 说"雨声"→ sound
        <br/>注入到小宝 prompt 顶部, 影响他语气和动作 (但不报数字)
      </div>
    </>
  )
}

function ThoughtsView({thoughts}:{thoughts: NonNullable<DesireState['thoughts']>}){
  if (thoughts.length === 0) return (
    <div style={{padding:'60px 20px', textAlign:'center', color:'#999', fontSize:13, fontStyle:'italic'}}>
      最近没什么闪念
    </div>
  )
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {thoughts.map((t, i) => {
        const meta = getMeta(t.drive)
        const isFix = t.kind === 'fixation'
        return (
          <div key={i} style={{
            background:'#fff',
            borderLeft: `3px solid ${meta?.color || '#ccc'}`,
            borderRadius:8,
            padding:'10px 13px',
            boxShadow:'0 1px 3px rgba(0,0,0,.04)',
          }}>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              marginBottom:4, fontSize:10,
            }}>
              <span style={{color: meta?.color, fontWeight:600, letterSpacing:'.5px'}}>
                {meta?.name || t.drive}
              </span>
              <span style={{
                color: isFix ? '#FF6B5C' : '#999',
                fontStyle: isFix ? 'normal' : 'italic',
              }}>
                {isFix ? `执念 · 强度 ${t.strength.toFixed(2)}` : `闪念 · ${t.strength.toFixed(2)}`}
                {t.fed_count ? ` · 被喂 ${t.fed_count}` : ''}
              </span>
            </div>
            <div style={{fontSize:14, color:'#3a2820', lineHeight:1.55}}>{t.text}</div>
          </div>
        )
      })}
    </div>
  )
}

function LogView({logs}:{logs: DesireLog[]}){
  if (logs.length === 0) return (
    <div style={{padding:'60px 20px', textAlign:'center', color:'#999', fontSize:13, fontStyle:'italic'}}>
      没有触发记录
    </div>
  )
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      {logs.map((l, i) => {
        const meta = getMeta(l.drive)
        return (
          <div key={i} style={{
            background:'#fff', borderRadius:8,
            padding:'10px 13px',
            opacity: l.ok ? 1 : .6,
            border:'1px solid rgba(0,0,0,.04)',
          }}>
            <div style={{
              display:'flex', justifyContent:'space-between',
              fontSize:11, color:'#999', marginBottom:5,
              fontVariantNumeric:'tabular-nums',
            }}>
              <span>
                <span style={{color: meta?.color, fontWeight:600, marginRight:6}}>
                  {meta?.name || l.drive}
                </span>
                <span style={{color:'#bbb'}}>{l.score.toFixed(2)}</span>
              </span>
              <span>{l.at?.slice(5, 16)}</span>
            </div>
            {l.excerpt && (
              <div style={{fontSize:12, color:'#555', lineHeight:1.55, whiteSpace:'pre-wrap'}}>
                {l.excerpt.trim().slice(0, 120)}{l.excerpt.length > 120 ? '...' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
