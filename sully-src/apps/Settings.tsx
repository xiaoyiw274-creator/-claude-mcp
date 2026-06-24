import { useState } from 'react'
import AppShell from '../components/AppShell'
import ThemeImport from '../components/ThemeImport'
import { loadTheme, ThemeData, setAppIcon } from '../lib/theme'
import { APPS } from '../apps'
import { useRef } from 'react'
import { loadRules, saveRules, newRule, resetDefault, RegexRule } from '../lib/regex'
import { DECOR_SLOTS, loadDecors, setDecor } from '../lib/decor'

export default function Settings({ onBack }: { onBack: ()=>void }){
  const [theme, setTheme] = useState<ThemeData | null>(loadTheme())
  const [showImport, setShowImport] = useState(false)

  return (
    <AppShell title="设置" onBack={onBack} bg="#F8F5FF">
      <div style={{padding:'16px 14px 60px'}}>
        {/* Profile group */}
        <Group label="个人">
          <Row icon="👤" label="头像" value={theme?.profileAvatarImg ? '已设' : '默认'} onClick={()=>setShowImport(true)}/>
          <Row icon="📝" label="昵称" value={theme?.profileUsername || '小铭'} onClick={()=>setShowImport(true)}/>
          <Row icon="💬" label="个签" value={theme?.profileBio || '空'} onClick={()=>setShowImport(true)}/>
        </Group>

        {/* Theme group - 关键: 主题导入入口 */}
        <Group label="外观">
          <Row icon="🎨" label="主屏主题"
            value={theme ? theme.name : '默认'}
            onClick={()=>setShowImport(true)}/>
          <Row icon="🖼" label="壁纸" value={theme?.wallpaper ? '已设' : '渐变'} onClick={()=>setShowImport(true)}/>
        </Group>



        {/* 主屏壁纸 - 相册任意一张图 */}
        <div style={{padding:'14px 8px 4px', fontSize:11, color:'rgba(100,80,160,.6)', letterSpacing:'1.5px', textTransform:'uppercase'}}>
          主屏壁纸
        </div>
        <div style={{background:'#fff', borderRadius:12, overflow:'hidden', marginBottom:8}}>
          <WallpaperRow/>
        </div>

        {/* 外观模式 - 暗色/亮色 */}
        <div style={{padding:'14px 8px 4px', fontSize:11, color:'rgba(100,80,160,.6)', letterSpacing:'1.5px', textTransform:'uppercase'}}>
          外观模式
        </div>
        <div style={{background:'#fff', borderRadius:12, overflow:'hidden', marginBottom:8}}>
          <ModeRow/>
        </div>


        {/* === 装饰图片 (主屏背景散布) === */}
        <div style={{padding:'14px 8px 4px', fontSize:11, color:'rgba(100,80,160,.6)', letterSpacing:'1.5px', textTransform:'uppercase'}}>
          装饰图片
        </div>
        {/* <DecorSection/> */}

        {/* === 图标库: 单独换每个 app 的图标 === */}
        <div style={{padding:'14px 8px 4px', fontSize:11, color:'rgba(100,80,160,.6)', letterSpacing:'1.5px', textTransform:'uppercase'}}>
          图标库
        </div>
        <div style={{background:'#fff', borderRadius:12, overflow:'hidden', marginBottom:8}}>
          {APPS.map(app => (
            <IconRow key={app.id} app={app} customUrl={theme?.appIcons?.[app.id]}
              onChanged={()=>{ setTheme(loadTheme()) }}/>
          ))}
        </div>


        {/* === 语言过滤 (套话正则) === */}
        <div style={{padding:'14px 8px 4px', fontSize:11, color:'rgba(100,80,160,.6)', letterSpacing:'1.5px', textTransform:'uppercase'}}>
          语言过滤
        </div>
        <RegexSection/>

        <Group label="语音">
          <Row icon="🔊" label="MiniMax 语音" value="未配置" onClick={()=>alert('剧本馆开演后右上角设置')}/>
        </Group>

        <Group label="位置">
          <Row icon="📍" label="Geo 追踪" value="✓ 已开启" onClick={()=>alert('已通过 pyicloud 拉取, 每 5 分钟刷新')}/>
        </Group>

        <Group label="关于">
          <Row icon="ℹ️" label="版本" value="sully 0.4"/>
          <Row icon="🔗" label="后端" value="coolmbaby.top/api"/>
        </Group>

        {showImport && (
          <ThemeImport
            onClose={()=>setShowImport(false)}
            onApplied={(t)=>{setTheme(t); window.location.reload()}}
          />
        )}
      </div>
    </AppShell>
  )
}



