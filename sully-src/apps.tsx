import { AppDef } from './types'
import { ReactNode } from 'react'

// 法式日杂手绘 SVG (照小宝那版改的, currentColor 让外层控制颜色)
const I = {
  script: <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M4 6c2-1 4.5-.5 10 2 5.5-2.5 8-3 10-2v15c-2-1-4.5-.5-10 2-5.5-2.5-8-3-10-2V6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="currentColor" fillOpacity="0.03"/>
    <path d="M14 8v15" stroke="currentColor" strokeWidth="0.6" opacity="0.3"/>
    <path d="M8 10.5h3M8 13h2" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.4"/>
    <path d="M21 4l.6 1.2 1.4.2-1 1 .2 1.4L21 7l-1.2.8.2-1.4-1-1 1.4-.2z" fill="#C09B6E" opacity="0.35"/>
  </svg>,
  book: <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect x="6" y="6" width="7" height="16" rx="1" stroke="currentColor" strokeWidth="1" transform="rotate(-5 9.5 14)" fill="currentColor" fillOpacity="0.02"/>
    <rect x="15" y="6" width="7" height="16" rx="1" stroke="currentColor" strokeWidth="1" transform="rotate(5 18.5 14)" fill="currentColor" fillOpacity="0.02"/>
    <path d="M12 9h4" stroke="currentColor" strokeWidth="0.6" opacity="0.3"/>
    <path d="M14 5c-.8-.8-2-.3-2 .5s2 2 2 2 2-1.2 2-2-.8-1.3-2-.5z" fill="#C8A4A4" opacity="0.4"/>
  </svg>,
  music: <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M7 16v-4a7 7 0 0114 0v4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <rect x="4" y="15" width="4" height="6" rx="2" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.03"/>
    <rect x="20" y="15" width="4" height="6" rx="2" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.03"/>
    <circle cx="16" cy="7" r="1" fill="#C8A4A4" opacity="0.35"/>
    <path d="M17 7V4" stroke="#C8A4A4" strokeWidth="0.6" opacity="0.35"/>
    <circle cx="19" cy="5.5" r="0.7" fill="#C09B6E" opacity="0.3"/>
    <path d="M19.7 5.5V3.5" stroke="#C09B6E" strokeWidth="0.5" opacity="0.3"/>
  </svg>,
  friends: <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="11" cy="10" r="3.2" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.02"/>
    <path d="M4.5 22c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <circle cx="19" cy="11" r="2.3" stroke="currentColor" strokeWidth="0.8" opacity="0.5" fill="currentColor" fillOpacity="0.02"/>
    <path d="M18.5 22c0-3 1.5-4.5 4-5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" strokeLinecap="round"/>
    <path d="M22 6l.4.9.9.1-.7.7.2 1-.8-.5-.8.5.2-1-.7-.7.9-.1z" fill="#C09B6E" opacity="0.35"/>
  </svg>,
  globe: <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.02"/>
    <path d="M6 14h16" stroke="currentColor" strokeWidth="0.6" opacity="0.35"/>
    <path d="M14 6c-3 3-3 13 0 16" stroke="currentColor" strokeWidth="0.6" opacity="0.35"/>
    <path d="M14 6c3 3 3 13 0 16" stroke="currentColor" strokeWidth="0.6" opacity="0.35"/>
    <ellipse cx="14" cy="10" rx="6.5" ry="2" stroke="currentColor" strokeWidth="0.5" opacity="0.2"/>
    <path d="M20 5C21 3.5 23 3 24 4C23 5 21 5.5 20 5Z" fill="#A3B1A0" opacity="0.4" stroke="#A3B1A0" strokeWidth="0.3"/>
  </svg>,
  fishing: <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M5 4l10 14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <path d="M15 18c-1 1-2 1.5-3 1" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.6"/>
    <ellipse cx="18" cy="21" rx="4.5" ry="2.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.03"/>
    <path d="M22.5 21c1-.5 2-1 2.5-1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <circle cx="14" cy="22" r="0.6" fill="#C8A4A4" opacity="0.6"/>
    <circle cx="15.5" cy="23.5" r="0.4" fill="#C8A4A4" opacity="0.5"/>
  </svg>,
  // bottom nav
  message: <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 3.5V18a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.1" fill="currentColor" fillOpacity="0.08" strokeLinejoin="round"/>
    <path d="M8 9.5h8M8 13h5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.4"/>
  </svg>,
  setting: <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
  </svg>,
  mood: <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.1"/>
    <circle cx="9" cy="10.5" r="1.2" fill="currentColor" opacity="0.6"/>
    <circle cx="15" cy="10.5" r="1.2" fill="currentColor" opacity="0.6"/>
    <path d="M8.5 15c1 1.5 2.5 2 3.5 2s2.5-.5 3.5-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/>
  </svg>,
}

export const APPS: (AppDef & {svg?: ReactNode})[] = [
  // 主网格 2×2 + 1 (世界书) - 共 5 个
  {id:'scripts',  name:'剧本馆',    icon:'', svg:I.script,  gradient:'', page:1},
  {id:'coread',   name:'一起看书',  icon:'', svg:I.book,    gradient:'', page:1},
  {id:'music',    name:'一起听歌',  icon:'', svg:I.music,   gradient:'', page:1},
  {id:'moments',  name:'朋友圈',    icon:'', svg:I.friends, gradient:'', page:1},
  {id:'worldbook',name:'世界书',    icon:'', svg:I.globe,   gradient:'', page:1},
  {id:'fishing',  name:'钓鱼',      icon:'', svg:I.fishing, gradient:'', page:1},
  // 底部 nav 3 个 (复用 dock 字段当 nav)
  {id:'wechat',   name:'消息',      icon:'', svg:I.message, gradient:'', page:1, dock:true},
  {id:'settings', name:'设置',      icon:'', svg:I.setting, gradient:'', page:1, dock:true},
  {id:'desire',   name:'心情',      icon:'', svg:I.mood,    gradient:'', page:1, dock:true},
]

// 配色 palette (法式日杂 - light)
export const PALETTE_LIGHT = {
  bg:        '#F6F4F1',
  card:      'rgba(255,255,255,0.72)',
  text:      '#2A2520',
  sub:       '#9B9187',
  muted:     '#C4BBB2',
  accent:    '#C09B6E',
  accentSoft:'#E8D9C5',
  sage:      '#A3B1A0',
  rose:      '#C8A4A4',
  roseSoft:  '#F0E2E2',
  border:    'rgba(0,0,0,0.045)',
}

// iOS 暗色系统风 (从兔k 暗色 CSS 提的)
export const PALETTE_DARK = {
  bg:        '#000000',
  card:      'rgba(28,28,30,0.85)',
  text:      '#FFFFFF',
  sub:       '#8E8E93',
  muted:     '#38383A',
  accent:    '#0A84FF',
  accentSoft:'rgba(10,132,255,0.20)',
  sage:      '#5C9C7E',
  rose:      '#FF6B8A',
  roseSoft:  'rgba(255,107,138,0.15)',
  border:    'rgba(255,255,255,0.08)',
}

export function getPalette(){
  const m = localStorage.getItem('sully_mode')
  return m === 'dark' ? PALETTE_DARK : PALETTE_LIGHT
}

// 旧 export (兼容)
export const PALETTE = PALETTE_LIGHT
