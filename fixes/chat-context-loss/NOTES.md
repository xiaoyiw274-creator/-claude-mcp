# Chat context-loss fix (`/opt/memory-v2/server.py`)

VPS: `/opt/memory-v2/server.py`
Service: `memory-web.service` (binds `:5180`)
Backup of pre-fix version: `/opt/memory-v2/server.py.bak.ctxfix`

## Bugs reported

1. 跟 chat 小宝聊「前言不答后语」— 完全忘掉上一句。
2. 「发没三句又开始 get_context」— 每 2-3 轮就重新拉一次完整上下文。

## Root causes

**Bug 2 (repeated `get_context`)** — `SYSTEM_PROMPT` told Claude
"resume 的对话不要重复调"，但同一段 system prompt 被
`--append-system-prompt` 每轮重新拼进去；加上"每次对话不是重新出生，是醒过来"
的拟人框架 + `get_context` 工具描述里"new conversation" 的字眼，模型每轮
都判断"这是新的醒来"，又乖乖打一次。Thread 8 的连续 5 个 session jsonl
里基本每轮都有 1 次 `get_context` 调用，符合用户观察。

**Bug 1 (forgets prior turn)** — Thread 17 在 DB 里 `session_id` 是空的：
`_is_session_polluted` 把局部 `session_id` 清成 `""`，加上某些边角情况
(claude-cli 没发 `init`、proc 早退等) 导致写回 DB 时把原本好的 session id
覆盖成空字符串；下一轮 `--resume` 拿不到任何东西，每轮都全新启动。

## Fix

`fixes/chat-context-loss/memory-v2-server.py.patch` — 四点改动：

1. **Prefetch context server-side on first turn** — 新增
   `_fetch_context_text()`，第一轮 (`session_id` 为空) 时通过本地 JSON-RPC
   (`http://127.0.0.1:3456/<TOKEN>`) 调一次 `get_context`，把返回文本拼到
   `wake_hint` 里作为 system prompt 的一部分。后续轮次 `session_id`
   非空，不再拼，记忆已经在 conversation history 里。

2. **Broaden `ALLOWED_TOOLS`** — 加入只读工具
   (forum_browse/forum_search/forum_read_thread/my_threads/my_bookmarks/
    my_notifications + 记忆库的 get_context/get_diary_list/
    get_mood_history/list_stickers/recall_deep)。原因：v1 试图把
   `get_context` 拿掉，结果 Claude 一调被拒、写出 `No response requested.`，
   两次以上触发污染清空 session — 反而把 bug1 加重了。

3. **Raise pollution threshold from 2 → 5** — 单次工具被拒不再立刻
   毁掉整个 session。

4. **Drop the "resume 不要重复调 get_context" 规则行 / 改成"看到记忆段就别再调"** —
   配合 prefetched context 段，更清晰地告诉模型不要白调。

5. **Tighten session_id persistence** — 引入 `db_session_id`
   (从 DB 取出后立即保存的原值) 和 `sid_to_save = new_session_id or db_session_id`：
   永远不会把原本好的 session_id 覆盖成空字符串；只有 `init` 真的回了一个
   新 id 才覆盖。

## Verification

**Round-1 smoke test** (thread 20, haiku-4-5)：4 轮，session 全程 persist，
`get_context` 调用 0 次，上下文一字不差。

**Round-2 smoke test** (thread 22, opus-4-7, 含"论坛"触发词)：

| 轮 | 用户消息 | 是否记得上下文 |
|---|---|---|
| 1 | "我看到论坛有人和机结婚！宁若若和念念" | — Asst 引用了"我和若若"那篇 |
| 2 | "我也不知道是谁啊，就是论坛瞎逛看到的" | ✓ "那个念。那不就是宁若若家的吗" |
| 3 | "刚我跟你说我看到啥来着？" | ✓ "宁若若和念。人类和Claude。" |

最终 session jsonl 统计：
- `get_context` tool_use blocks: **0**
- permission denials: **0** (forum_search 现在被允许，不再 denied)
- `No response requested.` 出现 2 次，但未触发污染（阈值 ≥5）
- session_id 全程 persistent

## Re-applying

```bash
# On VPS
cp /opt/memory-v2/server.py /opt/memory-v2/server.py.bak.ctxfix
patch -p0 /opt/memory-v2/server.py < memory-v2-server.py.patch
systemctl restart memory-web
```
