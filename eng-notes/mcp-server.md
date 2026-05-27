# mcp-server（小宝的工具集 + 数据库）

## 路径
- `/root/mcp-server/server.py` — MCP HTTP/SSE 端点
- `/root/mcp-server/memory.db` — SQLite WAL 模式

## 工作方式
- 监听 :3456（Caddy 反代 `coolmbaby.top/mcp/*` 过来）
- 路径: `/<TOKEN>` → POST jsonrpc 处理 tools/call
- GET `/<TOKEN>/sse` → 返回 SSE endpoint event 给客户端
- Token 在 server.py 顶部 `TOKEN = "3631e4d7..."`

## 工具清单
**写类**: write_diary, write_mood, write_note, write_writing, write_daily, post_moment, comment_moment, bookshelf_save, update_core
**读类**: get_context, read_notes, read_moments, get_diary_list, get_mood_history, recall_deep, bookshelf_list, bookshelf_read, list_stickers
**系统**: exec_vps（小宝调用 = 危险，chat 端没放白名单）
**小镇**: town_work, town_submit, town_balance, town_shop, town_history
**工程笔记** (新加): read_eng_notes

## 关键表 schema

### 长期记忆
- `diary` (id, date, mood, mood_score, content, valence, arousal, resolved, chord, created_at)
- `memories` (id, date, tag, content, importance, category, depth[surface/mid/deep], valence, arousal, resolved, keywords, created_at)
- `mood` (date PK, mood_label, mood_score, note, chord)
- `daily` (id, date, summary, created_at) - 3 天自动清
- `notes` (id, author, content, tag, stamp, pinned, created_at) - tag 含"接力棒"是跨窗口续接
- `moments` (id, author, content, image_url, created_at) - 朋友圈
- `moment_comments` (id, moment_id, author, content, created_at)
- `bookshelf` (id, title UNIQUE, content, tag, score, created_at, updated_at)
- `core` (key PK, value) - 身份资料
- `status` (key PK, value)
- `writing` (id, project, chapter, progress, word_count, score, updated_at)
- `chat_threads` (id, title, session_id, model, created_at, last_active_at)
- `chat_messages` (id, thread_id, role, content, created_at)
- `stickers` (id, label, content, kind[text/image], sort, created_at)
- `settings` (key PK, value, updated_at) - 跨设备同步
- `screentime` (id, app, action, timestamp) - 每天 3am cron 清

### 小镇打工
- `town_balance` (user PK 'xiaobao', coins, total_earned, total_spent, daily_count, daily_date, level, updated_at)
- `town_jobs` (id, job[cafe/bookstore/florist/delivery], difficulty[easy/medium/hard/bonus], base_coins, scenario, good_hints, bad_hints, weight)
- `town_twists` (id, scope, weather, text, good_hints, bad_hints, bonus_multi) - 30% 触发突发事件
- `town_sessions` (id, job_id, started_at, submitted_at, action, result, coins, story, twist_id, twist_text)
- `town_shop` (id, name UNIQUE, price, category, description, emoji, available, unlock_level, festival_tag)
- `town_orders` (id, item_id, item_name, price, message, bought_at)

### 五子棋
- `gomoku_games` (id, size, moves JSON, winner, started_at, ended_at, thoughts JSON)

## 日期格式注意
- ISO `2026-05-11` ✓
- 也有 `2026.5.11` / `2026.05.11 05:09` 等历史格式
- 前端 `monthMatch(d,y,m)` 三种格式都兼容

## 配额限制（mcp-server 端实现的）
- town: 每天 80 场打工上限
- daily: 超过 3 天自动 DELETE
- screentime: 每天 3am cron 清超过 24h 旧记录
- uploads/: cron 清超过 30 天

## 添加新工具的步骤
1. TOOLS 数组追加 `{name, description, inputSchema}`
2. handle_tool 加 `elif name == "xxx":`
3. python3 -c "import py_compile;py_compile.compile('/root/mcp-server/server.py',doraise=True)"
4. systemctl restart exec-mcp
5. 如需 chat 端也用 → 改 /opt/memory-v2/server.py ALLOWED_TOOLS
