import { useState, useEffect, useRef } from 'react'
import { getPalette } from '../apps'

const API = 'https://coolmbaby.top/api/fishing'

interface Line {
  kind: 'cmd' | 'out'
  text: string
}

export default function Fishing({ onBack }: { onBack: () => void }) {
  const C = getPalette()
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    send('status', true)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  async function send(cmd: string, isInit = false) {
    if (busy) return
    setBusy(true)
    if (!isInit) setLines(prev => [...prev, { kind: 'cmd', text: cmd }])
    try {
      const r = await fetch(`${API}/cmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd }),
      })
      const j = await r.json()
      setLines(prev => [...prev, { kind: 'out', text: j.out || j.error || '(no output)' }])
    } catch (e: any) {
      setLines(prev => [...prev, { kind: 'out', text: '(网络: ' + e.message + ')' }])
    } finally {
      setBusy(false)
      setInput('')
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = input.trim()
    if (t) send(t)
  }

  const quick = [
    { label: 'status', cmd: 'status' },
    { label: '抛竿', cmd: 'cast' },
    { label: '连钓10', cmd: 'cast 10' },
    { label: 'shop', cmd: 'shop' },
    { label: 'goto', cmd: 'goto' },
    { label: '渔篓', cmd: 'inventory' },
    { label: '卖全部', cmd: 'sell all' },
    { label: '图鉴', cmd: 'encyclopedia' },
    { label: 'help', cmd: 'help' },
  ]

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'PingFang SC',-apple-system,sans-serif",
    }}>
      {/* header */}
      <div style={{
        padding: 'max(50px, env(safe-area-inset-top)) 16px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={onBack} style={{
          all: 'unset', cursor: 'pointer',
          fontSize: 22, color: C.accent, padding: '4px 10px',
        }}>‹</button>
        <div style={{flex: 1}}>
          <div style={{fontSize: 16, fontWeight: 500, color: C.text}}>🎣 文字钓鱼</div>
          <div style={{fontSize: 10, color: C.sub, marginTop: 2}}>
            55 种鱼 · 11 个钓点 · 四季流转
          </div>
        </div>
      </div>

      {/* 输出区 */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '14px 14px 0',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{marginBottom: 14}}>
            {l.kind === 'cmd' && (
              <div style={{
                display: 'inline-block',
                background: C.accent + '22',
                color: C.accent,
                padding: '6px 12px', borderRadius: 14,
                fontSize: 13, fontFamily: 'monospace',
                marginLeft: 'auto',
              }}>
                <span style={{opacity: 0.5}}>›</span> {l.text}
              </div>
            )}
            {l.kind === 'out' && (
              <pre style={{
                background: C.card,
                color: C.text,
                padding: '12px 14px',
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                fontSize: 13, lineHeight: 1.55,
                fontFamily: "'PingFang SC',monospace",
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}>{l.text}</pre>
            )}
          </div>
        ))}
        {busy && (
          <div style={{color: C.sub, fontSize: 12, padding: '8px 0'}}>...</div>
        )}
        <div ref={endRef}/>
      </div>

      {/* quick 按钮 */}
      <div style={{
        padding: '8px 12px',
        borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {quick.map(q => (
          <button key={q.label} onClick={() => send(q.cmd)} disabled={busy} style={{
            all: 'unset',
            cursor: busy ? 'not-allowed' : 'pointer',
            background: C.card,
            color: C.text,
            padding: '6px 12px', borderRadius: 14,
            fontSize: 12, whiteSpace: 'nowrap',
            border: `1px solid ${C.border}`,
            opacity: busy ? 0.4 : 1,
            transition: 'all 0.15s',
          }}>{q.label}</button>
        ))}
      </div>

      {/* input */}
      <form onSubmit={submit} style={{
        padding: '8px 12px max(20px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 8,
        borderTop: `1px solid ${C.border}`,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
          placeholder="输入指令 (cast / buy glow_bait 2 / goto 4 ...)"
          style={{
            flex: 1,
            background: C.card,
            color: C.text,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: '10px 14px',
            fontSize: 14, outline: 'none',
            fontFamily: "'PingFang SC',monospace",
          }}
        />
        <button type="submit" disabled={busy || !input.trim()} style={{
          all: 'unset',
          cursor: busy ? 'not-allowed' : 'pointer',
          background: C.accent,
          color: '#FFFCF7',
          padding: '10px 18px', borderRadius: 18,
          fontSize: 14, fontWeight: 500,
          opacity: (busy || !input.trim()) ? 0.4 : 1,
        }}>发</button>
      </form>
    </div>
  )
}
