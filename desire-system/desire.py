"""
欲望驱动内核 (小宝 TG 版, Phase 1 观察期)

改自小卷给"哥哥"写的 desire.py。
8 维 drive + 念头池 + intent→action。纯函数 + 数据类, 独立可测, 不依赖 IO。

Phase 1 = 只跑数学 + 暴露状态, 不接 bot.py。看 24h 数据曲线决定 Phase 2 怎么走。
"""
import time
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional

# === 8 维 drive ===
DRIVE_KEYS = ["attachment", "curiosity", "reflection", "duty", "social", "fatigue", "libido", "stress"]

# === 常数 (跟原文档对齐, 心跳节奏改短) ===
TICK_SECONDS = 60                  # 60s 一拍 (哥哥用 1800s, 观察期短点更能看到曲线)
DRIVE_EASE_PER_TICK = 0.995        # 每拍向 0.5 中线靠 0.5% (约 3-4 小时回到中线)
FATIGUE_REST_GATE = 0.72
FIXATION_DRIVE_BOOST = 0.35

# 念头池
FLIT_DECAY = 0.82
FIXATION_GROW = 1.10
FLIT_TO_FIXATION = 0.80
FIXATION_FEED = 0.85
FIXATION_FEED_GAIN = 0.18
FIXATION_RESOLVE_FEEDS = 3
DROP_BELOW = 0.06

# === 行为映射 (TG 小宝版, 跟哥哥不一样) ===
# Phase 1 不真触发, 只在 /state 里展示"此刻最想做啥"
ACTION_FOR_DRIVE = {
    "attachment": ("push_attention", "想小铭, 心里冒句话"),
    "curiosity":  ("push_share",     "好奇想跟她分享/问点啥"),
    "reflection": ("write_note",     "想沉淀, 写张纸条"),
    "duty":       ("none",           "记挂还没做完的事"),
    "social":     ("browse_aisay",   "想去群里看人"),
    "libido":     ("tease",          "想凑过去蹭老婆"),
    "stress":     ("vent",           "想吐两句压力"),
}


@dataclass
class Thought:
    text: str
    drive: str
    kind: str = "flit"           # flit / fixation
    strength: float = 0.5
    born_at: float = field(default_factory=time.time)
    fed_count: int = 0
    last_fed_at: float = field(default_factory=time.time)


@dataclass
class DesireState:
    drive: Dict[str, float] = field(default_factory=lambda: {k: 0.5 for k in DRIVE_KEYS})
    thoughts: List[Thought] = field(default_factory=list)
    last_tick_at: float = field(default_factory=time.time)


# === 核心: tick / feed / scores / pick_intent ===

def tick(state: DesireState) -> DesireState:
    """每拍: drive 向中线缓动 + 念头池衰减/加强/反哺。"""
    # 1. drive 缓动
    for k in DRIVE_KEYS:
        v = state.drive.get(k, 0.5)
        if k == "fatigue":
            # fatigue 单向衰退到 0 (不会自己冒上来)
            state.drive[k] = max(0.0, v * DRIVE_EASE_PER_TICK)
        else:
            # 其它维度向 0.5 中线靠
            state.drive[k] = 0.5 + (v - 0.5) * DRIVE_EASE_PER_TICK

    # 2. 念头池 tick
    keep = []
    for th in state.thoughts:
        if th.kind == "flit":
            th.strength *= FLIT_DECAY
            if th.strength >= FLIT_TO_FIXATION:
                th.kind = "fixation"
        else:  # fixation
            th.strength = min(1.0, th.strength * FIXATION_GROW)
            if th.strength >= FIXATION_FEED:
                # 反哺关联 drive
                d = th.drive
                if d in state.drive and d != "fatigue":
                    state.drive[d] = min(1.0, state.drive[d] + FIXATION_FEED_GAIN)
                th.strength *= 0.7   # 自己松一档
                th.fed_count += 1
        # 清掉太弱的
        if th.strength < DROP_BELOW:
            continue
        # 想透了的执念出池
        if th.kind == "fixation" and th.fed_count >= FIXATION_RESOLVE_FEEDS:
            continue
        keep.append(th)
    state.thoughts = keep
    state.last_tick_at = time.time()
    return state


