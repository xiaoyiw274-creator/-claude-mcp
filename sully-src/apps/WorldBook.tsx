import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import {
  GlobalWb, ScriptWb, Script,
  fetchGlobalWb, saveGlobalWb, deleteGlobalWb,
  fetchScripts, fetchScriptWorldbook, saveScriptWb, deleteScriptWb,
} from '../lib/api'

type Tab = 'global' | string  // 'global' | script_id 字符串

export default function WorldBook({ onBack }: { onBack: ()=>void }){
  const [tab, setTab] = useState<Tab>('global')
  const [globalWbs, setGlobalWbs] = useState<GlobalWb[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [scriptWbs, setScriptWbs] = useState<Record<number, ScriptWb[]>>({})
  const [editing, setEditing] = useState<null | {wb: any; scope: 'global' | number}>(null)

  const loadGlobal = async ()=>{
    const d = await fetchGlobalWb()
    setGlobalWbs(d.entries || [])
  }
  const loadScripts = async ()=>{
    const d = await fetchScripts()
    setScripts(d.scripts || [])
  }
  const loadScriptWb = async (sid: number)=>{
    const d = await fetchScriptWorldbook(sid)
    setScriptWbs(p => ({...p, [sid]: d.items || []}))
  }

  useEffect(()=>{
    loadGlobal()
    loadScripts()
  },[])

  // 切换 tab 自动拉对应剧本的 wb
  useEffect(()=>{
    if (tab !== 'global'){
      const sid = parseInt(tab)
      if (!isNaN(sid) && !scriptWbs[sid]) loadScriptWb(sid)
    }
  },[tab])

  const onSave = async (wb: any)=>{
    if (editing?.scope === 'global'){
      await saveGlobalWb(wb)
      loadGlobal()
    } else if (typeof editing?.scope === 'number'){
      await saveScriptWb(editing.scope, wb)
      loadScriptWb(editing.scope)
    }
    setEditing(null)
  }
  const onDelete = async (wb: any)=>{
    if (!confirm(`删除"${wb.name}"?`)) return
    if (tab === 'global'){
      await deleteGlobalWb(wb.id)
      loadGlobal()
    } else {
      await deleteScriptWb(wb.id)
      const sid = parseInt(tab)
      loadScriptWb(sid)
    }
  }

  const currentEntries: any[] = tab === 'global'
    ? globalWbs
    : (scriptWbs[parseInt(tab)] || [])

  const currentScope: 'global' | number = tab === 'global' ? 'global' : parseInt(tab)
  const currentScopeName = tab === 'global'
    ? '全局'
    : (scripts.find(s => String(s.id) === tab)?.name || '剧本')

  return (
    <AppShell
      title="世界书"
      onBack={onBack}
      bg="#FBF6EE"
      rightAction={
        <button onClick={()=>setEditing({wb:{name:'',keywords:'',content:'',priority:5,enabled:true}, scope: currentScope})}
          style={{background:'none', border:0, color:'#8B4513', fontSize:22, cursor:'pointer', padding:'4px 8px', lineHeight:1}}>+</button>
      }
    >
      {/* Tabs */}
      <div style={{
        display:'flex', gap:0, overflowX:'auto', scrollbarWidth:'none',
        background:'#FBF6EE',
        borderBottom:'1px solid rgba(139,69,19,.08)',
        padding:'8px 14px 0',
      }}>
        <TabBtn label="全局" count={globalWbs.length} active={tab === 'global'} onClick={()=>setTab('global')}/>
        {scripts.map(s => (
          <TabBtn key={s.id}
            label={s.name}
            count={scriptWbs[s.id]?.length}
            active={tab === String(s.id)}
            onClick={()=>setTab(String(s.id))}/>
        ))}
      </div>

      <div style={{padding:'14px 14px 60px'}}>
        <div style={{
          fontSize:11, color:'#9c6b4f', letterSpacing:'1.5px',
          textTransform:'uppercase', fontStyle:'italic',
          marginBottom:10, display:'flex', justifyContent:'space-between',
        }}>
          <span>{currentScopeName} · {currentEntries.length} 条</span>
          {tab === 'global' && <span style={{color:'#a89478'}}>所有聊天自动触发</span>}
          {tab !== 'global' && <span style={{color:'#a89478'}}>仅此剧本激活时触发</span>}
        </div>

        {currentEntries.length === 0 && (
          <div style={{padding:'40px 20px', textAlign:'center', color:'#9c8060', fontSize:13, fontStyle:'italic'}}>
            还没条目, 点右上 + 加一条
          </div>
        )}

        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {currentEntries.map((w:any) => (
            <div key={w.id} style={{
              background:'#fff', borderRadius:10,
              padding:'12px 14px',
              border:'1px solid rgba(139,69,19,.08)',
              boxShadow:'0 1px 4px rgba(139,69,19,.04)',
              display:'flex', gap:10, alignItems:'flex-start',
            }}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{
                  fontFamily:'"Cormorant Garamond","PingFang SC",serif',
                  fontSize:15, fontWeight:600, color:'#3a2820', marginBottom:4,
                }}>{w.name}</div>
                {w.keywords && (
                  <div style={{fontSize:11, color:'#9c6b4f', marginBottom:4, fontStyle:'italic'}}>
                    关键词: {w.keywords}
                  </div>
                )}
                <div style={{
                  fontSize:12, color:'#6b5040', lineHeight:1.5,
                  whiteSpace:'pre-wrap', wordBreak:'break-word',
                }}>{w.content?.slice(0,100)}{w.content?.length > 100 ? '…' : ''}</div>
                <div style={{display:'flex', gap:8, marginTop:6, fontSize:10, color:'#a89478'}}>
                  <span>优先级 {w.priority || 5}</span>
                  {(w.enabled === false || w.enabled === 0) && <span style={{color:'#FF6B5C'}}>· 已禁用</span>}
                </div>
              </div>
              <button onClick={()=>setEditing({wb: w, scope: currentScope})} style={smallBtn}>编</button>
              <button onClick={()=>onDelete(w)} style={{...smallBtn, color:'#FF3B30'}}>删</button>
            </div>
          ))}
        </div>
      </div>

      {editing && <Editor wb={editing.wb} scope={editing.scope} scopeName={currentScopeName}
        onSave={onSave} onCancel={()=>setEditing(null)}/>}
    </AppShell>
  )
}

