import { useState, useRef } from 'react'
import { ThemeData, parseAndUploadTheme, loadTheme, saveTheme } from '../lib/theme'

interface Props {
  onClose: ()=>void
  onApplied: (t: ThemeData | null)=>void
}

export default function ThemeImport({ onClose, onApplied }: Props){
  const fileRef = useRef<HTMLInputElement>(null)
  const [current, setCurrent] = useState<ThemeData | null>(loadTheme())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({cur:0, total:0, label:''})

  const handle = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    setProgress({cur:0, total:0, label:'读取文件...'})
    try {
      const t = await parseAndUploadTheme(f, (cur,total,label)=>{
        setProgress({cur,total,label})
      })
      saveTheme(t)
      setCurrent(t)
      onApplied(t)
      onClose()
    } catch (ex:any){
      alert('导入失败: ' + ex.message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clear = ()=>{
    if (!confirm('恢复默认主题?')) return
    saveTheme(null)
    setCurrent(null)
    onApplied(null)
    onClose()
  }

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:200,
      background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:20,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:320,
        padding:'20px', overflow:'hidden',
      }}>
        <div style={{fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:6}}>主屏主题</div>
        <div style={{fontSize:12, color:'#888', marginBottom:14}}>
          导入兔k 风格的 HomeScreen.json 主题包<br/>
          (含壁纸 / 桌面小组件 / 自定义图标 / 装饰气泡)
        </div>

        {current && (
          <div style={{
            background:'#f8f5fa', borderRadius:10, padding:'10px 12px', marginBottom:14,
            display:'flex', alignItems:'center', gap:10,
          }}>
            {current.profileAvatarImg && (
              <img src={current.profileAvatarImg} style={{
                width:36, height:36, borderRadius:'50%', objectFit:'cover',
              }}/>
            )}
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:13, fontWeight:600, color:'#1a1a1a'}}>{current.name}</div>
              <div style={{fontSize:11, color:'#888'}}>{current.profileUsername || '已应用'}</div>
            </div>
          </div>
        )}

        {busy ? (
          <div style={{textAlign:'center', padding:'20px 0'}}>
            <div style={{fontSize:13, color:'#666', marginBottom:10}}>
              {progress.label}
            </div>
            <div style={{
              width:'100%', height:6, background:'#eee', borderRadius:3, overflow:'hidden',
            }}>
              <div style={{
                width: progress.total ? `${progress.cur/progress.total*100}%` : '0%',
                height:'100%', background:'#FF8FA3', transition:'width .2s',
              }}/>
            </div>
            <div style={{fontSize:11, color:'#999', marginTop:6}}>{progress.cur}/{progress.total}</div>
          </div>
        ) : (
          <>
            <button onClick={()=>fileRef.current?.click()} style={{
              width:'100%', padding:'12px', background:'#FF8FA3',
              color:'#fff', border:0, borderRadius:10, fontSize:14, fontWeight:600,
              cursor:'pointer', marginBottom:8,
            }}>
              {current ? '换一个主题' : '导入 .json 主题包'}
            </button>
            {current && (
              <button onClick={clear} style={{
                width:'100%', padding:'10px', background:'#f5f5f7',
                color:'#FF3B30', border:0, borderRadius:10, fontSize:13,
                cursor:'pointer', marginBottom:8,
              }}>恢复默认</button>
            )}
            <button onClick={onClose} style={{
              width:'100%', padding:'10px', background:'#f5f5f7',
              color:'#666', border:0, borderRadius:10, fontSize:13, cursor:'pointer',
            }}>关闭</button>
          </>
        )}

        <input ref={fileRef} type="file" accept=".json" onChange={handle} style={{display:'none'}}/>
      </div>
    </div>
  )
}