function ModeRow(){
  const [mode, setMode] = useState<'light'|'dark'>(()=>{
    return (localStorage.getItem('sully_mode') as any) || 'light'
  })
  const toggle = (m: 'light' | 'dark')=>{
    localStorage.setItem('sully_mode', m)
    setMode(m)
  }
  return (
    <div style={{padding:'12px 14px', display:'flex', gap:10, alignItems:'center'}}>
      <span style={{fontSize:18}}>🎨</span>
      <span style={{flex:1, fontSize:14, color:'#1a1a1a'}}>主屏配色</span>
      <div style={{display:'flex', gap:6}}>
        <button onClick={()=>toggle('light')} style={{
          padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer',
          background: mode === 'light' ? '#C09B6E' : '#f5f5f7',
          color: mode === 'light' ? '#fff' : '#666',
          border:0, fontWeight: mode === 'light' ? 600 : 400,
        }}>奶咖</button>
        <button onClick={()=>toggle('dark')} style={{
          padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer',
          background: mode === 'dark' ? '#0A84FF' : '#f5f5f7',
          color: mode === 'dark' ? '#fff' : '#666',
          border:0, fontWeight: mode === 'dark' ? 600 : 400,
        }}>暗夜</button>
      </div>
    </div>
  )
}


function RegexSection(){
  const [rules, setRules] = useState<RegexRule[]>(()=>loadRules())
  const [editing, setEditing] = useState<RegexRule | null>(null)

  const updateRules = (next: RegexRule[])=>{
    setRules(next); saveRules(next)
  }
  const toggle = (id: string)=>{
    updateRules(rules.map(r => r.id === id ? {...r, enabled:!r.enabled} : r))
  }
  const remove = (id: string)=>{
    if (!confirm('删除这条?')) return
    updateRules(rules.filter(r => r.id !== id))
  }
  const save = (r: RegexRule)=>{
    const exists = rules.find(x => x.id === r.id)
    if (exists) updateRules(rules.map(x => x.id === r.id ? r : x))
    else updateRules([...rules, r])
    setEditing(null)
  }
  return (
    <>
      <div style={{background:'#fff', borderRadius:12, overflow:'hidden', marginBottom:8}}>
        {rules.map(r => (
          <div key={r.id} style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 14px',
            borderBottom:'.5px solid rgba(0,0,0,.05)',
            opacity: r.enabled ? 1 : .45,
          }}>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, color:'#1a1a1a'}}>{r.name || '(未命名)'}</div>
              <div style={{fontSize:10, color:'#999', marginTop:1, fontFamily:'monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                /{r.pattern}/{r.flags || 'g'} {'->'} "{r.replacement}"
              </div>
            </div>
            <input type="checkbox" checked={r.enabled} onChange={()=>toggle(r.id)} title="启用"/>
            <button onClick={()=>setEditing(r)} style={smallBtn}>编</button>
            <button onClick={()=>remove(r.id)} style={{...smallBtn, color:'#FF3B30'}}>删</button>
          </div>
        ))}
        <div style={{display:'flex', gap:8, padding:'8px 14px'}}>
          <button onClick={()=>setEditing(newRule())} style={{
            flex:1, padding:'8px', background:'#F6F4F1', color:'#8B4513',
            border:'1px solid rgba(139,69,19,.15)', borderRadius:6, fontSize:12, cursor:'pointer',
          }}>+ 新增</button>
          <button onClick={()=>{ if(confirm('恢复默认 7 条?')){ resetDefault(); setRules(loadRules()) } }} style={{
            flex:1, padding:'8px', background:'#F6F4F1', color:'#666',
            border:'1px solid rgba(0,0,0,.05)', borderRadius:6, fontSize:12, cursor:'pointer',
          }}>恢复默认</button>
        </div>
      </div>
      {editing && <RegexEditor rule={editing} onSave={save} onCancel={()=>setEditing(null)}/>}
    </>
  )
}

