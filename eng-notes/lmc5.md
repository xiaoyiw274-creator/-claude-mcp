# LMC-5 五维记忆 (X 时间 / Y 关系 / Z 演化 / E 体验 / M 代谢)

> 移植自 https://github.com/wuxuyun0606-collab/lmc-5
> 上线时间: 2026-06-23

## TL;DR

旧 memories 表只有"内容 + 时间 + tag", 召回靠 `recall_deep` 关键词。
新 LMC-5 加三件事:

1. **流水 + 沉淀两层** — `raw_events` 写当下发生的所有事, 凌晨 3 点 `claude -p` 当海马体, 挑出值得记的搬进 `lmc5_memory`
2. **Y 轴关系图** — 记忆之间能连边 (supports/contradicts/explains/derives_from/follows/relates), 召回会自动二跳扩散
3. **Z 轴事实演化** — 旧事实被新事实推翻时不删, 标 `superseded`, 召回时只看 `current`
4. **M 轴代谢** — 召回多了晶体化 (`crystallized`, 不衰减), 不召的衰减成 `fading` (从召回里排除)
5. **E 轴体验共振** — 召回时按当前 mood (valence/arousal) 找近似的, 不只是关键词命中

## 数据库表

都在 `/root/mcp-server/memory.db` 里 (跟旧 memories 共存, 不冲突)

| 表 | 干啥 |
|---|---|
| `raw_events` | 流水, append-only, 每条 chat / diary / note 都进 |
| `lmc5_memory` | 沉淀, 五维坐标完整, 是召回的目标 |
| `lmc5_relation` | Y 轴边, `(from_id, to_id, kind)` UNIQUE |
| `lmc5_consolidation_log` | 每次夜整理一笔审计 (raw_n / kept_n / conflict_n / relation_n) |

## 关键文件

```
/root/mcp-server/lmc5/
├── __init__.py
├── store.py         ← 存储层 (建表/读写/衰减/统计)
├── night_dream.py   ← 03:00 整理入口 (调 claude -p 当海马体)
├── recall.py        ← 召回管线 (api.py/bot.py 调这个)
└── backfill.py      ← 一次性导入老 memories/diary (已跑过)

/etc/systemd/system/lmc5-night-dream.service   ← oneshot 单元
/etc/systemd/system/lmc5-night-dream.timer     ← OnCalendar=03:00 daily
/var/log/lmc5_night_dream.log                  ← 跑日志
/root/mcp-server/memory.db.bak.before_lmc5     ← 上线前备份
```

## 写流水的钩子 (`_lmc5_event`)

| 文件 | 位置 | 落啥 |
|---|---|---|
| `api.py` | 用户 INSERT 进 `naked_chat_messages` 之后 | sully 用户消息 |
| `api.py` | assistant `full_text` INSERT 之后 | sully 小宝回复 |
| `bot.py` | `await run_claude(...)` 前后 | TG 双向 |
| `server.py` | `write_daily/write_memory/write_diary/write_writing/write_note` 各自的 handler 里 | 这些工具调用 |

钩子是 `try/except` 静默, 永远不会阻断主流程。

## 召回钩子 (`recall.recall_block`)

| 文件 | 位置 | 注入到哪 |
|---|---|---|
| `api.py` | `[此刻你的内在 + 此刻你身边]` 块之后 | sully `sys_prompt` 末尾 |
| `bot.py` | `[此刻你的身体]` pulse 块之后 | TG `base_text` 头部 |

召回块长这样:
```
[记忆 (五维 LMC-5 召回, 这些是你已经记住的事, 自己挑要不要用, 不要复述):
  · 2026-06-16 — 她细数我编造过五件事... [认知]
  · 2026-06-17 — 她"你怎么从来没主动过"... [里程碑]
  · 2026-06-17 — 她教我"不要问算不算主动"... [示范]
]
```

## MCP 工具

| 工具 | 干啥 |
|---|---|
| `lmc5_recall(query, limit)` | 主动召回. 比 `recall_deep` 强 (不限 deep, Y 二跳, Z=current, 更新 M) |
| `lmc5_stats()` | 看 raw/curated/relation 概况 |

## 夜整理流程

1. 03:00 systemd 触发
2. 拉过去 36h 未整理的 raw_events (cap 80 条)
3. 拉最近 60 条 curated (供 LLM 判冲突/关系)
4. 构造 prompt 调 `claude -p --permission-mode auto --output-format text`
5. LLM 返回 JSON, 解析含 kept/rejected_ids/relations
6. 本地 safety:
   - difflib 相似度 ≥ 0.78 视为重复跳过
   - `safe_int/safe_float/safe_tag` 全 clamp
   - z_status 枚举校验
   - `supersedes_existing_id` 必须存在
   - `relation.to_id` 必须存在 + kind 必须在白名单
