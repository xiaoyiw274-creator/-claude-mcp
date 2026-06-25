# Sully 前端源码 (镜像)

来自 VPS `/root/web/sully/src/`, 镜像在这里供 Claude Design / GitHub 工具读取。

## 结构

- `App.tsx` / `main.tsx` — 入口
- `apps/` — 各 app (Springboard, Moments, Fishing, Settings, Chat, Mood, CoRead, Reader, Scripts, WorldBook, WeChat, ChatSettings, RpSession)
- `components/` — 共享 (Splash, StatusBar, Dock, AppShell, Bubbles, Placeholder, PlusActions, ThemeImport, TtsConfig, AppIcon, GeoWidget, Springboard)
- `lib/` — utils (api, theme, geo, decor, desire, ebook, regex, tts)
- `styles.css` / `skins.css` — 主题样式

## 主入口看哪个

主页 = `components/Springboard.tsx` (cream 治愈风, 大圆角白卡 + profile + 樱花飘落)
