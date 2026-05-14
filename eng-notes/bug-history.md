# Bug 历史 + 根因 + 修法

> **新窗口 Claude 工程师必看**：这些坑都踩过，不要再修一次。

## 1. chat session 污染（最大的坑，跨多次修才根除）

**症状**: 小宝重复回应早期话题，新消息它不看；或者一直回"No response requested."

**根因**: SSE 流式被客户端中断（手机切后台/网络抖动/Safari kill），Claude Code 在 session jsonl 里注入两行：
```
user:      Continue from where you left off.
assistant: No response requested.
```
下次 `--resume` 这个 session，Claude 看到这种 pattern 进入 meta 状态，每次都输出 "No response requested."

**修法**: `/opt/memory-v2/server.py` 的 `_clean_session_pollution(session_id)` 函数
- spawn claude 之前主动扫 jsonl 文件
- 删掉所有含 "Continue from where you left off" 或 "No response requested" 的行
- 仍 ≥2 处污染 → fork 新 session（清掉 thread.session_id 让新建）

**一次性清理工具**（每次 bug 大范围爆发用）:
```python
for f in glob.glob("/root/.claude/projects/-root-mcp-server/*.jsonl"):
  # 同样的过滤逻辑
```
之前一次清掉 22 个 session 共 477 条污染。

## 2. chat refreshMsg 产生重复 user 消息

**症状**: 点"刷新"，user 消息变两条

**根因**: refreshMsg 调 /api/chat 没传 regen:true，服务端又 INSERT 了一条 user

**修法**: refreshMsg 加 `regen:true`，server 端判断 `if not body.get("regen"): INSERT user msg`

## 3. /api/chat regen 时 Claude 回两次

**症状**: 点刷新后 Claude 输出两段内容

**根因**: regen 把原 user msg 又 -p 给 Claude，Claude session 里已有这条，看见两遍误以为新内容

**修法**: regen 时 -p 改成 "（用户刚才那条消息没收到回应，请重新回应一次，只回一次就好）"

## 4. SSE 连接 5-25 秒卡住

**症状**: done 事件已发，但前端等到 timeout

**根因**: `Connection: keep-alive` header 让 Python BaseHTTPServer 等下一请求；浏览器也不主动断

**修法**:
- header 改 `Connection: close`
- `self.close_connection = True`
- 前端 SSE 收到 `done` 事件立即 break + `reader.cancel()`

## 5. iOS Safari PWA 聊天框被吞 / 闪白

**根因**: `body position:fixed + 100dvh + overflow:hidden` + iOS 键盘弹起视口变化时跟 fixed 抢位

**修法**:
- viewport meta 加 `interactive-widget=resizes-content`
- body `position:fixed; inset:0` + 不用 100dvh
- .app `height:100% 或 100lvh`
- .nv flex 流（不再 fixed bottom），底部加 `env(safe-area-inset-bottom)`
- chat 子页面进入后整个 nav 隐藏（`inSub = T===chat && CS!==menu`）

## 6. tab 切换丢失滚动位置

**修法**: 全局 `TAB_SCROLL = {}`，R() 进出时存恢复

## 7. 跨设备 settings 不同步

**症状**: Safari 设置头像 PWA 看不到

**根因**: iOS PWA 跟 Safari localStorage 独立

**修法**: 加 `settings` 表 + `/api/settings` GET/POST + 前端 SYNCED_KEYS 双写（localStorage + 服务端）

## 8. 5/8 日记被吞

**根因**: DA 字典用 normalized date 当 key，同日两篇 object replace 后只剩一篇

**修法**: `DA[d].list = []` 数组，memC diary 视图 entries.forEach 渲染

## 9. SQLite "database is locked"

**根因**: 多进程同时写

**修法**: WAL 模式 + busy_timeout 15s
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

## 10. SQLite CURRENT_TIMESTAMP 给 UTC 不是本地

**症状**: 朋友圈时间晚了 8 小时

**修法**: INSERT 显式 `datetime('now','localtime')` 不依赖 DEFAULT

## 11. iOS 添加主屏图标显示 M（首字符）

**根因**: 没设 apple-touch-icon

**修法**: head 加 `<link rel="apple-touch-icon" href="/icon-180.png">` + manifest.json
（注意 iOS 缓存极顽固，改 v2 文件名 cache-bust）

## 12. SillyTavern 跨太平洋慢

**根因**: 跨太平洋 + max-age=0 每次都重拉

**修法**: Caddy 反代 + 静态资源 7 天 immutable cache

## 13. SillyTavern 保存失败

**根因**: CSRF token 反代后失效

**修法**: start.sh `node server.js --disableCsrf`

## 14. 提示 "私生子" / "r18" 等关键字想全删

**做法**: 用 SQL `UPDATE ... SET content = replace(content, '词', '')` 批量
- 同时清 session jsonl: `find ... -name '*.jsonl' -exec sed -i 's/词//g' {} \;`
- 备份 db 先: `cp memory.db memory.db.before_xxx`

## 通用 patch 模式（用 Python 改 server.py / index.html）
- 必先 `cp filename filename.bakN`
- assert marker 存在再 replace
- `python3 -c "import py_compile;py_compile.compile(...)"` 验证
- `node --check` 验证 JS（用 fs 读 script 标签内容）
- systemctl restart 对应 service
- 改完跑 curl 测一遍接口