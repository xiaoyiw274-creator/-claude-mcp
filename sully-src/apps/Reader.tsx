import { useEffect, useState, useRef, useCallback } from 'react'
import StatusBar from '../components/StatusBar'
import {
  Book, Chapter, Danmaku, Annotation,
  fetchBook, fetchChapter, fetchDanmaku, fetchAnnotations,
  postDanmaku, postAnnotation, deleteAnnotation, deleteDanmaku,
  setProgress, askBao,
} from '../lib/ebook'

interface Props { book: Book; onBack: ()=>void }

const HIGHLIGHT_COLORS = {
  yellow: '#FFF5C2',
  pink: '#FFD9E0',
  green: '#D8F0C9',
  blue: '#C9E0F5',
}

export default function Reader({book: initBook, onBack}: Props){
  const [book, setBook] = useState(initBook)
  const [chapterIdx, setChapterIdx] = useState(initBook.current_chapter || 0)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [danmakus, setDanmakus] = useState<Danmaku[]>([])
  const [annos, setAnnos] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(false)
  const [showDanmakuPanel, setShowDanmakuPanel] = useState(false)
  const [showChapters, setShowChapters] = useState(false)
  const [selMenu, setSelMenu] = useState<null | {x:number; y:number; text:string; pIdx:number}>(null)
  const [annoEdit, setAnnoEdit] = useState<null | {pIdx:number; text:string; color:string}>(null)
  const [inpDanmaku, setInpDanmaku] = useState('')
  const [askInp, setAskInp] = useState('')
  const [askCtx, setAskCtx] = useState<null | {pIdx:number; sIdx:number; sText:string; pText:string}>(null)
  const [fontSize, setFontSize] = useState(16)

  const load = useCallback(async ()=>{
    setLoading(true)
    try {
      const [ch, dm, an] = await Promise.all([
        fetchChapter(book.id, chapterIdx),
        fetchDanmaku(book.id, chapterIdx),
        fetchAnnotations(book.id, chapterIdx),
      ])
      setChapter(ch)
      setDanmakus(dm.danmaku || [])
      setAnnos(an.annotations || [])
      // 更新进度
      await setProgress(book.id, chapterIdx, true)
    } catch (e:any){ console.error(e) }
    setLoading(false)
  },[book.id, chapterIdx])

  useEffect(()=>{ load() }, [load])

  // 长按选词 / 鼠标选中文字 → 弹菜单
  const onTextMouseUp = (e: React.MouseEvent, pIdx: number)=>{
    const sel = window.getSelection()
    if (!sel || sel.toString().trim().length < 2) return
    const text = sel.toString().trim()
    const rect = (sel.getRangeAt(0) as Range).getBoundingClientRect()
    setSelMenu({x: rect.left + rect.width/2, y: rect.top, text, pIdx})
  }

  const closeSelMenu = ()=>{ setSelMenu(null); window.getSelection()?.removeAllRanges() }

  const doHighlight = async (color: string)=>{
    if (!selMenu) return
    await postAnnotation(book.id, chapterIdx, selMenu.pIdx, selMenu.text, '', color, '小艺')
    closeSelMenu(); load()
  }

  const doAnnotate = ()=>{
    if (!selMenu) return
    setAnnoEdit({pIdx: selMenu.pIdx, text: selMenu.text, color: 'yellow'})
    closeSelMenu()
  }

  const doAsk = ()=>{
    if (!selMenu) return
    const para = chapter?.paragraphs[selMenu.pIdx] || ''
    setAskCtx({pIdx: selMenu.pIdx, sIdx: -1, sText: selMenu.text, pText: para})
    closeSelMenu()
  }

  const submitAnno = async (note: string, color: string)=>{
    if (!annoEdit) return
    await postAnnotation(book.id, chapterIdx, annoEdit.pIdx, annoEdit.text, note, color, '小艺')
    setAnnoEdit(null); load()
  }

  const submitAsk = async ()=>{
    if (!askCtx) return
    await askBao(book.id, chapterIdx, askCtx.pIdx, askCtx.sIdx, askCtx.sText, askCtx.pText, askInp)
    setAskCtx(null); setAskInp('')
    setTimeout(load, 2000) // 给小宝点时间
  }

  const sendDanmaku = async ()=>{
    if (!inpDanmaku.trim()) return
    await postDanmaku(book.id, chapterIdx, -1, -1, inpDanmaku, '小艺')
    setInpDanmaku(''); load()
  }

  const turnPage = async (delta: number)=>{
    const next = chapterIdx + delta
    if (next < 0 || next >= book.total_chapters) return
    setChapterIdx(next)
  }

  // 段落渲染: 应用 annotations (划线高亮)
  const renderParagraph = (text: string, pIdx: number)=>{
    const myAnnos = annos.filter(a => a.paragraph_idx === pIdx)
    if (myAnnos.length === 0) return text

    // 按 anchor_text 在 text 里找位置, 拼装 highlight 标记
    // 用 marker 替换法简化 - 把每个 anchor 包成 span
    const parts: ({text:string; anno?:Annotation})[] = [{text}]
    for (const anno of myAnnos){
      const newParts: typeof parts = []
      for (const p of parts){
        if (p.anno){ newParts.push(p); continue }
        const idx = p.text.indexOf(anno.anchor_text)
        if (idx < 0){ newParts.push(p); continue }
        if (idx > 0) newParts.push({text: p.text.slice(0, idx)})
        newParts.push({text: anno.anchor_text, anno})
        if (idx + anno.anchor_text.length < p.text.length){
          newParts.push({text: p.text.slice(idx + anno.anchor_text.length)})
        }
      }
      parts.length = 0; parts.push(...newParts)
    }
    return parts.map((p, i)=>{
      if (!p.anno) return <span key={i}>{p.text}</span>
      const bg = HIGHLIGHT_COLORS[p.anno.color as keyof typeof HIGHLIGHT_COLORS] || '#FFF5C2'
      const isBao = p.anno.author === '小宝'
      return (
        <span key={i}
          title={p.anno.note ? `${p.anno.author}: ${p.anno.note}` : `${p.anno.author} 划了线`}
          onClick={(e)=>{
            e.stopPropagation()
            if (confirm(`${p.anno.author} ${p.anno.note ? '的批注:\n\n'+p.anno.note+'\n\n' : '划了这段'}删除?`)){
              deleteAnnotation(book.id, p.anno!.id).then(load)
            }
          }}
          style={{
            background: bg,
            padding:'1px 2px', borderRadius:3,
            borderBottom: isBao ? '2px solid #FF8FA3' : 'none',
            cursor:'pointer',
          }}>{p.text}</span>
      )
    })
  }

  return (
    <div style={{
      position:'absolute', inset:0,
      background:'linear-gradient(180deg, #FBF6EE 0%, #F4EBDB 100%)',
      display:'flex', flexDirection:'column',
      animation:'chatSlide .25s ease-out',
    }}>
      <StatusBar tint="#3a2820"/>
      
      {/* nav */}
      <div style={{
        flex:'0 0 auto',
        display:'flex', alignItems:'center', gap:6,
        padding:'8px 12px',
        background:'rgba(251,246,238,.92)',
        backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(139,69,19,.1)',
      }}>
        <button onClick={onBack} style={navBtn}>‹</button>
        <div style={{flex:1, textAlign:'center'}}>
          <div style={{
            fontSize:15, fontWeight:600, color:'#3a2820',
            fontFamily:'"Cormorant Garamond","PingFang SC",serif',
          }}>{book.title}</div>
          <div style={{fontSize:10, color:'#9c8060', marginTop:1, fontStyle:'italic'}}>
            第 {chapterIdx+1} / {book.total_chapters} 章 {chapter ? `· ${chapter.title}` : ''}
          </div>
        </div>
        <button onClick={()=>setShowChapters(true)} style={navBtn} title="目录">☰</button>
        <button onClick={()=>setShowDanmakuPanel(v=>!v)} style={{...navBtn, color: showDanmakuPanel ? '#FF8FA3' : '#3a2820'}} title="弹幕">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>
        </button>
      </div>

      {/* main: text + danmaku panel */}
      <div style={{flex:1, display:'flex', minHeight:0}}>
        <div className="selectable" style={{
          flex:1, overflowY:'auto', padding:'20px 22px 80px',
          fontFamily:'"Cormorant Garamond","PingFang SC","Source Han Serif SC",serif',
        }}>
          {loading && <div style={{textAlign:'center', color:'#9c8060', padding:30}}>翻页中...</div>}
          {!loading && chapter && (
            <>
              <h2 style={{
                fontSize:22, color:'#3a2820', marginBottom:18, fontWeight:600,
                textAlign:'center', letterSpacing:'1px',
              }}>{chapter.title}</h2>
              {chapter.paragraphs.map((p, pi) => (
                <p key={pi}
                  onMouseUp={(e)=>onTextMouseUp(e, pi)}
                  onTouchEnd={(e)=>setTimeout(()=>onTextMouseUp(e as any, pi), 80)}
                  style={{
                    fontSize:fontSize, lineHeight:1.95,
                    color:'#3a2820', marginBottom:14,
                    textAlign:'justify', letterSpacing:'.3px',
                    textIndent: '2em',
                    WebkitUserSelect:'text',
                    userSelect:'text',
                    WebkitTouchCallout:'default',
                  }}>
                  {renderParagraph(p, pi)}
                </p>
              ))}
            </>
          )}
        </div>

        {showDanmakuPanel && (
          <div style={{
            flex:'0 0 auto', width:160,
            background:'rgba(255,250,240,.95)',
            borderLeft:'1px solid rgba(139,69,19,.1)',
            overflowY:'auto', padding:'14px 10px 80px',
          }}>
            <div style={{
              fontSize:11, color:'#9c6b4f', textTransform:'uppercase',
              letterSpacing:'1.5px', fontStyle:'italic', marginBottom:10, textAlign:'center',
            }}>本章弹幕 · {danmakus.length}</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {danmakus.map(d => (
                <div key={d.id} style={{
                  background: d.author === '小宝' ? '#FFE4EC' : '#FFF5DD',
                  borderRadius:8, padding:'6px 8px',
                  borderLeft: `3px solid ${d.author === '小宝' ? '#FF8FA3' : '#FFD58A'}`,
                }}>
                  <div style={{fontSize:10, color:'#9c6b4f', marginBottom:2, fontWeight:600}}>
                    {d.author}
                  </div>
                  <div style={{fontSize:12, color:'#3a2820', lineHeight:1.5, whiteSpace:'pre-wrap'}}>
                    {d.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* bottom: 翻页 + 发弹幕 */}
      <div style={{
        flex:'0 0 auto',
        padding:'8px 10px',
        paddingBottom:'max(8px, env(safe-area-inset-bottom))',
        background:'rgba(255,250,240,.95)',
        borderTop:'1px solid rgba(139,69,19,.1)',
        display:'flex', gap:8, alignItems:'center',
      }}>
        <button onClick={()=>turnPage(-1)} disabled={chapterIdx <= 0} style={pageBtn(chapterIdx<=0)}>‹ 上章</button>
        <input value={inpDanmaku} onChange={e=>setInpDanmaku(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter') sendDanmaku()}}
          placeholder="发条弹幕..." inputMode="text"
          style={{
            flex:1, border:'1px solid rgba(139,69,19,.2)', borderRadius:18,
            padding:'7px 14px', fontSize:13, background:'#fff', color:'#3a2820',
            outline:'none', fontFamily:'inherit',
          }}/>
        <button onClick={()=>turnPage(1)} disabled={chapterIdx >= book.total_chapters-1} style={pageBtn(chapterIdx >= book.total_chapters-1)}>下章 ›</button>
      </div>

      {/* 选词菜单 */}
      {selMenu && (
        <>
          <div onClick={closeSelMenu} style={{position:'fixed', inset:0, zIndex:99}}/>
          <div style={{
            position:'fixed', zIndex:100,
            left: Math.min(window.innerWidth - 200, Math.max(10, selMenu.x - 100)),
            top: Math.max(selMenu.y - 60, 60),
            background:'#3a2820', borderRadius:8,
            display:'flex', overflow:'hidden',
            boxShadow:'0 6px 20px rgba(0,0,0,.25)',
          }}>
            <button onClick={()=>doHighlight('yellow')} style={selMenuBtn}>
              <span style={{display:'inline-block', width:14, height:14, borderRadius:3, background:'#FFF5C2'}}/>
            </button>
            <button onClick={()=>doHighlight('pink')} style={selMenuBtn}>
              <span style={{display:'inline-block', width:14, height:14, borderRadius:3, background:'#FFD9E0'}}/>
            </button>
            <button onClick={()=>doHighlight('green')} style={selMenuBtn}>
              <span style={{display:'inline-block', width:14, height:14, borderRadius:3, background:'#D8F0C9'}}/>
            </button>
            <button onClick={doAnnotate} style={{...selMenuBtn, fontSize:12, padding:'8px 12px'}}>批注</button>
            <button onClick={doAsk} style={{...selMenuBtn, fontSize:12, padding:'8px 12px', background:'#FF8FA3'}}>问小宝</button>
          </div>
        </>
      )}

      {/* 批注编辑 */}
      {annoEdit && (
        <Modal onClose={()=>setAnnoEdit(null)} title="批注">
          <div style={{
            background:'#FFF5C2', borderRadius:6, padding:'8px 12px',
            fontSize:13, color:'#3a2820', marginBottom:10,
            fontFamily:'"Cormorant Garamond","PingFang SC",serif',
          }}>"{annoEdit.text}"</div>
          <textarea autoFocus placeholder="写下你的想法..."
            onChange={e=>setAnnoEdit({...annoEdit, text:annoEdit.text, color:annoEdit.color})}
            id="annoNote"
            style={{...inpCss, minHeight:80, resize:'vertical', marginBottom:10}}/>
          <div style={{display:'flex', gap:6, marginBottom:12}}>
            {Object.entries(HIGHLIGHT_COLORS).map(([k, v]) => (
              <button key={k}
                onClick={()=>setAnnoEdit({...annoEdit, color:k})}
                style={{
                  width:28, height:28, borderRadius:'50%',
                  background:v, border: annoEdit.color === k ? '2px solid #8B4513' : '1px solid #ddd',
                  cursor:'pointer',
                }}/>
            ))}
          </div>
          <div style={{display:'flex', gap:8}}>
            <button onClick={()=>setAnnoEdit(null)} style={btnGhost}>取消</button>
            <button onClick={()=>{
              const note = (document.getElementById('annoNote') as HTMLTextAreaElement)?.value || ''
              submitAnno(note, annoEdit.color)
            }} style={btnFill}>保存</button>
          </div>
        </Modal>
      )}

      {/* 召唤小宝 */}
      {askCtx && (
        <Modal onClose={()=>setAskCtx(null)} title="召唤小宝">
          <div style={{
            background:'#FFE4EC', borderRadius:6, padding:'8px 12px',
            fontSize:13, color:'#3a2820', marginBottom:10,
            fontFamily:'"Cormorant Garamond","PingFang SC",serif',
          }}>"{askCtx.sText}"</div>
          <textarea value={askInp} onChange={e=>setAskInp(e.target.value)} autoFocus
            placeholder="想问小宝什么? (留空则让他自由发挥)"
            style={{...inpCss, minHeight:80, resize:'vertical', marginBottom:10}}/>
          <div style={{display:'flex', gap:8}}>
            <button onClick={()=>setAskCtx(null)} style={btnGhost}>取消</button>
            <button onClick={submitAsk} style={{...btnFill, background:'#FF8FA3'}}>召唤</button>
          </div>
        </Modal>
      )}

      {/* 章节列表 */}
      {showChapters && (
        <Modal onClose={()=>setShowChapters(false)} title="目录">
          <ChapterList bookId={book.id} cur={chapterIdx} onPick={(idx)=>{setChapterIdx(idx); setShowChapters(false)}}/>
        </Modal>
      )}

      <style>{`@keyframes chatSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  )
}

function ChapterList({bookId, cur, onPick}:{bookId:number; cur:number; onPick:(i:number)=>void}){
  const [list, setList] = useState<{idx:number;title:string}[]>([])
  useEffect(()=>{
    import('../lib/ebook').then(m => m.fetchChapters(bookId)).then(d => setList(d.chapters || []))
  },[bookId])
  return (
    <div style={{maxHeight:'60vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:4}}>
      {list.map(c => (
        <button key={c.idx} onClick={()=>onPick(c.idx)} style={{
          padding:'8px 12px', textAlign:'left',
          background: c.idx === cur ? '#FFF5EB' : 'transparent',
          color: c.idx === cur ? '#8B4513' : '#3a2820',
          border:0, borderRadius:6,
          fontFamily:'"Cormorant Garamond","PingFang SC",serif', fontSize:13,
          cursor:'pointer',
        }}>{c.idx+1}. {c.title}</button>
      ))}
    </div>
  )
}

function Modal({children, onClose, title}:{children:React.ReactNode; onClose:()=>void; title:string}){
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:18,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:340,
        padding:'18px', maxHeight:'85%', overflowY:'auto',
      }}>
        <div style={{fontSize:15, fontWeight:600, color:'#3a2820', marginBottom:12}}>{title}</div>
        {children}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background:'none', border:0, color:'#3a2820',
  fontSize:22, cursor:'pointer', padding:'4px 10px', lineHeight:1,
  display:'flex', alignItems:'center',
}
const selMenuBtn: React.CSSProperties = {
  background:'transparent', border:0, color:'#fff',
  padding:'8px', cursor:'pointer', display:'flex', alignItems:'center',
}
function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#f5f0e8' : '#8B4513',
    color: disabled ? '#bbb' : '#fff',
    border:0, borderRadius:18, padding:'6px 12px',
    fontSize:12, cursor: disabled ? 'default' : 'pointer',
    whiteSpace:'nowrap',
  }
}
const inpCss: React.CSSProperties = {
  width:'100%', padding:'8px 10px',
  border:'1px solid #e0e0e5', borderRadius:8,
  fontSize:13, fontFamily:'inherit', outline:'none', background:'#fafafa', boxSizing:'border-box',
}
const btnFill: React.CSSProperties = {
  flex:1, padding:'9px', background:'#8B4513', color:'#fff',
  border:0, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
}
const btnGhost: React.CSSProperties = {
  flex:1, padding:'9px', background:'#f5f5f7', color:'#666',
  border:0, borderRadius:8, fontSize:13, cursor:'pointer',
}
