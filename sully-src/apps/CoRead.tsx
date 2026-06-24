import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Reader from './Reader'
import { useRef } from 'react'
import { Book, fetchBooks } from '../lib/ebook'

export default function CoRead({ onBack }: { onBack: ()=>void }){
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [openBook, setOpenBook] = useState<Book | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = ()=>{
    setLoading(true)
    fetchBooks().then(d => { setBooks(d.books || []); setLoading(false) }).catch(()=>setLoading(false))
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>)=>{
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 50*1024*1024){ alert('文件太大 (>50MB)'); return }
    setUploading(true)
    try {
      const dataUrl = await new Promise<string>(res=>{
        const r = new FileReader(); r.onload=()=>res(r.result as string); r.readAsDataURL(f)
      })
      const r = await fetch('/api/ebooks/upload', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({data: dataUrl, filename: f.name}),
      }).then(r=>r.json())
      if (r.ok || r.id){
        alert(`导入成功: ${r.format || 'book'} (id ${r.id})`)
        reload()
      } else {
        alert('导入失败: ' + (r.error || JSON.stringify(r)))
      }
    } catch(ex:any){ alert('错误: ' + ex.message) }
    setUploading(false)
    e.target.value = ''
  }

  useEffect(()=>{
    fetchBooks().then(d => {
      setBooks(d.books || [])
      setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  if (openBook){
    return <Reader book={openBook} onBack={()=>setOpenBook(null)}/>
  }

  return (
    <AppShell title="一起看书" onBack={onBack} bg="#FBF6EE"
      rightAction={
        <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{
          background:'none', border:0, color: uploading ? '#ccc' : '#8B4513',
          fontSize:14, cursor:'pointer', padding:'4px 8px',
        }}>{uploading ? '上传中…' : '+ 导入'}</button>
      }
    >
      <div style={{padding:'16px 14px 60px'}}>
        {loading && <Empty text="加载中..."/>}
        {!loading && books.length === 0 && <Empty text="书架空空的"/>}
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {books.map(b => (
            <BookCard key={b.id} book={b} onOpen={()=>setOpenBook(b)}/>
          ))}
        </div>
        <input ref={fileRef} type="file" accept=".txt,.epub" onChange={onUpload} style={{display:'none'}}/>
        <div style={{textAlign:'center', fontSize:11, color:'#9c8060', fontStyle:'italic', marginTop:30}}>
          支持 .txt / .epub · 最大 50MB
        </div>
      </div>
    </AppShell>
  )
}

function BookCard({book, onOpen}:{book:Book; onOpen:()=>void}){
  const progress = book.total_chapters > 0 ? (book.current_chapter / book.total_chapters) : 0
  return (
    <div onClick={onOpen} style={{
      display:'flex', gap:14,
      padding:'14px 16px',
      background:'#fff',
      borderRadius:12,
      border:'1px solid rgba(139,69,19,.08)',
      boxShadow:'0 2px 8px rgba(139,69,19,.05)',
      cursor:'pointer',
      alignItems:'center',
    }}>
      {book.cover ? (
        <img src={book.cover} style={{
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
        }}>{book.title?.[0] || '书'}</div>
      )}
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontFamily:'"Cormorant Garamond","PingFang SC",serif',
          fontSize:16, fontWeight:600, color:'#3a2820', marginBottom:4,
        }}>{book.title}</div>
        {book.author && (
          <div style={{fontSize:11, color:'#9c8060', fontStyle:'italic', marginBottom:6}}>{book.author}</div>
        )}
        {/* progress */}
        <div style={{
          height:4, background:'#f0e8d8', borderRadius:2, overflow:'hidden',
          marginBottom:4,
        }}>
          <div style={{
            width:`${progress*100}%`, height:'100%',
            background:'linear-gradient(90deg,#C9A77E,#8B6F47)',
          }}/>
        </div>
        <div style={{fontSize:10, color:'#9c8060', display:'flex', justifyContent:'space-between'}}>
          <span>{book.current_chapter}/{book.total_chapters}</span>
          {book.is_active === 1 && <span style={{color:'#8B4513', fontWeight:600}}>在读</span>}
        </div>
      </div>
    </div>
  )
}

function Empty({text}:{text:string}){
  return (
    <div style={{padding:'60px 20px', textAlign:'center'}}>
      <div className="italianno" style={{fontSize:42, color:'#C9A77E', marginBottom:8}}>Library</div>
      <div style={{fontSize:13, color:'#9c8060', fontStyle:'italic'}}>{text}</div>
    </div>
  )
}