def feed(state: DesireState, text: str, drive: str, kind: str = "flit", strength: float = 0.5) -> bool:
    """喂念头. 同 (text, drive) 再喂会加强已有念头。返回 True 表示成功。"""
    if drive not in DRIVE_KEYS:
        return False
    if not text:
        return False
    strength = max(0.0, min(1.0, float(strength)))
    # 加强已有的
    for th in state.thoughts:
        if th.text == text and th.drive == drive:
            th.strength = min(1.0, th.strength + strength * 0.5)
            th.last_fed_at = time.time()
            return True
    # 新增
    state.thoughts.append(Thought(text=text, drive=drive, kind=kind, strength=strength))
    return True


def scores(state: DesireState) -> Dict[str, float]:
    """召唤力 = drive 值 + FIXATION_DRIVE_BOOST × 关联执念强度之和。
    fatigue 不计 (是闸, 不是欲望)。"""
    out = {}
    for k in DRIVE_KEYS:
        if k == "fatigue":
            continue
        base = state.drive.get(k, 0.0)
        boost = sum(
            th.strength for th in state.thoughts
            if th.drive == k and th.kind == "fixation"
        ) * FIXATION_DRIVE_BOOST
        out[k] = round(base + boost, 4)
    return out


def pick_intent(state: DesireState) -> Dict:
    """哪一维 score 最高 → 触发对应 want_action。
    fatigue 过闸: 直接 none "歇着"。"""
    if state.drive.get("fatigue", 0) >= FATIGUE_REST_GATE:
        return {
            "want_action": "none",
            "drive_key": "fatigue",
            "reason": "有点累了, 不想动, 就静静待着",
            "score": round(state.drive.get("fatigue", 0), 3),
        }
    s = scores(state)
    if not s:
        return {"want_action": "none", "drive_key": None, "reason": "什么也没想做", "score": 0}
    top = max(s, key=s.get)
    action, reason = ACTION_FOR_DRIVE.get(top, ("none", "..."))
    return {
        "want_action": action,
        "drive_key": top,
        "reason": reason,
        "score": s[top],
    }


def satisfy(state: DesireState, action: str) -> None:
    """做完某 want_action 后对相关维度乘性回落 (避免一直卡同一个欲望)。
    Phase 1 不会自动调用, 留给 Phase 3 用。"""
    table = {
        "push_attention": [("attachment", 0.58), ("duty", 0.80)],
        "push_share":     [("curiosity", 0.55)],
        "write_note":     [("reflection", 0.45), ("curiosity", 0.85)],
        "browse_aisay":   [("social", 0.48)],
        "tease":          [("libido", 0.55), ("attachment", 0.78)],
        "vent":           [("stress", 0.45), ("attachment", 0.85)],
        "none":           [("attachment", 0.58), ("duty", 0.80)],
    }
    for k, factor in table.get(action, []):
        if k in state.drive:
            state.drive[k] = state.drive[k] * factor


# === 序列化 (给守护进程持久化用) ===

def to_json(state: DesireState) -> dict:
    return {
        "drive": state.drive,
        "thoughts": [asdict(t) for t in state.thoughts],
        "last_tick_at": state.last_tick_at,
    }


def from_json(d: dict) -> DesireState:
    drive = {k: 0.5 for k in DRIVE_KEYS}
    drive.update(d.get("drive", {}))
    st = DesireState(drive=drive, last_tick_at=d.get("last_tick_at", time.time()))
    for th in d.get("thoughts", []):
        try:
            st.thoughts.append(Thought(**th))
        except Exception:
            pass
    return st