function TabBtn({label, count, active, onClick}:{label:string; count?:number; active:boolean; onClick:()=>void}){
  return (
    <button onClick={onClick} style={{
      flex:'0 0 auto', padding:'8px 12px 10px',
      background:'none', border:0, cursor:'pointer',
      borderBottom: active ? '2px solid #8B4513' : '2px solid transparent',
      color: active ? '#8B4513' : '#a89478',
      fontWeight: active ? 600 : 400,
      fontSize:13, whiteSpace:'nowrap',
    }}>
      {label}{count !== undefined ? <span style={{fontSize:10, marginLeft:4, opacity:.7}}>{count}</span> : ''}
    </button>
  )
}

function Editor({wb, scope, scopeName, onSave, onCancel}:{
  wb: any; scope: 'global' | number; scopeName: string;
  onSave: (wb:any)=>void; onCancel: ()=>void
}){
  const [f, setF] = useState({
    id: wb.id,
    name: wb.name || '',
    keywords: wb.keywords || '',
    content: wb.content || '',
    priority: wb.priority || 5,
    enabled: wb.enabled !== false && wb.enabled !== 0,
  })
  return (
    <div onClick={onCancel} style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,.5)', zIndex:30,
      display:'flex', alignItems:'center', justifyContent:'center', padding:18,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:340,
        padding:'18px', maxHeight:'85%', overflowY:'auto',
      }}>
        <div style={{fontSize:16, fontWeight:600, color:'#3a2820', marginBottom:4}}>
          {wb.id ? '编辑' : '新增'}世界书条目
        </div>
        <div style={{fontSize:11, color:'#9c8060', marginBottom:12, fontStyle:'italic'}}>
          作用域: {scopeName}
        </div>
        <Field label="名称">
          <input value={f.name} onChange={e=>setF(p=>({...p, name:e.target.value}))} placeholder="例: 后宫格局" style={inputCss}/>
        </Field>
        <Field label="关键词 (逗号分隔, 命中触发)">
          <input value={f.keywords} onChange={e=>setF(p=>({...p, keywords:e.target.value}))} placeholder="例: 皇上, 皇后, 后宫" style={inputCss}/>
        </Field>
        <Field label="内容">
          <textarea value={f.content} onChange={e=>setF(p=>({...p, content:e.target.value}))} placeholder="详细描述..." style={{...inputCss, minHeight:120, resize:'vertical'}}/>
        </Field>
        <Field label={`优先级 (1-10, 当前 ${f.priority})`}>
          <input type="range" min={1} max={10} value={f.priority} onChange={e=>setF(p=>({...p, priority:parseInt(e.target.value)}))} style={{width:'100%'}}/>
        </Field>
        <Field label="启用">
          <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
            <input type="checkbox" checked={f.enabled} onChange={e=>setF(p=>({...p, enabled:e.target.checked}))}/>
            <span style={{fontSize:13, color:'#666'}}>{f.enabled ? '生效' : '已禁用'}</span>
          </label>
        </Field>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <button onClick={onCancel} style={btnGhost}>取消</button>
          <button onClick={()=>{
            if (!f.name.trim() || !f.content.trim()){ alert('名称和内容必填'); return }
            onSave({...f, enabled: f.enabled ? 1 : 0})
          }} style={btnFill}>保存</button>
        </div>
      </div>
    </div>
  )
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return <div style={{marginBottom:12}}>
    <div style={{fontSize:12, color:'#8B4513', marginBottom:4, fontWeight:500}}>{label}</div>
    {children}
  </div>
}

const inputCss: React.CSSProperties = {
  width:'100%', padding:'9px 11px',
  border:'1px solid rgba(139,69,19,.2)', borderRadius:7,
  fontSize:14, fontFamily:'inherit', outline:'none',
  background:'#fff', boxSizing:'border-box', color:'#3a2820',
}
const smallBtn: React.CSSProperties = {
  background:'none', border:0, color:'#8B4513', fontSize:12, cursor:'pointer', padding:'4px 6px',
}
const btnFill: React.CSSProperties = {
  flex:1, padding:'10px', background:'#8B4513', color:'#fff',
  border:0, borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer',
}
const btnGhost: React.CSSProperties = {
  flex:1, padding:'10px', background:'#f5f5f7', color:'#666',
  border:0, borderRadius:8, fontSize:14, cursor:'pointer',
}