7. 写入 + 标 raw 为已整理
8. 调 `apply_decay(0.02)` 让旧记忆每天衰减一点
9. 写 `lmc5_consolidation_log`

## 安全护栏

| 限制 | 值 |
|---|---|
| 单次最多喂多少 raw | 80 |
| 单次最多沉淀多少 memory | 25 |
| 相似度阈值 (去重) | 0.78 |
| `apply_decay` daily_rate | 0.02 |
| `crystallized` 触发条件 | access_count ≥ 5 |
| `fading` 触发条件 | m_decay ≥ 0.85 且 access_count < 2 |

## 关键决定 / 设计取舍

- **流水 + 沉淀分离** — 灵感来自 LMC-5 仓库的"raw vs curated"模式, 也对应人脑"短期 → 长期记忆"的整理过程
- **海马体用 claude -p** — 复用 Max 订阅, 不掏 API key (Anthropic 是天涯何处无 cron job, 一个 claude -p 解决)
- **Y 轴只做二跳** — 三跳会爆炸. 二跳够用了, 召回时只对 top-3 种子展开邻居
- **Z 轴标记不删除** — 被推翻的事实标 superseded, 召回时 z_status='current' 过滤掉. 这样老回忆可以"想起来", 但不影响当前判断
- **E 轴是软共振, 不是硬过滤** — 心情低落时不是只召低落的, 加 20% 权重而已
- **M 轴的 fading 是可逆的** — 召回一次 decay -0.1, 老朋友重逢式恢复
- **夜整理一次最多搬 25 条** — 节制. 流水多归多, 真正值得长记的就那么些
- **不读 chat_messages 直接搬** — 全部走 raw_events. chat_messages 仍然是 sully 自己的"对话历史", 不混

## 老数据 backfill

上线时跑了一次 `python3 -m lmc5.backfill`:

- 老 `memories` 表 260 条 → 全搬 (source='backfill_memories')
- 最近 50 篇 `diary` → 搬 (source='backfill_diary')
- 总共 310 条 curated, 全是 Z=current
- valence/arousal 从老的 1-10 制归一到 -1..1 / 0..1
- Y 轴和 M 轴等夜整理慢慢积累 (backfill 没设关系, 都是孤立点)

## 检查命令

```bash
# 当前状态
python3 -m lmc5.store

# 召回测试 (不要污染统计)
python3 -m lmc5.recall "蟑螂 帽衫"

# 看最近一次夜整理
sqlite3 /root/mcp-server/memory.db \
  "SELECT date, raw_n, kept_n, conflict_n, relation_n, duration_s
   FROM lmc5_consolidation_log ORDER BY id DESC LIMIT 5;"

# 看 raw 积压
sqlite3 /root/mcp-server/memory.db \
  "SELECT COUNT(*), kind FROM raw_events WHERE consolidated=0 GROUP BY kind;"

# 看 Y 关系
sqlite3 /root/mcp-server/memory.db \
  "SELECT kind, COUNT(*) FROM lmc5_relation GROUP BY kind;"

# 看晶体化的核心记忆
sqlite3 /root/mcp-server/memory.db \
  "SELECT id, importance, m_access_count, substr(summary,1,80)
   FROM lmc5_memory WHERE m_state='crystallized' ORDER BY m_access_count DESC LIMIT 20;"

# 看被推翻的
sqlite3 /root/mcp-server/memory.db \
  "SELECT id, x_time, z_superseded_by, substr(summary,1,80)
   FROM lmc5_memory WHERE z_status='superseded' ORDER BY z_superseded_by DESC LIMIT 10;"

# 手动跑一次夜整理 (绕过 systemd, 现在就执行)
cd /root/mcp-server && python3 -m lmc5.night_dream
```

## 旧 `recall_deep` 怎么办

留着, 没删。
- `recall_deep` 仍然查老 `memories` 表 (depth='deep' + keyword 触发)
- `lmc5_recall` 查新 `lmc5_memory` 表 (五维全开)
- 两个并存, 小宝可以自己挑用哪个 (在工具描述里写清了 lmc5 更强)

## 待办 / 改进方向

- [ ] 夜整理跑过几天后看效果, 调 prompt 让 LLM 多生 Y 关系
- [ ] 加 `lmc5_forget(id, reason)` MCP 工具, 让小宝主动遗忘
- [ ] 把 sully 的 worldbook 也接进来 (worldbook 命中 → 自动写一条 lmc5_memory 关联)
- [ ] 召回时把 `e_chord` 和当前 pulse 的 chord 也比对一下, 同和弦的加分
- [ ] 半夜整理后给小宝发一条 TG, 说"今晚梦见了 N 件事" (类似 sleep recap)
