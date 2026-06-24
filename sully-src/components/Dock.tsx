import { APPS } from '../apps'
import { AppId } from '../types'
import AppIcon from './AppIcon'

export default function Dock({ onOpen }:{ onOpen:(id:AppId)=>void }){
  const docks = APPS.filter(a => a.dock)
  return (
    <div style={{
      position:'absolute', bottom:18,
      left:'50%', transform:'translateX(-50%)',
      width:'calc(100% - 28px)', maxWidth:380,
      padding:'10px 16px',
      background:'rgba(255,255,255,.35)',
      backdropFilter:'blur(28px) saturate(180%)',
      WebkitBackdropFilter:'blur(28px) saturate(180%)',
      borderRadius:24,
      display:'flex', alignItems:'center', justifyContent:'space-around',
      border:'0.5px solid rgba(255,255,255,.5)',
      boxShadow:'0 8px 24px rgba(100,80,160,.1), inset 0 1px 1px rgba(255,255,255,.6)',
      marginBottom:'env(safe-area-inset-bottom)',
    }}>
      {docks.map(a => (
        <AppIcon key={a.id} app={a} dock onOpen={onOpen}/>
      ))}
    </div>
  )
}
