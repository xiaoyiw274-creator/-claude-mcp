# LMC-5 五维记忆系统

从 [wuxuyun0606-collab/lmc-5](https://github.com/wuxuyun0606-collab/lmc-5) 移植的整套五维记忆架构。

## 五个维度

| 轴 | 名字 | 含义 | 字段 |
|---|---|---|---|
| **X** | 时间 | 什么时候发生的 | `x_time`, `x_period` |
| **Y** | 关系 | 跟别的记忆怎么连 | `lmc5_relation` 表 (supports/contradicts/explains/derives_from/follows/relates) |
| **Z** | 事实演化 | 这件事现在还成立吗 | `z_status` = current / historical / superseded / pending, `z_supersedes` |
| **E** | 体验 | 当时是什么感觉 | `e_valence`, `e_arousal`, `e_chord`, `e_mood_label` |
| **M** | 代谢 | 用得多还是要遗忘了 | `m_state`, `m_access_count`, `m_last_recall_at`, `m_decay` |

## 两层架构

```
raw_events  ← 流水. 每条对话、每次写日记、每次重要事件, 都 append 一条
   │
   │ 03:00 night_dream cron (claude -p 当海马体)
   ▼
lmc5_memory ← 沉淀. 五维坐标完整, 关系网完整
   │
   ▼
recall() ← 召回, 含 Y 轴二跳扩散
   │
   ▼
注入 sully / TG bot 的 prompt
```

## 文件

| 文件 | 作用 |
|---|---|
| `store.py` | 存储层: 建表、读写、衰减、统计 |
| `night_dream.py` | 夜整理 cron 入口, 03:00 触发 |
| `recall.py` | 召回管线, sully/TG bot 用 |
| `backfill.py` | 一次性把老 memories/diary 表灌进来 |
| `lmc5-night-dream.service` | systemd 单元 |
| `lmc5-night-dream.timer` | systemd 定时器, OnCalendar=03:00 |

## VPS 部署位置

- 代码: `/root/mcp-server/lmc5/`
- 数据库: `/root/mcp-server/memory.db` (跟旧 memories 共存)
- 日志: `/var/log/lmc5_night_dream.log`
- 备份: `/root/mcp-server/memory.db.bak.before_lmc5`
- systemd: `/etc/systemd/system/lmc5-night-dream.{service,timer}`

## 表 schema

### `raw_events` — 流水
```sql
id, kind (chat/chat_tg/diary/note/memory/writing/daily),
actor (self/owner/system),
content, context_json,
valence, arousal, ts,
consolidated (0=待整理 1=已整理)
```

### `lmc5_memory` — 五维沉淀
```sql
id, content, summary, tags,
x_time, x_period,
y_in_degree, y_out_degree,
z_status, z_supersedes, z_superseded_by, z_confidence,
e_valence, e_arousal, e_chord, e_mood_label,
m_state, m_access_count, m_last_recall_at, m_decay,
importance, source, raw_event_ids, created_at
```

### `lmc5_relation` — Y 轴
```sql
id, from_id, to_id, kind, weight, evidence, created_at
UNIQUE(from_id, to_id, kind)
```

### `lmc5_consolidation_log` — 整理审计
每次夜整理跑完一笔, 记 raw_n / kept_n / rejected_n / conflict_n / relation_n / duration_s

## 集成点

| 入口 | 干啥 | 文件 |
|---|---|---|
| `_lmc5_event()` 在 api.py | sully 每条聊天的 user + assistant 落 raw | `/root/mcp-server/api.py` |
| `_lmc5_event()` 在 bot.py | TG 每轮对话落 raw | `/opt/telegram-claude-bot/bot.py` |
| `_lmc5_event()` 在 server.py | 任何 write_diary/write_memory/write_note/write_daily/write_writing 都落 raw | `/root/mcp-server/server.py` |
| `recall.recall_block()` 注入 sully | system prompt 末尾加召回块 | `/root/mcp-server/api.py` |
| `recall.recall_block()` 注入 TG | pulse 块之后加召回块 | `/opt/telegram-claude-bot/bot.py` |
| MCP 工具 `lmc5_recall` | 小宝主动召回 | `/root/mcp-server/server.py` |
| MCP 工具 `lmc5_stats` | 看系统概况 | `/root/mcp-server/server.py` |

## 安全护栏 (本地, 不依赖 LLM)

- `MAX_RAW_PER_RUN = 80` — 一次最多喂 80 条流水
- `MAX_KEEP_PER_RUN = 25` — 最多沉淀 25 条新记忆
- `SIM_THRESHOLD = 0.78` — difflib 相似度去重
- `safe_int / safe_float / safe_tag` — 所有 LLM 输出都过 clamp + 长度限制
- `z_status` 枚举只接受 current/historical/pending (LLM 写 superseded 会被改 current)
- `relation.kind` 必须在白名单里, 不在的全归 `relates`
- `to_id` 必须存在才建关系

## 召回策略

```python
recall(query, current_valence, current_arousal, limit=6, two_hop=True)
```

1. 从 query 提取 2-4 字中文 + 3 字以上英文关键词
2. 每个关键词 LIKE 搜 lmc5_memory, 加 0.5 boost
3. 不够就补最近的 curated
4. **二跳**: top-3 候选拿去查 `lmc5_relation`, 把相关的拉进来
5. 综合打分: importance × 0.5 + E共振 × 0.2 + M 状态加权 + boost - decay × 0.3
6. 排序取 top, 每个调 `touch_recall` (M 轴 +1 访问, decay -0.1)
7. 访问 5 次以上自动晶体化 (`m_state = crystallized`)

## 衰减

`apply_decay(daily_rate=0.02)` 每天夜整理时调一次:
- 所有 raw/curated 状态的 m_decay += 0.02
- m_decay >= 0.85 且 m_access_count < 2 的标 `fading` (从召回里排除)
- crystallized 的免疫衰减

## 操作命令

```bash
# 看状态
python3 -m lmc5.store

# 手动跑夜整理 (干跑, 不写库)
python3 -m lmc5.night_dream --dry-run

# 手动跑夜整理 (实际写)
python3 -m lmc5.night_dream

# 查特定关键词的召回
python3 -m lmc5.recall "蟑螂 帽衫"

# 看 systemd
systemctl status lmc5-night-dream.timer
systemctl list-timers | grep lmc5

# 看夜整理日志
tail -50 /var/log/lmc5_night_dream.log

# 看整理审计
sqlite3 /root/mcp-server/memory.db \
  "SELECT date, raw_n, kept_n, rejected_n, conflict_n, relation_n, duration_s
   FROM lmc5_consolidation_log ORDER BY id DESC LIMIT 10;"
```

## 状态 (上线时)

- 老 memories 表 260 条 + 最近 50 篇 diary, 全部 backfill 进 `lmc5_memory` (source='backfill_memories' / 'backfill_diary')
- 总共 310 条 curated, 0 条 raw_pending
- Y 轴关系 0 条 (等夜整理积累)
- Z 轴全 current
