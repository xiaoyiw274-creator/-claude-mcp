import { useState } from 'react'
import { AppId } from './types'
import { APPS } from './apps'
import Springboard from './components/Springboard'
import AppShell from './components/AppShell'
import Placeholder from './components/Placeholder'
import WeChat from './apps/WeChat'
import Scripts from './apps/Scripts'
import Mood from './apps/Mood'
import CoRead from './apps/CoRead'
import Settings from './apps/Settings'
import WorldBook from './apps/WorldBook'
import Fishing from './apps/Fishing'
import Moments from './apps/Moments'
import Splash from './components/Splash'

export default function App(){
  const [open, setOpen] = useState<AppId | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [wallpaper] = useState<string | undefined>(()=>{
    return localStorage.getItem('sb_wallpaper') || undefined
  })

  const close = ()=> setOpen(null)
  const app = open ? APPS.find(a => a.id === open) : null

  return (
    <div className="phone">
      <div className="screen">
        <Springboard onOpen={setOpen} wallpaper={wallpaper}/>
        {open && (
          <div style={{position:'absolute', inset:0, zIndex:10}}>
            {open === 'wechat' && <WeChat onBack={close}/>}
            {open === 'scripts' && <Scripts onBack={close}/>}
            {open === 'desire' && <Mood onBack={close}/>}
            {open === 'coread' && <CoRead onBack={close}/>}
            {open === 'settings' && <Settings onBack={close}/>}
            {open === 'worldbook' && <WorldBook onBack={close}/>}
            {open === 'fishing' && <Fishing onBack={close}/>}
            {open === 'moments' && <Moments onBack={close}/>}
            {open !== 'wechat' && open !== 'scripts' && open !== 'desire' && open !== 'coread' && open !== 'settings' && open !== 'worldbook' && open !== 'fishing' && open !== 'moments' && app && (
              <AppShell title={app.name} onBack={close}>
                <Placeholder name={app.name}/>
              </AppShell>
            )}
          </div>
        )}
      </div>
      {showSplash && <Splash onDone={()=>setShowSplash(false)}/>}
    </div>
  )
}
