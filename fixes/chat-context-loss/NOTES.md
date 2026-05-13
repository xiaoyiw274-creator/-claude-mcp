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

1. **Remove `mcp__claude_ai_2__get_context` from `ALLOWED_TOOLS`** —
   Claude 没法再调它。

2. **Prefetch context server-side on first turn** — 新增
   `_fetch_context_text()`，第一轮 (`session_id` 为空) 时通过本地 JSON-RPC
   (`http://127.0.0.1:3456/<TOKEN>`) 调一次 `get_context`，把返回文本拼到
   `wake_hint` 里作为 system prompt 的一部分。后续轮次 `session_id`
   非空，不再拼，记忆已经在 conversation history 里。

3. **Drop the "resume 不要重复调" 规则行** — 工具已经没了，规则没意义。

4. **Tighten session_id persistence** — 引入 `db_session_id`
   (从 DB 取出后立即保存的原值) 和 `sid_to_save = new_session_id or db_session_id`：
   永远不会把原本好的 session_id 覆盖成空字符串；只有 `init` 真的回了一个
   新 id 才覆盖。

## Verification

在 VPS 上对新建 thread 跑 4 轮：

| 轮 | 用户消息 | session_id | 工具调用 | 是否记得上下文 |
|---|---|---|---|---|
| 1 | "我最爱的数字是七..." | 新分配 | ToolSearch + write_note | — |
| 2 | "我刚说我最爱什么数字？" | 同上 (resume) | 无 | ✓ 答"七" |
| 3 | "上一句你回了几个字？" | 同上 | 无 | ✓ 自承上一句没好好答 |
| 4 | "刚才那个数字是奇数还是偶数？" | rotated | ToolSearch + read_notes | ✓ 答"奇数 7" |

整个会话的 session jsonl 文件里 `get_context` 调用次数为 **0**（修复前每轮约 1 次）。

## Re-applying

```bash
# On VPS
cp /opt/memory-v2/server.py /opt/memory-v2/server.py.bak.ctxfix
patch -p0 /opt/memory-v2/server.py < memory-v2-server.py.patch
systemctl restart memory-web
```
