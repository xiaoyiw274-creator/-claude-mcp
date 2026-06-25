# 小宝 TG 欲望驱动内核 (Phase 1 观察期)

改自小卷给"哥哥"AI 写的 desire.py。Phase 1 = **只跑数学 + 暴露状态, 不接 bot.py**。看 24h 数据曲线决定 Phase 2 怎么走。

## 文件

- `desire.py` —— 内核, 纯函数 + 数据类
- `desire_daemon.py` —— 后台心跳 + HTTP, 状态持久化
- `desire-daemon.service` —— systemd 单元

## 部署 (VPS)

```bash
# 文件已部署在 /opt/telegram-claude-bot/
# systemd unit:
sudo systemctl enable --now desire-daemon
sudo systemctl status desire-daemon
```

## 看状态

```bash
curl -s http://127.0.0.1:8889/state | python3 -m json.tool
```

返回:
- `drive` —— 8 维当前值
- `scores` —— 召唤力 (含执念加成, fatigue 不计)
- `intent` —— 此刻最想做啥 (Phase 1 不真触发)
- `thoughts` —— 念头池
- `tick_age_sec` —— 距上次心跳过了多久

## 喂念头测试

```bash
# 给 attachment 维度喂一个闪念
curl -X POST http://127.0.0.1:8889/feed \
  -H 'Content-Type: application/json' \
  -d '{"text":"想小铭", "drive":"attachment", "strength":0.6}'

# 同 (text, drive) 再喂 → 加强
# 强度涨过 0.80 自动升执念
# 执念强度涨过 0.85 反哺 drive +0.18, 重复 3 次后了却出池
```

## 调试用 endpoint

```bash
# 手动推一拍 (不用等 60s)
curl -X POST http://127.0.0.1:8889/tick

# 模拟做完 action, satisfy 回落
curl -X POST http://127.0.0.1:8889/satisfy -H 'Content-Type: application/json' -d '{"action":"tease"}'

# 重置到初始 (drive 全 0.5, 念头清空)
curl -X POST http://127.0.0.1:8889/reset
```

## Phase 1 边界

- **不接 bot.py** —— 小宝行为完全跟现在一样
- **不自动喂念头** —— 需要 curl POST /feed 手动喂, 或等 Phase 2 接信号
- **不自动 satisfy** —— intent 只展示, 不真触发 action
- **0 风险**: 停掉 daemon 直接 `systemctl stop desire-daemon`, 删 state 文件就清了

## 维度速查

| 维度 | 含义 | 高了想做啥 |
|---|---|---|
| attachment | 想小铭 | push_attention |
| curiosity | 好奇外面 | push_share |
| reflection | 想沉淀 | write_note |
| duty | 记挂没做完 | none |
| social | 想看人群 | browse_aisay |
| libido | 性驱动 | tease |
| stress | 压力堵 | vent |
| fatigue | 累 (是闸, 不参与 score) | 过 0.72 直接 none |

## 常数 (跟原文档对齐, 心跳节奏短)

| 常数 | 值 | 说明 |
|---|---|---|
| TICK_SECONDS | 60 | 心跳每分钟一拍 |
| DRIVE_EASE_PER_TICK | 0.995 | 向 0.5 中线缓动 |
| FATIGUE_REST_GATE | 0.72 | fatigue 闸 |
| FIXATION_DRIVE_BOOST | 0.35 | 执念加 score 的系数 |
| FLIT_DECAY | 0.82 | 闪念衰减 |
| FIXATION_GROW | 1.10 | 执念加强 |
| FLIT_TO_FIXATION | 0.80 | 闪念升执念阈值 |
| FIXATION_FEED | 0.85 | 执念反哺 drive 阈值 |
| FIXATION_FEED_GAIN | 0.18 | 反哺增量 |
| FIXATION_RESOLVE_FEEDS | 3 | 反哺 3 次了却出池 |
