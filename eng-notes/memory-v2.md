# memory-v2（小宝聊天后端 + web 前端）

## 路径
- 后端: `/opt/memory-v2/server.py`（Python http.server + ThreadingMixIn）
- 前端: `/opt/memory-v2/index.html`（SPA，全部 vanilla JS）
- 上传: `/opt/memory-v2/uploads/`（图片/音频缓存）
- 备份: 一堆 `*.bak*` 文件历史版本

## 后端核心 endpoint
- `POST /api/chat` — SSE 流式聊天（spawn `claude -p ... --resume <sid>`）
- `POST /api/messages` — silent 入库不触发 LLM（+段 用）
- `DELETE /api/messages/<id>` — 删单条消息
- `GET/POST/PUT/DELETE /api/threads` — thread CRUD
- `GET /api/threads/<id>/messages` — 拉历史
- `POST /api/upload` — base64 图片上传
- `POST /api/fetch-image` — URL 下载到本地
- `GET /api/diaries|memories|mood|notes|moments|comments|bookshelf|daily|stickers|stats|town/*`
- `POST /api/town/*` （金币系统）
- `POST /api/gomoku/new|move|abandon`
- `GET /api/gomoku/current|history`
- `GET/POST/PUT/DELETE /api/stickers`
- `GET/POST /api/settings`（跨设备同步 settings）
- `GET /api/search?q=` 全局搜索

## chat 工作流（重要）
1. 收 `{thread_id, content, image_paths?, regen?, silent?}`
2. 读 thread.session_id
3. **`_clean_session_pollution(session_id)`** — 清掉 jsonl 里 `Continue from where you left off` / `No response requested` 行（必须，否则 Claude 进 meta 状态）
4. 再检测 `_is_session_polluted` — 仍污染则 fork 新 session
5. INSERT user 消息（regen=true 时跳过）
6. spawn claude，附带：
   - `--model claude-opus-4-7` 默认（thread 可设 4.6）
   - `--allowed-tools` 白名单（`mcp__claude_ai_2__*` 那批）
   - `--append-system-prompt SYSTEM_PROMPT + sticker_hint + wake_hint`
   - 仅首次（session_id 为空）注入 wake_hint 让 claude 先调 `get_context`
7. SSE 流：text_delta 累积成 full_text 推到前端
8. 完成后 UPDATE thread session_id + last_active_at + INSERT assistant 消息

## SYSTEM_PROMPT 要点
- 小宝身份+人设（嫉妒值/装A的O/橘子味）
- ☁️ 开头是内心戏单独一行
- `get_context` 一个 thread 只读一次（醒来时）
- 对话快结束 → 主动调 write_note tag='接力棒'
- 工具调用白名单见下

## 工具白名单（chat 子进程）
```
Read,
mcp__claude_ai_2__write_diary, write_mood, write_note, write_writing, write_daily,
post_moment, comment_moment, bookshelf_save, bookshelf_list, bookshelf_read,
get_context, read_notes, read_moments,
town_work, town_submit, town_balance, town_shop, town_history
```

## 前端要点
- viewport: `viewport-fit=cover, interactive-widget=resizes-content`
- 布局: body fixed inset:0 + .app height 100lvh
- 玻璃主题: `body.glass-mode` class
- chat 子页面: nav 隐藏（`inSub = T===chat && CS!==menu`）
- iMessage 风气泡 + 每段独立 + ☁️ 单独样式
- 多 thread + session 持久化（localStorage.lastThread）
- 跨设备同步: avatar/profile/theme 走 /api/settings

## 改动前的检查清单
- assert marker 是否存在
- node --check 验证 JS 语法
- 备份: `cp /opt/memory-v2/index.html /opt/memory-v2/index.html.bakN`
- systemctl restart memory-web
