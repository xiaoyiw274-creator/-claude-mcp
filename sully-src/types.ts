export type AppId =
  | 'wechat' | 'scripts' | 'world' | 'desire' | 'coread' | 'music'
  | 'term' | 'xbot' | 'moments' | 'diary' | 'bookshelf' | 'profile'
  | 'forum' | 'worldbook' | 'settings' | 'fishing'

export interface AppDef {
  id: AppId
  name: string
  icon: string         // emoji 占位, 后续换 svg/img
  gradient: string     // tailwind-free 内联 CSS
  page: 1 | 2          // 第几页 (dock 不属于页)
  dock?: boolean
}
