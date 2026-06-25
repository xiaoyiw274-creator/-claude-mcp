import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Chat from './Chat'
import { fetchSessions } from '../lib/api'

interface Contact {
  chatId: string
  name: string
  preview?: string
  isDefault?: boolean
}

const CONTACTS_KEY = 'sully_contacts_v1'

function loadContacts(): Contact[]{
  try {
    const saved = localStorage.getItem(CONTACTS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  // 默认: 小宝
  return [{chatId:'bao', name:'小宝', preview:'想跟你说话', isDefault:true}]
}

function saveContacts(list: Contact[]){
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)) } catch {}
}

export default function WeChat({ onBack }: { onBack: ()=>void }){
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [currentChat, setCurrentChat] = useState<Contact | null>(null)
  const [contacts, setContacts] = useState<Contact[]>(()=>loadContacts())
  const [showAdd, setShowAdd] = useState(false)
  const [sessions, setSessions] = useState<number>(0)

  useEffect(()=>{
    fetchSessions().then(d => setSessions((d.sessions || []).length))
  },[])

  const addContact = (name: string)=>{
    if (!name.trim()) return
    const newC: Contact = {
      chatId: 'c_' + Date.now().toString(36),
      name: name.trim(),
      preview: '点开开始聊',
    }
    const next = [newC, ...contacts]
    setContacts(next); saveContacts(next)
    setShowAdd(false)
  }

  const removeContact = (id: string)=>{
    const next = contacts.filter(c => c.chatId !== id)
    setContacts(next); saveContacts(next)
  }

  if (view === 'chat' && currentChat) {
    return <Chat
      onBack={()=>{ setView('list'); setCurrentChat(null) }}
      title={currentChat.name}
      chatId={currentChat.chatId}
    />
  }

  return (
    <AppShell
      title="微信"
      onBack={onBack}
      bg="#EDEDED"
      rightAction={
        <button onClick={()=>setShowAdd(true)} style={{
          background:'none', border:0, color:'#666',
          fontSize:24, cursor:'pointer', padding:'4px 8px', lineHeight:1,
        }} title="新建聊天">+</button>
      }
    >
      <div style={{background:'#fff'}}>
        {contacts.map(c => (
          <Conv
            key={c.chatId}
            name={c.name}
            preview={c.preview || ''}
            time=""
            onOpen={()=>{ setCurrentChat(c); setView('chat') }}
            onDelete={c.isDefault ? undefined : ()=>removeContact(c.chatId)}
          />
        ))}
        <div style={{padding:'14px 18px', fontSize:11, color:'#999', textAlign:'center'}}>
          后端共 {sessions} 个 session · 长按删除联系人
        </div>
      </div>

      {/* 新建联系人 */}
      {showAdd && <AddDialog onCancel={()=>setShowAdd(false)} onAdd={addContact}/>}
    </AppShell>
  )
}

function Conv({name, preview, time, onOpen, onDelete}:{
  name:string; preview:string; time:string;
  onOpen:()=>void; onDelete?:()=>void;
}){
  const [pressTimer, setPressTimer] = useState<number | null>(null)

  const startPress = ()=>{
    if (!onDelete) return
    const t = window.setTimeout(()=>{
      if (confirm(`删除联系人 "${name}"?`)) onDelete()
    }, 600)
    setPressTimer(t)
  }
  const endPress = ()=>{ if (pressTimer){ clearTimeout(pressTimer); setPressTimer(null) } }

  // 首字母 + 渐变色
  const colors = ['#FF8FA3','#9C7BB6','#5AC8FA','#F4A05F','#34C759','#FFD60A']
  const colorIdx = name.charCodeAt(0) % colors.length
  const baseColor = colors[colorIdx]

  return (
    <div
      onClick={onOpen}
      onPointerDown={startPress} onPointerUp={endPress} onPointerLeave={endPress}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'12px 16px',
        borderBottom:'.5px solid rgba(0,0,0,.06)',
        cursor:'pointer', background:'#fff',
      }}>
      <div style={{
        width:48, height:48, borderRadius:8,
        background:`linear-gradient(135deg, ${baseColor}, ${baseColor}CC)`,
        flex:'0 0 48px',
        display:'flex', alignItems:'center', justifyContent:'center',
        color:'#fff', fontSize:18, fontWeight:600,
      }}>{name[0]}</div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
          <div style={{fontSize:16, fontWeight:500, color:'#1a1a1a'}}>{name}</div>
          <div style={{fontSize:11, color:'#999'}}>{time}</div>
        </div>
        <div style={{fontSize:13, color:'#888', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{preview}</div>
      </div>
    </div>
  )
}

function AddDialog({onCancel, onAdd}:{onCancel:()=>void; onAdd:(name:string)=>void}){
  const [v, setV] = useState('')
  return (
    <div onClick={onCancel} style={{
      position:'absolute', inset:0, zIndex:30,
      background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'#fff', borderRadius:14, width:'100%', maxWidth:300,
        padding:'18px 18px 14px',
      }}>
        <div style={{fontSize:16, fontWeight:600, color:'#1a1a1a', marginBottom:12}}>新建聊天</div>
        <input value={v} onChange={e=>setV(e.target.value)} autoFocus
          placeholder="给联系人取个名"
          onKeyDown={e=>{if(e.key==='Enter') onAdd(v)}}
          style={{
            width:'100%', padding:'10px 12px',
            border:'1px solid #e0e0e5', borderRadius:8,
            fontSize:14, outline:'none', background:'#fafafa',
            marginBottom:12, boxSizing:'border-box',
          }}/>
        <button onClick={()=>onAdd(v)} disabled={!v.trim()} style={{
          width:'100%', padding:'10px',
          background: v.trim() ? '#FF8FA3' : '#ccc', color:'#fff', border:0, borderRadius:8,
          fontSize:14, fontWeight:600, cursor: v.trim() ? 'pointer' : 'default',
        }}>创建</button>
        <button onClick={onCancel} style={{
          width:'100%', padding:'10px', marginTop:6,
          background:'#f5f5f7', color:'#666', border:0, borderRadius:8,
          fontSize:14, cursor:'pointer',
        }}>取消</button>
      </div>
    </div>
  )
}
