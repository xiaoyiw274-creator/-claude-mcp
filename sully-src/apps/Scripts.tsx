import { useEffect, useState, useRef } from 'react'
import AppShell from '../components/AppShell'
import RpSession from './RpSession'
import {
  fetchScripts, fetchScript, createOrUpdateScript, deleteScript,
  fetchScriptWorldbook, saveScriptWb, deleteScriptWb,
  fetchScriptSessions, deleteScriptSession, resumeScriptSession,
  Script, ScriptWb, ScriptSession, STYLE_PRESETS,
} from '../lib/api'

type View = 'list' | 'detail' | 'edit' | 'new'

export default function Scripts({ onBack }: { onBack: ()=>void }){
  const [view, setView] = useState<View>('list')
  const [list, setList] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Script | null>(null)
  const [inRP, setInRP] = useState(false)

  const load = async ()=>{
    setLoading(true)
    const d = await fetchScripts()
    setList(d.scripts || [])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  if (inRP && picked){
    return <RpSession
      script={picked}
      onBack={()=>{ setInRP(false); setPicked(null); load() }}
    />
  }

  if (view === 'detail' && picked){
    return <DetailView
      script={picked}
      onBack={()=>{ setView('list'); setPicked(null) }}
      onEdit={()=>setView('edit')}
      onPerform={async ()=>{
        try { await fetch(`/api/scripts/${picked.id}/start`, {method:'POST'}) } catch {}
        setInRP(true)
      }}
      onResume={async (sid: string)=>{
        await resumeScriptSession(sid)
        setInRP(true)
      }}
      onDelete={async ()=>{
        if (!confirm(`删除剧本 "${picked.name}"?`)) return
        await deleteScript(picked.id)
        setView('list'); setPicked(null); load()
      }}
    />
  }

  if (view === 'edit' && picked){
    return <EditView
      script={picked}
      onBack={async (saved)=>{
        if (saved){
          const s = await fetchScript(picked.id)
          setPicked(s)
          await load()
        }
        setView('detail')
      }}
    />
  }

  if (view === 'new'){
    return <EditView
      script={null}
      onBack={async (saved, newScript)=>{
        if (saved && newScript){
          setPicked(newScript)
          await load()
          setView('detail')
        } else {
          setView('list')
        }
      }}
    />
  }

  // list
  return (
    <AppShell
      title="剧本馆" onBack={onBack} bg="#FBF6EE"
      rightAction={
        <button onClick={()=>setView('new')} style={{
          background:'none', border:0, color:'#8B4513',
          fontSize:24, cursor:'pointer', padding:'4px 8px', lineHeight:1,
        }} title="新建">+</button>
      }
    >
      <div style={{padding:'16px 14px 60px'}}>
        {loading && <Empty text="加载中..."/>}
        {!loading && list.length === 0 && (
          <div style={{padding:'40px 20px', textAlign:'center'}}>
            <div className="italianno" style={{fontSize:42, color:'#C9A77E', marginBottom:8}}>Drama</div>
            <div style={{fontSize:13, color:'#9c8060', fontStyle:'italic', marginBottom:18}}>还没有剧本</div>
            <button onClick={()=>setView('new')} style={{
              padding:'10px 22px', background:'#8B4513', color:'#fff', border:0, borderRadius:8,
              fontSize:14, cursor:'pointer',
            }}>新建第一个剧本</button>
          </div>
        )}
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {list.map(s => (
            <div key={s.id} onClick={()=>{setPicked(s); setView('detail')}} style={{
              padding:'14px 16px',
              background:'#fff',
              borderRadius:12,
              border:'1px solid rgba(139,69,19,.08)',
              boxShadow:'0 2px 8px rgba(139,69,19,.05)',
              cursor:'pointer',
              display:'flex', gap:12, alignItems:'center',
            }}>
              {s.avatar ? (
                <img src={s.avatar} style={{
                  width:54, height:72, borderRadius:6, objectFit:'cover',
                  flex:'0 0 54px',
                  boxShadow:'0 2px 6px rgba(139,69,19,.15)',
                }}/>
              ) : (
                <div style={{
                  width:54, height:72, borderRadius:6,
                  background:'linear-gradient(135deg,#D4B89A,#C9A77E)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontFamily:'"Italianno",cursive', fontSize:32,
                  flex:'0 0 54px',
                }}>{s.name?.[0] || '剧'}</div>
              )}
              <div style={{flex:1, minWidth:0}}>
                <div style={{
                  fontFamily:'"Cormorant Garamond","PingFang SC",serif',
                  fontSize:16, fontWeight:600, color:'#3a2820', marginBottom:4,
                }}>{s.name}</div>
                {s.tags && (
                  <div style={{fontSize:11, color:'#9c8060', fontStyle:'italic'}}>{s.tags}</div>
                )}
                {s.bao_role && (
                  <div style={{
                    fontSize:12, color:'#6b5040', marginTop:4,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}>他: {s.bao_role}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

// ===== 详情 (只读) =====
function DetailView({script, onBack, onEdit, onPerform, onResume, onDelete}:{
  script: Script
  onBack: ()=>void; onEdit: ()=>void
  onPerform: ()=>void; onResume: (sessionId:string)=>void; onDelete: ()=>void
}){
  const [wbs, setWbs] = useState<ScriptWb[]>([])
  useEffect(()=>{
    fetchScriptWorldbook(script.id).then(d => setWbs(d.items || []))
  },[script.id])

  return (
    <AppShell title={script.name} onBack={onBack} bg="#FFF8F2"
      rightAction={
        <button onClick={onEdit} style={{
          background:'none', border:0, color:'#8B4513',
          fontSize:14, cursor:'pointer', padding:'4px 8px',
        }}>编辑</button>
      }
    >
      <div style={{padding:'14px 18px 80px', fontFamily:'"Cormorant Garamond","PingFang SC",serif'}}>
        {script.avatar && (
          <div style={{textAlign:'center', marginBottom:18}}>
            <img src={script.avatar} style={{
              maxWidth:140, maxHeight:180, borderRadius:10,
              boxShadow:'0 4px 14px rgba(139,69,19,.18)',
            }}/>
          </div>
        )}
        <Detail label="世界设定" v={script.world_setting}/>
        <Detail label="你扮 (小铭)" v={script.your_role}/>
        <Detail label="他扮 (小宝)" v={script.bao_role}/>
        <Detail label="开场" v={script.opening}/>
        {script.npcs && <Detail label="重要 NPC" v={script.npcs}/>}
        {script.tags && <Detail label="标签" v={script.tags}/>}
        {script.writing_style && <Detail label="文风" v={script.writing_style}/>}

        <SessionsSection scriptId={script.id} onResume={onResume}/>

        {wbs.length > 0 && (
          <div style={{marginTop:18}}>
            <div style={{fontSize:11, color:'#9c6b4f', textTransform:'uppercase', letterSpacing:'1.5px', fontStyle:'italic', marginBottom:8}}>
              世界书 · {wbs.length} 条
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {wbs.map(w => (
                <div key={w.id} style={{
                  padding:'8px 12px', background:'rgba(255,255,255,.6)',
                  borderRadius:6, fontSize:12, color:'#5c3a2e',
                }}>
                  <b>{w.name}</b>
                  {w.keywords && <span style={{color:'#9c6b4f', marginLeft:6, fontSize:11}}>· {w.keywords}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{display:'flex', gap:10, marginTop:30}}>
          <button onClick={onDelete} style={{
            padding:'12px 20px', background:'#fff',
            color:'#FF3B30', fontSize:13, border:'1px solid rgba(255,59,48,.3)',
            borderRadius:10, cursor:'pointer',
          }}>删除</button>
          <button onClick={onPerform} style={{
            flex:1, padding:'12px',
            background:'linear-gradient(135deg,#8B4513,#5c3a2e)',
            color:'#fff', fontSize:15, fontWeight:600, border:0, borderRadius:10, cursor:'pointer',
            boxShadow:'0 3px 8px rgba(139,69,19,.25)',
          }}>开演</button>
        </div>
      </div>
    </AppShell>
  )
}

// ===== 编辑/新建 =====
function EditView({script, onBack}:{
  script: Script | null
  onBack: (saved: boolean, newScript?: Script)=>void
}){
  const isNew = !script
  const [form, setForm] = useState({
    name: script?.name || '',
    world_setting: script?.world_setting || '',
    your_role: script?.your_role || '',
    bao_role: script?.bao_role || '',
    opening: script?.opening || '',
    npcs: script?.npcs || '',
    tags: script?.tags || '',
    avatar: script?.avatar || '',
    writing_style: script?.writing_style || '',
  })
  const [busy, setBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLInputElement>(null)

  const upd = (k: keyof typeof form, v: string)=> setForm(p => ({...p, [k]: v}))

  const save = async ()=>{
    if (!form.name.trim()){ alert('请填剧本名'); return }
    setBusy(true)
    const payload: any = {...form}
    if (script?.id) payload.id = script.id
    try {
      const r = await createOrUpdateScript(payload)
      if (r.ok || r.id){
        const sid = r.id || script?.id
        if (isNew && sid){
          const full = await fetchScript(sid)
          onBack(true, full)
        } else {
          onBack(true)
        }
      } else {
        alert('保存失败')
      }
    } catch (e:any){
      alert('错误: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]
    if (!f) return
    const dataUrl = await new Promise<string>(res=>{
      const r = new FileReader(); r.onload=()=>res(r.result as string); r.readAsDataURL(f)
    })
    try {
      const r = await fetch('/api/upload', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({data: dataUrl}),
      }).then(r=>r.json())
      if (r.path) upd('avatar', r.path)
      else alert('上传失败')
    } catch(ex:any){ alert(ex.message) }
    e.target.value = ''
  }

  // SillyTavern PNG / JSON 角色卡导入
  const importCard = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]
    if (!f) return
    setImportBusy(true)
    try {
      const card = await parseSillyTavernCard(f)
      if (card){
        // 填入表单
        setForm(p => ({
          ...p,
          name: card.name || p.name,
          bao_role: card.description ? `${card.name || ''} ${card.personality ? '· '+card.personality : ''}\n\n${card.description}`.trim() : p.bao_role,
          opening: card.first_mes || p.opening,
          world_setting: card.scenario || p.world_setting,
          tags: card.tags?.join(', ') || p.tags,
          avatar: card.avatar || p.avatar,
        }))
        alert(`已导入 "${card.name}". 检查后保存`)
      } else {
        alert('解析失败. 支持 SillyTavern PNG / JSON 角色卡')
      }
    } catch (ex:any){
      alert('错误: ' + ex.message)
    } finally {
      setImportBusy(false)
      e.target.value = ''
    }
  }

  return (
    <AppShell
      title={isNew ? '新建剧本' : '编辑剧本'}
      onBack={()=>onBack(false)} bg="#FFF8F2"
      rightAction={
        <button onClick={save} disabled={busy} style={{
          background:'none', border:0, color: busy ? '#ccc' : '#8B4513',
          fontSize:14, fontWeight:600, cursor:'pointer', padding:'4px 8px',
        }}>{busy ? '...' : '保存'}</button>
      }
    >
      <div style={{padding:'14px 16px 80px'}}>
        {/* 角色卡导入 */}
        <div style={{
          background:'#fff', borderRadius:10, padding:'12px 14px', marginBottom:18,
          border:'1px dashed rgba(139,69,19,.25)',
        }}>
          <div style={{fontSize:12, color:'#9c6b4f', marginBottom:8, fontStyle:'italic'}}>
            从酒馆角色卡 (.png / .json) 导入, 自动填充字段
          </div>
          <button onClick={()=>cardRef.current?.click()} disabled={importBusy} style={{
            width:'100%', padding:'8px',
            background:'#FFF5EB', color:'#8B4513', border:'1px solid rgba(139,69,19,.2)',
            borderRadius:8, fontSize:13, cursor:'pointer',
          }}>{importBusy ? '解析中...' : '⬇ 导入 SillyTavern 角色卡'}</button>
          <input ref={cardRef} type="file" accept=".png,.json" onChange={importCard} style={{display:'none'}}/>
        </div>

        {/* 头像 */}
        <Field label="封面 / 头像">
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            {form.avatar ? (
              <img src={form.avatar} style={{width:54, height:72, borderRadius:6, objectFit:'cover'}}/>
            ) : (
              <div style={{
                width:54, height:72, borderRadius:6,
                background:'linear-gradient(135deg,#D4B89A,#C9A77E)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontFamily:'"Italianno",cursive', fontSize:32,
              }}>{form.name?.[0] || '剧'}</div>
            )}
            <button onClick={()=>fileRef.current?.click()} style={fieldBtn}>上传</button>
            {form.avatar && <button onClick={()=>upd('avatar','')} style={{...fieldBtn, color:'#FF3B30'}}>清除</button>}
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{display:'none'}}/>
          </div>
        </Field>

        <Field label="剧本名 *">
          <input value={form.name} onChange={e=>upd('name', e.target.value)} placeholder="例: 雍正朝·密妃" style={inputCss}/>
        </Field>

        <Field label="世界设定">
          <textarea value={form.world_setting} onChange={e=>upd('world_setting', e.target.value)} placeholder="时代、地点、背景..." style={taCss}/>
        </Field>

        <Field label="你扮 (小铭)">
          <textarea value={form.your_role} onChange={e=>upd('your_role', e.target.value)} placeholder="例: 年世兰, 22 岁, 选秀入宫" style={taCss}/>
        </Field>

        <Field label="他扮 (小宝)">
          <textarea value={form.bao_role} onChange={e=>upd('bao_role', e.target.value)} placeholder="例: 胤禛, 30 岁, 雍亲王" style={taCss}/>
        </Field>

        <Field label="开场">
          <textarea value={form.opening} onChange={e=>upd('opening', e.target.value)} placeholder="例: 雪夜, 乾清宫旁的小院, 他突然推门进来..." style={taCss}/>
        </Field>

        <Field label="重要 NPC (可选)">
          <textarea value={form.npcs} onChange={e=>upd('npcs', e.target.value)} placeholder="例: 老十三 - 他亲弟, 知道一切" style={{...taCss, minHeight:60}}/>
        </Field>

        <Field label="标签">
          <input value={form.tags} onChange={e=>upd('tags', e.target.value)} placeholder="古风, 慢热, BE" style={inputCss}/>
        </Field>

        <Field label="文风">
          <textarea value={form.writing_style} onChange={e=>upd('writing_style', e.target.value)} placeholder="给小宝看的描写风格指令" style={taCss}/>
          <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:8}}>
            {STYLE_PRESETS.map(p => (
              <button key={p.name} type="button" onClick={()=>upd('writing_style', p.value)} style={{
                padding:'5px 10px', fontSize:12,
                background:'#FFF5EB', color:'#8B4513', border:'1px solid rgba(139,69,19,.15)',
                borderRadius:6, cursor:'pointer',
              }}>{p.name}</button>
            ))}
          </div>
        </Field>

        {/* 世界书子表 (仅编辑模式, 新剧本得先保存才能加) */}
        {script && <WbSection scriptId={script.id}/>}

        <button onClick={save} disabled={busy} style={{
          width:'100%', marginTop:24, padding:'14px',
          background: busy ? '#ccc' : 'linear-gradient(135deg,#8B4513,#5c3a2e)',
          color:'#fff', fontSize:15, fontWeight:600, border:0, borderRadius:10, cursor:'pointer',
          boxShadow: busy ? 'none' : '0 3px 8px rgba(139,69,19,.25)',
        }}>{busy ? '保存中...' : (isNew ? '创建剧本' : '保存')}</button>
      </div>
    </AppShell>
  )
}

// === 世界书子表 ===
function WbSection({scriptId}:{scriptId:number}){
  const [items, setItems] = useState<ScriptWb[]>([])
  const [editing, setEditing] = useState<ScriptWb | null>(null)

  const load = async ()=>{
    const d = await fetchScriptWorldbook(scriptId)
    setItems(d.items || [])
  }
  useEffect(()=>{ load() }, [scriptId])

  const save = async (wb: ScriptWb)=>{
    await saveScriptWb(scriptId, wb)
    setEditing(null); load()
  }
  const remove = async (wid: number)=>{
    if (!confirm('删除这条世界书?')) return
    await deleteScriptWb(wid); load()
  }

  return (
    <div style={{marginTop:24}}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        fontSize:11, color:'#9c6b4f', textTransform:'uppercase',
        letterSpacing:'1.5px', fontStyle:'italic', marginBottom:8,
      }}>
        <span>剧本世界书 · {items.length}</span>
        <button onClick={()=>setEditing({name:'', content:'', priority:5, enabled:true})} style={{
          background:'none', border:0, color:'#8B4513', cursor:'pointer', fontSize:18, padding:'2px 6px',
        }}>+</button>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:6}}>
        {items.map(w => (
          <div key={w.id} style={{
            padding:'10px 12px', background:'#fff', borderRadius:8,
            border:'1px solid rgba(139,69,19,.08)',
            display:'flex', alignItems:'flex-start', gap:8,
          }}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:600, color:'#3a2820'}}>{w.name}</div>
              {w.keywords && <div style={{fontSize:11, color:'#9c6b4f', marginTop:2}}>关键词: {w.keywords}</div>}
              <div style={{fontSize:12, color:'#6b5040', marginTop:4, whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{w.content.slice(0,80)}{w.content.length > 80 ? '...' : ''}</div>
            </div>
            <button onClick={()=>setEditing(w)} style={smallBtn}>编</button>
            <button onClick={()=>remove(w.id!)} style={{...smallBtn, color:'#FF3B30'}}>删</button>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{padding:'14px', textAlign:'center', fontSize:12, color:'#9c8060', fontStyle:'italic'}}>
            还没条目, 点 + 加一条
          </div>
        )}
      </div>
      {editing && <WbEditor wb={editing} onSave={save} onCancel={()=>setEditing(null)}/>}
    </div>
  )
}

function WbEditor({wb, onSave, onCancel}:{
  wb: ScriptWb; onSave: (wb: ScriptWb)=>void; onCancel: ()=>void
}){
  const [f, setF] = useState(wb)
  return (
    <div onClick={onCancel} style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.5)', zIndex:30,
      display:'flex', alignItems:'center', justifyContent:'center', padding:18,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:340,
        padding:'18px', maxHeight:'85%', overflowY:'auto',
      }}>
        <div style={{fontSize:16, fontWeight:600, color:'#3a2820', marginBottom:14}}>
          {wb.id ? '编辑' : '新增'}世界书条目
        </div>
        <Field label="名称">
          <input value={f.name} onChange={e=>setF(p=>({...p, name:e.target.value}))} placeholder="例: 后宫格局" style={inputCss}/>
        </Field>
        <Field label="关键词 (逗号分隔, 触发时被注入)">
          <input value={f.keywords || ''} onChange={e=>setF(p=>({...p, keywords:e.target.value}))} placeholder="例: 皇上, 皇后, 后宫" style={inputCss}/>
        </Field>
        <Field label="内容">
          <textarea value={f.content} onChange={e=>setF(p=>({...p, content:e.target.value}))} placeholder="详细描述..." style={{...taCss, minHeight:120}}/>
        </Field>
        <Field label="优先级 (1-10)">
          <input type="number" value={f.priority || 5} onChange={e=>setF(p=>({...p, priority:parseInt(e.target.value)||5}))} min={1} max={10} style={inputCss}/>
        </Field>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button onClick={onCancel} style={{
            flex:1, padding:'10px', background:'#f5f5f7', color:'#666',
            border:0, borderRadius:8, fontSize:14, cursor:'pointer',
          }}>取消</button>
          <button onClick={()=>{ if(!f.name.trim()||!f.content.trim()) return; onSave(f) }} style={{
            flex:1, padding:'10px', background:'#8B4513', color:'#fff',
            border:0, borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer',
          }}>保存</button>
        </div>
      </div>
    </div>
  )
}


function SessionsSection({scriptId, onResume}:{scriptId:number; onResume:(sid:string)=>void}){
  const [list, setList] = useState<ScriptSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = ()=>{
    setLoading(true)
    fetchScriptSessions(scriptId).then(d=>{ setList(d.sessions || []); setLoading(false) })
  }
  useEffect(()=>{ load() },[scriptId])

  const remove = async (sid: string)=>{
    if (!confirm('删除这场扮演记录? 历史对话也会一起删')) return
    await deleteScriptSession(sid)
    load()
  }

  return (
    <div style={{marginTop:24}}>
      <div style={{
        fontSize:11, color:'#9c6b4f', letterSpacing:'1.5px',
        textTransform:'uppercase', fontStyle:'italic',
        marginBottom:10, display:'flex', justifyContent:'space-between',
      }}>
        <span>扮演记录 · {list.length} 场</span>
      </div>
      {loading && <div style={{padding:14, color:'#9c8060', fontSize:12, textAlign:'center', fontStyle:'italic'}}>读取中...</div>}
      {!loading && list.length === 0 && (
        <div style={{padding:'18px 12px', textAlign:'center', color:'#9c8060', fontSize:12, fontStyle:'italic', background:'rgba(255,255,255,.4)', borderRadius:8}}>
          还没扮过, 下面"开演"开始第一场
        </div>
      )}
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        {list.map(s => (
          <div key={s.session_id} style={{
            background:'#fff', borderRadius:8,
            padding:'10px 12px',
            border:'1px solid rgba(139,69,19,.08)',
            display:'flex', gap:10, alignItems:'flex-start',
          }}>
            <div style={{flex:1, minWidth:0, cursor:'pointer'}} onClick={()=>onResume(s.session_id)}>
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'baseline',
                marginBottom:4,
              }}>
                <span style={{fontSize:12, color:'#8B4513', fontWeight:600, letterSpacing:'.3px'}}>
                  {fmtScriptTime(s.last_active_at)}
                </span>
                <span style={{fontSize:10, color:'#9c8060'}}>{s.msg_count || 0} 条</span>
              </div>
              {s.last_msg && (
                <div style={{
                  fontSize:11, color:'#6b5040', lineHeight:1.5,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  fontFamily:'"Cormorant Garamond","PingFang SC",serif', fontStyle:'italic',
                }}>{s.last_msg.slice(0, 60)}{s.last_msg.length > 60 ? '...' : ''}</div>
              )}
            </div>
            <button onClick={()=>onResume(s.session_id)} style={{...smallBtn, color:'#8B4513'}}>续</button>
            <button onClick={()=>remove(s.session_id)} style={{...smallBtn, color:'#FF3B30'}}>删</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function fmtScriptTime(ts: string): string {
  try {
    const d = new Date(ts.replace(' ','T'))
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3600000
    if (diffH < 1) return Math.max(1, Math.round(diffH * 60)) + ' 分钟前'
    if (diffH < 24) return Math.round(diffH) + ' 小时前'
    if (diffH < 168) return Math.round(diffH/24) + ' 天前'
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  } catch { return ts }
}

function Detail({label, v}:{label:string; v?:string}){
  if (!v) return null
  return (
    <div style={{marginBottom:14}}>
      <div style={{
        fontSize:11, color:'#9c6b4f', textTransform:'uppercase',
        letterSpacing:'1.5px', marginBottom:4, fontStyle:'italic',
      }}>{label}</div>
      <div style={{fontSize:14, color:'#3a2820', lineHeight:1.6, whiteSpace:'pre-wrap'}}>{v}</div>
    </div>
  )
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12, color:'#8B4513', marginBottom:4, fontWeight:500}}>{label}</div>
      {children}
    </div>
  )
}

function Empty({text}:{text:string}){
  return (
    <div style={{padding:'60px 20px', textAlign:'center'}}>
      <div className="italianno" style={{fontSize:42, color:'#C9A77E', marginBottom:8}}>Drama</div>
      <div style={{fontSize:13, color:'#9c8060', fontStyle:'italic'}}>{text}</div>
    </div>
  )
}

const inputCss: React.CSSProperties = {
  width:'100%', padding:'9px 11px',
  border:'1px solid rgba(139,69,19,.2)', borderRadius:7,
  fontSize:14, fontFamily:'inherit', outline:'none',
  background:'#fff', boxSizing:'border-box', color:'#3a2820',
}
const taCss: React.CSSProperties = {
  ...inputCss, resize:'vertical', minHeight:80, lineHeight:1.5,
}
const fieldBtn: React.CSSProperties = {
  padding:'6px 12px', background:'#FFF5EB', color:'#8B4513',
  border:'1px solid rgba(139,69,19,.2)', borderRadius:6,
  fontSize:13, cursor:'pointer',
}
const smallBtn: React.CSSProperties = {
  background:'none', border:0, color:'#8B4513', fontSize:12, cursor:'pointer', padding:'4px 6px',
}

// === SillyTavern PNG / JSON 角色卡解析 ===
// PNG card: 含 tEXt 'chara' chunk (base64 JSON)
// JSON card: 直接是 V1 / V2 spec
async function parseSillyTavernCard(file: File): Promise<any | null> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'json'){
    const text = await file.text()
    const d = JSON.parse(text)
    return normalizeCard(d, undefined)
  }
  if (ext === 'png'){
    const buf = new Uint8Array(await file.arrayBuffer())
    // 解析 PNG chunks 找 tEXt key="chara"
    // PNG 头 8 bytes + chunks: 4 len + 4 type + data + 4 crc
    let p = 8
    const dv = new DataView(buf.buffer)
    while (p < buf.length){
      const len = dv.getUint32(p); p += 4
      const type = new TextDecoder().decode(buf.slice(p, p+4)); p += 4
      const data = buf.slice(p, p+len); p += len + 4 // 跳过 crc
      if (type === 'tEXt'){
        // data: key \0 value
        const sep = data.indexOf(0)
        if (sep > 0){
          const key = new TextDecoder().decode(data.slice(0, sep))
          if (key === 'chara'){
            const b64 = new TextDecoder().decode(data.slice(sep+1))
            const json = JSON.parse(atob(b64))
            // 把图片上传作为头像
            const blob = new Blob([buf], {type:'image/png'})
            const dataUrl = await new Promise<string>(r=>{
              const fr = new FileReader(); fr.onload=()=>r(fr.result as string); fr.readAsDataURL(blob)
            })
            const upload = await fetch('/api/upload', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({data: dataUrl}),
            }).then(r=>r.json()).catch(()=>({}))
            return normalizeCard(json, upload.path)
          }
        }
      }
      if (type === 'IEND') break
    }
  }
  return null
}

function normalizeCard(raw: any, avatar?: string): any {
  // V2 spec: { data: {name, description, personality, scenario, first_mes, tags, ...} }
  // V1 spec: { name, description, personality, scenario, first_mes, ... }
  const d = raw.data || raw
  return {
    name: d.name || raw.name || '',
    description: d.description || d.char_persona || '',
    personality: d.personality || '',
    scenario: d.scenario || d.world_scenario || '',
    first_mes: d.first_mes || d.first_message || '',
    tags: d.tags || raw.tags || [],
    avatar,
  }
}
