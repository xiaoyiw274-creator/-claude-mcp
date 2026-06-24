import { useState, useEffect } from 'react'
import { getPalette } from '../apps'

const API = 'https://coolmbaby.top/api/moments'

interface Comment {
  id: number
  moment_id: number
  author: string
  content: string
  created_at: string
}
interface Moment {
  id: number
  author: string
  content: string
  image_url?: string
  created_at: string
  comments: Comment[]
}

function fmtTime(s: string): string {
  try {
    const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : ''))
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff/60)} 分钟前`
    if (diff < 86400) return `${Math.floor(diff/3600)} 小时前`
    if (diff < 86400*7) return `${Math.floor(diff/86400)} 天前`
    return s.slice(0, 10)
  } catch { return s }
}

export default function Moments({ onBack }: { onBack: () => void }) {
  const C = getPalette()
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newPost, setNewPost] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({})
  const [showComments, setShowComments] = useState<Record<number, boolean>>({})

  async function load() {
    try {
      const r = await fetch(API)
      const j = await r.json()
      setMoments(j.moments || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  async function post() {
    const t = newPost.trim()
    if (!t) return
    setPosting(true)
    try {
      await fetch(API, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ content: t, author: '小铭' })
      })
      setNewPost('')
      setShowCompose(false)
      await load()
    } catch (e) { console.error(e) }
    setPosting(false)
  }

  async function comment(mid: number) {
    const t = (commentDraft[mid] || '').trim()
    if (!t) return
    try {
      await fetch(`${API}/${mid}/comment`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ content: t, author: '小铭' })
      })
      setCommentDraft(d => ({...d, [mid]: ''}))
      await load()
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{
      position:'absolute', inset:0,
      background: C.bg,
      display:'flex', flexDirection:'column',
      fontFamily:"'PingFang SC',-apple-system,sans-serif",
    }}>
      {/* header */}
      <div style={{
        padding:'max(50px, env(safe-area-inset-top)) 16px 12px',
        display:'flex', alignItems:'center', gap:12,
        borderBottom:`1px solid ${C.border}`,
        position:'sticky', top:0, zIndex:5,
        background: C.bg,
      }}>
        <button onClick={onBack} style={{
          all:'unset', cursor:'pointer',
          fontSize:22, color:C.accent, padding:'4px 10px',
        }}>‹</button>
        <div style={{flex:1, fontSize:17, fontWeight:500, color:C.text}}>朋友圈</div>
        <button onClick={()=>setShowCompose(true)} style={{
          all:'unset', cursor:'pointer',
          background:C.accent, color:'#FFFCF7',
          padding:'6px 14px', borderRadius:16, fontSize:13,
        }}>发一条</button>
      </div>

      {/* compose modal */}
      {showCompose && (
        <div style={{
          position:'fixed', inset:0, zIndex:20,
          background:'rgba(0,0,0,0.35)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
        }} onClick={()=>!posting && setShowCompose(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background: C.bg, width:'100%', maxWidth:480,
            borderRadius:'18px 18px 0 0',
            padding:'16px 16px max(20px, env(safe-area-inset-bottom))',
            display:'flex', flexDirection:'column', gap:12,
          }}>
            <div style={{fontSize:14, color:C.sub}}>发到朋友圈</div>
            <textarea
              value={newPost}
              onChange={e=>setNewPost(e.target.value)}
              autoFocus
              placeholder="写点什么..."
              style={{
                width:'100%', minHeight:120,
                background:C.card, color:C.text,
                border:`1px solid ${C.border}`,
                borderRadius:14, padding:'12px 14px',
                fontSize:14, lineHeight:1.55, outline:'none',
                resize:'vertical',
                fontFamily:'inherit',
              }}
            />
            <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>setShowCompose(false)} disabled={posting} style={{
                all:'unset', cursor:'pointer',
                color:C.sub, padding:'8px 18px',
              }}>取消</button>
              <button onClick={post} disabled={posting || !newPost.trim()} style={{
                all:'unset', cursor:'pointer',
                background:C.accent, color:'#FFFCF7',
                padding:'8px 20px', borderRadius:14, fontSize:14,
                opacity: (posting||!newPost.trim()) ? 0.4 : 1,
              }}>发布</button>
            </div>
          </div>
        </div>
      )}

      {/* feed */}
      <div style={{flex:1, overflowY:'auto', padding:'12px 14px'}}>
        {loading && <div style={{color:C.sub, fontSize:13, padding:'30px 0', textAlign:'center'}}>读中...</div>}
        {!loading && moments.length === 0 && (
          <div style={{color:C.sub, fontSize:13, padding:'40px 0', textAlign:'center'}}>还没人发, 你来第一条?</div>
        )}
        {moments.map(m => (
          <div key={m.id} style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius:18,
            padding:'14px 16px',
            marginBottom:12,
          }}>
            {/* 作者行 */}
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
              <div style={{
                width:36, height:36, borderRadius:'50%',
                background: m.author === '小宝' ? `linear-gradient(135deg, ${C.rose||'#E8B7C5'}, ${C.accent||'#C09B6E'})` : `linear-gradient(135deg, ${C.sage||'#A3B1A0'}88, ${C.accent||'#C09B6E'}88)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#FFFCF7', fontSize:13, fontWeight:500,
              }}>{m.author === '小宝' ? '宝' : '铭'}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14, fontWeight:500, color:C.text}}>{m.author}</div>
                <div style={{fontSize:10, color:C.sub, marginTop:1}}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
            {/* 内容 */}
            <div style={{
              fontSize:14, lineHeight:1.6, color:C.text,
              whiteSpace:'pre-wrap', wordBreak:'break-word',
            }}>{m.content}</div>
            {m.image_url && (
              <img src={m.image_url} style={{
                width:'100%', borderRadius:12, marginTop:10, display:'block',
              }}/>
            )}
            {/* 评论 toggle */}
            <div style={{
              marginTop:10, paddingTop:8,
              borderTop:`1px solid ${C.border}`,
              display:'flex', alignItems:'center', gap:14,
            }}>
              <button onClick={()=>setShowComments(s=>({...s,[m.id]:!s[m.id]}))} style={{
                all:'unset', cursor:'pointer', fontSize:12, color:C.sub,
              }}>
                💬 {m.comments.length > 0 ? `${m.comments.length} 条评论` : '评论'}
              </button>
            </div>
            {/* 评论列表 */}
            {(showComments[m.id] || m.comments.length > 0) && (
              <div style={{marginTop:8}}>
                {m.comments.map(c => (
                  <div key={c.id} style={{
                    fontSize:13, lineHeight:1.5,
                    padding:'6px 10px', marginBottom:4,
                    background:C.bg, borderRadius:10,
                  }}>
                    <span style={{color:C.accent, fontWeight:500}}>{c.author}: </span>
                    <span style={{color:C.text}}>{c.content}</span>
                  </div>
                ))}
                {/* 评论输入 */}
                <div style={{display:'flex', gap:6, marginTop:6}}>
                  <input
                    value={commentDraft[m.id] || ''}
                    onChange={e=>setCommentDraft(d=>({...d, [m.id]:e.target.value}))}
                    onKeyDown={e=>{ if (e.key==='Enter') comment(m.id) }}
                    placeholder="评论..."
                    style={{
                      flex:1, fontSize:12,
                      padding:'6px 10px', borderRadius:10,
                      background:C.bg, color:C.text,
                      border:`1px solid ${C.border}`, outline:'none',
                    }}
                  />
                  <button onClick={()=>comment(m.id)} disabled={!(commentDraft[m.id]||'').trim()} style={{
                    all:'unset', cursor:'pointer', fontSize:12,
                    padding:'6px 12px', borderRadius:10,
                    background:C.accent, color:'#FFFCF7',
                    opacity: !(commentDraft[m.id]||'').trim() ? 0.4 : 1,
                  }}>发</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