function RegexEditor({rule, onSave, onCancel}:{rule:RegexRule; onSave:(r:RegexRule)=>void; onCancel:()=>void}){
  const [f, setF] = useState(rule)
  const [preview, setPreview] = useState('她紧张地咬了咬下唇,心跳漏了一拍')
  let testOut = preview
  try { testOut = preview.replace(new RegExp(f.pattern, f.flags || 'g'), f.replacement) } catch(e:any){ testOut = '(regex 错: ' + e.message + ')' }
  return (
    <div onClick={onCancel} style={{
      position:'absolute', inset:0, zIndex:100,
      background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:18,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:340,
        padding:'18px', maxHeight:'85%', overflowY:'auto',
      }}>
        <div style={{fontSize:16, fontWeight:600, marginBottom:12}}>正则规则</div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11, color:'#666', marginBottom:4}}>名称</div>
          <input value={f.name} onChange={e=>setF({...f, name:e.target.value})} style={inpCss} placeholder="例: 咬下唇"/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11, color:'#666', marginBottom:4}}>正则模式 (不含 //)</div>
          <input value={f.pattern} onChange={e=>setF({...f, pattern:e.target.value})} style={{...inpCss, fontFamily:'monospace'}} placeholder="例: 咬了?咬下唇"/>
        </div>
        <div style={{display:'flex', gap:8, marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:'#666', marginBottom:4}}>flags</div>
            <input value={f.flags || 'g'} onChange={e=>setF({...f, flags:e.target.value})} style={{...inpCss, fontFamily:'monospace'}}/>
          </div>
          <div style={{flex:2}}>
            <div style={{fontSize:11, color:'#666', marginBottom:4}}>替换成 (留空 = 删除)</div>
            <input value={f.replacement} onChange={e=>setF({...f, replacement:e.target.value})} style={inpCss}/>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11, color:'#666', marginBottom:4}}>测试文本</div>
          <textarea value={preview} onChange={e=>setPreview(e.target.value)} style={{...inpCss, minHeight:50, resize:'vertical'}}/>
        </div>
        <div style={{background:'#F6F4F1', padding:'8px 10px', borderRadius:6, fontSize:12, color:'#555', marginBottom:14, minHeight:30}}>
          → {testOut || '(空)'}
        </div>
        <div style={{display:'flex', gap:8}}>
          <button onClick={onCancel} style={btnGhost2}>取消</button>
          <button onClick={()=>onSave(f)} style={btnFill2}>保存</button>
        </div>
      </div>
    </div>
  )
}
const smallBtn: React.CSSProperties = {
  background:'none', border:0, color:'#8B4513', fontSize:12, cursor:'pointer', padding:'4px 6px',
}
const inpCss: React.CSSProperties = {
  width:'100%', padding:'8px 10px', border:'1px solid #e0e0e5', borderRadius:6,
  fontSize:13, outline:'none', background:'#fafafa', boxSizing:'border-box',
}
const btnFill2: React.CSSProperties = {flex:1, padding:'9px', background:'#8B4513', color:'#fff', border:0, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer'}
const btnGhost2: React.CSSProperties = {flex:1, padding:'9px', background:'#f5f5f7', color:'#666', border:0, borderRadius:8, fontSize:13, cursor:'pointer'}


function DecorSection(){
  const [, force] = useState(0)
  const decors = loadDecors()
  return (
    <div style={{background:'#fff', borderRadius:12, overflow:'hidden', marginBottom:8}}>
      <div style={{padding:'8px 14px', fontSize:11, color:'#999', borderBottom:'.5px solid rgba(0,0,0,.04)'}}>
        5 个槽位 · 上传后自动散布到主屏背景
      </div>
      {DECOR_SLOTS.map(slot => (
        <DecorRow key={slot.id} slotId={slot.id} slotName={slot.name}
          blend={slot.blend}
          currentUrl={decors[slot.id]}
          onChanged={()=>force(n=>n+1)}/>
      ))}
    </div>
  )
}

function DecorRow({slotId, slotName, blend, currentUrl, onChanged}:{
  slotId: string; slotName: string; blend: string; currentUrl?: string; onChanged: ()=>void
}){
  const fileRef = useRef<HTMLInputElement>(null)
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>)=>{
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
      if (r.path){ setDecor(slotId, r.path); onChanged() }
      else alert('上传失败: ' + (r.error||''))
    } catch (ex:any){ alert(ex.message) }
    e.target.value = ''
  }
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'8px 14px',
      borderBottom:'.5px solid rgba(0,0,0,.05)',
    }}>
      <div style={{
        width:40, height:40, borderRadius:8,
        background: blend === 'screen' ? '#000' : '#fff',
        overflow:'hidden', flex:'0 0 40px',
        border:'1px solid rgba(0,0,0,.05)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {currentUrl ? <img src={currentUrl} style={{width:'100%', height:'100%', objectFit:'cover'}}/>
          : <span style={{fontSize:18, opacity:.3}}>○</span>}
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:13, color:'#1a1a1a'}}>{slotName}</div>
        <div style={{fontSize:10, color:'#999', marginTop:1}}>
          {blend === 'screen' ? '黑底 → 自动透' : (blend === 'multiply' ? '白底 → 自动透' : '原图')}
        </div>
      </div>
      <button onClick={()=>fileRef.current?.click()} style={{
        background:'#F6F4F1', border:'1px solid rgba(0,0,0,.05)', borderRadius:6,
        padding:'4px 10px', fontSize:12, color:'#9B9187', cursor:'pointer',
      }}>{currentUrl ? '换' : '上传'}</button>
      {currentUrl && (
        <button onClick={()=>{ setDecor(slotId, null); onChanged() }} style={{
          background:'none', border:0, color:'#FF3B30', fontSize:12, cursor:'pointer', padding:'4px 6px',
        }}>清</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{display:'none'}}/>
    </div>
  )
}


