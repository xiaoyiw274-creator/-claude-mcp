import { useEffect, useState } from 'react'
import { MinimaxConfig, getMinimaxConfig, saveMinimaxConfig, fetchTts, playUrl } from '../lib/tts'

export default function TtsConfig({onClose}:{onClose:()=>void}){
  const [cfg, setCfg] = useState<MinimaxConfig>({group_id:'', api_key:'', voice_id:'', configured:false})
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testText, setTestText] = useState('你来了。我等了你很久。')

  useEffect(()=>{
    getMinimaxConfig().then(c => { setCfg(c); setLoading(false) })
  },[])

  const save = async ()=>{
    await saveMinimaxConfig(cfg)
    const fresh = await getMinimaxConfig()
    setCfg(fresh)
    alert('已保存')
  }
  const test = async ()=>{
    setTesting(true)
    const r = await fetchTts(testText)
    setTesting(false)
    if (r.error) alert('失败: ' + r.error)
    else if (r.url) playUrl(r.url)
  }

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:100,
      background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:18,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:340,
        padding:'20px', maxHeight:'85%', overflowY:'auto',
      }}>
        <div style={{fontSize:17, fontWeight:600, color:'#1a1a1a', marginBottom:6}}>
          MiniMax 语音
        </div>
        <div style={{fontSize:12, color:'#888', marginBottom:14, lineHeight:1.5}}>
          填 MiniMax 控制台的 <a href="https://platform.minimaxi.com" target="_blank" style={{color:'#FF8FA3'}}>group_id / api_key</a>, 后端代理调用 TTS, 自动缓存
        </div>

        {loading ? <div style={{padding:20, textAlign:'center', color:'#999'}}>加载…</div> : <>
          <Field label="Group ID">
            <input value={cfg.group_id} onChange={e=>setCfg(p=>({...p, group_id:e.target.value}))}
              placeholder="MiniMax 控制台 → 账户信息" style={inp}/>
          </Field>
          <Field label="API Key">
            <input value={cfg.api_key} onChange={e=>setCfg(p=>({...p, api_key:e.target.value}))}
              type="password" placeholder="eyJxxx..." style={inp}/>
          </Field>
          <Field label="Voice ID">
            <input value={cfg.voice_id} onChange={e=>setCfg(p=>({...p, voice_id:e.target.value}))}
              placeholder="male-qn-qingse (默认), 或填克隆音色 ID" style={inp}/>
            <div style={{display:'flex', gap:4, marginTop:6, flexWrap:'wrap'}}>
              {['male-qn-qingse','male-qn-jingying','male-qn-badao','presenter_male','audiobook_male_1'].map(v => (
                <button key={v} onClick={()=>setCfg(p=>({...p, voice_id:v}))} style={chip}>{v}</button>
              ))}
            </div>
          </Field>

          <div style={{
            background: cfg.configured ? '#E8F8EE' : '#FFF5EE',
            color: cfg.configured ? '#1F7A3D' : '#8B4513',
            padding:'8px 12px', borderRadius:8, fontSize:12,
            marginBottom:14, textAlign:'center',
          }}>
            状态: {cfg.configured ? '✓ 已配置' : '× 未配置 (group_id + api_key 必填)'}
          </div>

          <button onClick={save} style={btnFill}>保存配置</button>

          <div style={{borderTop:'1px dashed #eee', margin:'16px 0 12px', paddingTop:12}}>
            <div style={{fontSize:12, color:'#666', marginBottom:6}}>测试合成</div>
            <input value={testText} onChange={e=>setTestText(e.target.value)} style={{...inp, marginBottom:8}}/>
            <button onClick={test} disabled={testing || !cfg.configured} style={{
              ...btnFill, background: testing || !cfg.configured ? '#ccc' : '#34C759',
            }}>{testing ? '合成中…' : '试听'}</button>
          </div>

          <button onClick={onClose} style={{...btnFill, background:'#f5f5f7', color:'#666', marginTop:6}}>关闭</button>
        </>}
      </div>
    </div>
  )
}

function Field({label, children}:{label:string;children:React.ReactNode}){
  return <div style={{marginBottom:12}}>
    <div style={{fontSize:12, color:'#666', marginBottom:4, fontWeight:500}}>{label}</div>
    {children}
  </div>
}
const inp: React.CSSProperties = {
  width:'100%', padding:'9px 11px',
  border:'1px solid #e0e0e5', borderRadius:7,
  fontSize:13, outline:'none', background:'#fafafa', boxSizing:'border-box',
}
const btnFill: React.CSSProperties = {
  width:'100%', padding:'10px',
  background:'#FF8FA3', color:'#fff', border:0, borderRadius:8,
  fontSize:14, fontWeight:600, cursor:'pointer',
}
const chip: React.CSSProperties = {
  background:'#f5f5f7', color:'#666', border:0, borderRadius:5,
  padding:'3px 7px', fontSize:10, cursor:'pointer',
}
