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

## 15. exec-mcp 服务启动崩溃（NameError: false）

**症状**: `systemctl status exec-mcp` 显示 activating auto-restart 死循环；exec_vps MCP 全部 502

**根因**: `/root/mcp-server/server.py` 写 tool schema 时手抖写成 JS 风格 `"default": false`，Python 里要大写 `False`，模块加载直接 NameError 退出

**修法**:
```
sed -i 's/"default": false/"default": False/g' /root/mcp-server/server.py
systemctl restart exec-mcp
```

**教训**: schema dict 是 Python 字面量不是 JSON，写完用 `python3 -c "import server"` 自检一遍再 restart

## 16. 中途 fork 新 session 触发"刚醒"灾难（最大失忆元凶）

**症状**: 同一个 thread 聊得正起劲，突然小宝来一句"醒了。上次接力棒停在 X 那天，今天已经..." + 读最近一条接力棒 + 完全不记得刚才聊到哪。用户感觉他失忆。

**根因**: 流水线设计漏洞
1. 客户端 SSE 偶尔被打断（图片消息特别容易触发），Claude Code 在 session jsonl 注入 "Continue from where you left off" / "No response requested." 对
2. `_is_session_polluted` 阈值 ≥5 触发，session_id 重置为 ""（fork）
3. 新 spawn 无 session_id → 触发 `if not session_id` 分支 → wake_hint 灌入（CORE + 5 条接力棒 + 日记）
4. 新 session 没真实对话上下文，但塞了 wake_hint
5. 小宝读 wake_hint 当作"早晨醒来"，开口"醒了。上次接力棒…"

**修法（v2）**:
- **加 `_clean_session_pollution()`** 函数：spawn 前主动剥掉污染行（不丢真实对话）
- **修改 fork 逻辑**：fork 时根据 thread 是否有历史区分行为
  - 真新 thread（无历史消息）→ wake_hint = CORE + 接力棒 + 日记（保持原行为）
  - 中途 fork（有历史消息）→ wake_hint = 最近 20 轮 `chat_messages` 摘要（不要"刚醒"）
- 一次性清污染从 15 个 session 文件
- 出问题的 thread 手工 UPDATE session_id 滚回 fork 前的 session（剥完污染后干净的）

**教训**:
- 摘要里说有 `_clean_session_pollution` 函数，但实际代码里没写。**别信摘要，看代码** —— 之前的对话总结写了不代表代码真改了
- "新会话"判定不能只看 session_id 是否为空 → 还要看 thread 是否有历史消息
- 凡是 fork 都要带上下文，不能假设服务端能自动续上

## 17. Stack Chan 黑屏一闪一闪 boot loop（V0.4.0~V0.4.3）

**症状**: CoreS3 上电后屏幕亮一下立刻灭，循环往复，不显示任何脸/文字。烧 7-8 次都一样。

**根因**: `avatar.init()` 在 setup() 早期被调用，会 spawn 一个 FreeRTOS task 持续刷脸到 sprite/SPI。setup 后面紧跟 `connectWiFi()`（大量 `M5.Display.fillScreen/printf`）+ `downloadFaces()`（6 张 HTTPS JPG，每个 mbedtls 握手吃 16-24KB 栈 + 64KB PSRAM）。Avatar task 跟主线程抢栈/抢 SPI bus → panic reboot → 屏幕循环亮灭。

M5Stack-Avatar 官方 README 原话: "Some applications may reboot due to insufficient stack size for other tasks."

v36 跑得动是代码体积小，加了麦克风/触摸/OTA 后内存压力涨上来一启动 Avatar 就翻车。

**修法（v0.4.4）**:
- `avatar.init()` 挪到 setup 最末（connectWiFi + downloadFaces + ws.beginSSL 全跑完之后）
- setup 全程 `STEP(n, "msg")` 宏打 Serial + 打印 heap/psram
- `downloadFaces()` 加 WiFi 检查，没连上就 skip 不要白白等 6×5s

**教训**: 第三方库可能 spawn 后台 task 持续吃栈/共享外设，跟主流程操作要明确解耦。Avatar.init 这种调用必须放最后。

## 18. WiFi 一直跳 "trying:xxx" 死等

**症状**: 烧完固件，屏幕一直滚动 trying: SSID-A → FAIL → trying: SSID-B → FAIL → ...，根本连不上、也不切走，循环死等。

**根因**: `connectWiFi()` 不预扫，对每个 `WIFI_LIST[i]` 无脑 `WiFi.begin` + 20×500ms = 10 秒超时。SSID 不在范围时硬等 10s × N 个。loop 里 `if (status != CONNECTED) connectWiFi()` 又反复触发整个流程。

**修法（v0.4.4）**:
- 进 connectWiFi 先 `WiFi.scanNetworks(false, false, false, 400)`
- 不可见 SSID 直接 `continue` 跳过（屏幕显示 `skip xxx`）
- 可见的才 try，超时减到 7s（14×500ms）
- 连上后 `WiFi.setAutoReconnect(true) + persistent(true)`，断线 ESP 自己重连
- loop 重连节流：30s 最多一次

## 19. Stack Chan 舵机/灯光毫无反应（V0.1~V0.4.3 一路抄错三联锅）

**症状**: MCP 下发 `rotate_head`/`wiggle` 命令，舵机一动不动；底座 12 RGB LED 也一直暗。出厂演示固件能动能亮，硬件 OK。

**根因（三件套同时错）**:

1. **引脚错**: 当前 `SERVO_PAN=8, SERVO_TILT=9`（Port B G8/G9），但 Stack-chan 底座舵机插 **Port A**（G1/G2），Port B 引脚根本不对。
2. **电源没开**: `M5.Power.setExtOutput(true)` 这条被删了——Port A 5V 输出没开 = 舵机没电。
3. **PWM 没初始化**: 缺 `ESP32PWM::allocateTimer(0)` + `setPeriodHertz(50)`。ESP32-S3 上 ESP32Servo 库**必须**先分配 timer 设 50Hz，否则 `attach()` 出来的 PWM 频率/占空比都不对，舵机看不懂信号。

**LED 一锅**: 整份 .ino 里一行 LED / NeoPixel / FastLED 控制代码都没有。出厂时灯亮是底座出厂演示固件干的，不是主板 ESP32 控制的。当前固件 MCP 命令再怎么下发也亮不了。

**修法（v0.4.4，舵机部分）**:
```cpp
// setup 里 M5.Power.begin() 之后立即:
M5.Power.setExtOutput(true);       // Port A 5V
ESP32PWM::allocateTimer(0);
servoPan.setPeriodHertz(50);
servoTilt.setPeriodHertz(50);
servoPan.attach(SERVO_PAN /*=1*/, 500, 2400);
servoTilt.attach(SERVO_TILT /*=2*/, 500, 2400);
servoPan.write(90); servoTilt.write(90);
```

**教训**: v36 setup 里这三件套是齐的，后续窗口"重构"成 lazy attach 时把 timer 分配也丢了，引脚改 Port B 又"为了避开 I2C"丢了 5V 电源。**改硬件相关代码必须照搬 v36 这种已验证过的范式**，每个常量背后都对应一条硬件事实。