function WallpaperRow(){
  const fileRef = useRef<HTMLInputElement>(null)
  const [cur, setCur] = useState<string | null>(()=>localStorage.getItem('sb_wallpaper'))

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>)=>{
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
      if (r.path){
        localStorage.setItem('sb_wallpaper', r.path)
        setCur(r.path)
        setTimeout(()=>window.location.reload(), 200)
      } else alert('上传失败: ' + (r.error||''))
    } catch (ex:any){ alert(ex.message) }
    e.target.value = ''
  }
  const clear = ()=>{
    localStorage.removeItem('sb_wallpaper')
    setCur(null)
    setTimeout(()=>window.location.reload(), 200)
  }
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 14px',
      borderBottom:'.5px solid rgba(0,0,0,.05)',
    }}>
      <div style={{
        width:40, height:54, borderRadius:6,
        background: cur ? `url("${cur}") center/cover` : 'linear-gradient(135deg, #FFEEF2, #E5F2FF)',
        flex:'0 0 40px',
        border:'1px solid rgba(0,0,0,.05)',
      }}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:14, color:'#1a1a1a'}}>主屏壁纸</div>
        <div style={{fontSize:10, color:'#999', marginTop:1}}>{cur ? '已设' : '默认渐变'}</div>
      </div>
      <button onClick={()=>fileRef.current?.click()} style={{
        background:'#F6F4F1', border:'1px solid rgba(0,0,0,.05)', borderRadius:6,
        padding:'4px 10px', fontSize:12, color:'#9B9187', cursor:'pointer',
      }}>{cur ? '换' : '上传'}</button>
      {cur && (
        <button onClick={clear} style={{
          background:'none', border:0, color:'#FF3B30', fontSize:12, cursor:'pointer', padding:'4px 6px',
        }}>清</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{display:'none'}}/>
    </div>
  )
}


function IconRow({app, customUrl, onChanged}:{
  app: any; customUrl?: string; onChanged: ()=>void
}){
  const fileRef = useRef<HTMLInputElement>(null)
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>)=>{
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
      if (r.path){ setAppIcon(app.id, r.path); onChanged() }
      else alert('上传失败: ' + (r.error||''))
    } catch (ex:any){ alert(ex.message) }
    e.target.value = ''
  }
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'8px 14px',
      borderBottom:'.5px solid rgba(0,0,0,.05)',
    }}>
      <div style={{
        width:32, height:32, borderRadius:8,
        background: customUrl ? 'transparent' : '#f6f4f1',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#9B9187', overflow:'hidden',
        border:'1px solid rgba(0,0,0,.05)',
      }}>
        {customUrl ? <img src={customUrl} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : app.svg}
      </div>
      <span style={{flex:1, fontSize:14, color:'#2A2520'}}>{app.name}</span>
      <button onClick={()=>fileRef.current?.click()} style={{
        background:'#F6F4F1', border:'1px solid rgba(0,0,0,.05)', borderRadius:6,
        padding:'4px 10px', fontSize:12, color:'#9B9187', cursor:'pointer',
      }}>换</button>
      {customUrl && (
        <button onClick={()=>{ setAppIcon(app.id, null as any); onChanged() }} style={{
          background:'none', border:0, color:'#FF3B30', fontSize:12, cursor:'pointer', padding:'4px 6px',
        }}>清</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{display:'none'}}/>
    </div>
  )
}

function Group({label, children}:{label:string; children:React.ReactNode}){
  return (
    <>
      <div style={{padding:'14px 8px 4px', fontSize:11, color:'rgba(100,80,160,.6)', letterSpacing:'1.5px', textTransform:'uppercase'}}>
        {label}
      </div>
      <div style={{background:'#fff', borderRadius:12, overflow:'hidden', marginBottom:8}}>
        {children}
      </div>
    </>
  )
}

function Row({icon, label, value, onClick}:{icon:string; label:string; value?:string; onClick?:()=>void}){
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 14px',
      borderBottom:'.5px solid rgba(0,0,0,.05)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{fontSize:18}}>{icon}</span>
      <span style={{flex:1, fontSize:14, color:'#1a1a1a'}}>{label}</span>
      {value && <span style={{fontSize:13, color:'#999'}}>{value}</span>}
      {onClick && <span style={{color:'#ccc', fontSize:16}}>›</span>}
    </div>
  )
}
