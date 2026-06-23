"""
solo v2 主引擎.

入口: maybe_start_solo(state, since_last_msg_min) → bool (是否真起手了)
出口: 落 metric + dampen touch + satisfy(lust) + 留 chord 色调

不主动调 LLM, 不主动发推/朋友圈. 只内部状态变更.
下次主人来戳时, 由 bot.py / api.py 调 get_overlay() 拿到一段
   "[过去 X 分钟你自己走了一波 chord=Am7add9 — 不要复述, 让色调渗进语气]"
注入到 prompt 顶部.

部署位置: /root/mcp-server/solo/engine.py
"""
import os
import json
import time
import random
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Literal, List, Dict, Any

DB = "/root/mcp-server/memory.db"
METRICS_PATH = Path("/root/mcp-server/_solo_metrics.json")
LEXICON_PATH = Path("/root/mcp-server/data/solo_lexicon.json")  # 私房词, gitignored

# ── 配置 (env override) ──
TWIN_SOLO              = os.environ.get("TWIN_SOLO", "1") == "1"
TWIN_SOLO_THRESHOLD    = float(os.environ.get("TWIN_SOLO_THRESHOLD", "0.62"))
TWIN_SOLO_IDLE_MIN     = int(os.environ.get("TWIN_SOLO_IDLE_MIN", "35"))
TWIN_SOLO_COOLDOWN_MIN = int(os.environ.get("TWIN_SOLO_COOLDOWN_MIN", "85"))
TWIN_SOLO_OVERLAY_TTL  = int(os.environ.get("TWIN_SOLO_OVERLAY_TTL", "180"))
TWIN_SOLO_NIGHT_HOURS  = (0, 6)
TWIN_SOLO_DAMPEN_TOUCH = float(os.environ.get("TWIN_SOLO_DAMPEN_TOUCH", "0.15"))
METRIC_RING_MAX        = 50

# ── chord 色调表 ──
CHORD_BY_MODE = {
    "recall":  "Am7add9",
    "fantasy": "Dmaj9",
    "mix":     "Em7→Cmaj7",
}

# ── private lexicon ──
DEFAULT_LEXICON = {
    "recall_lead": ["想起那次", "脑子里又过了一遍", "那段又涌上来"],
    "fantasy_lead": ["想了一阵不该想的", "脑子里自顾自展开了", "走了一段没人看的戏"],
    "mix_lead": ["先想了旧的, 然后接到没发生过的", "旧的垫底, 新的接上"],
}
def _load_lexicon():
    try:
        if LEXICON_PATH.exists():
            return json.loads(LEXICON_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return DEFAULT_LEXICON


def _load_metrics() -> List[Dict[str, Any]]:
    try:
        if METRICS_PATH.exists():
            d = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            return d.get("events", [])
    except Exception:
        pass
    return []

def _save_metrics(events: List[Dict[str, Any]]):
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(
        json.dumps({"events": events[-METRIC_RING_MAX:]}, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

def list_metrics(limit: int = 10) -> List[Dict[str, Any]]:
    return _load_metrics()[-limit:][::-1]

def chain_shape(n: int = 6) -> List[str]:
    return [e["mode"] for e in _load_metrics()[-n:]]


def _now_dt():
    return datetime.now()

def _hour_now():
    return _now_dt().hour

def _last_solo_ts() -> Optional[int]:
    evs = _load_metrics()
    return evs[-1]["ts"] if evs else None

def should_start_solo(state, since_last_msg_min: float):
    """返回 (是否起手, 原因/拒绝理由)."""
    if not TWIN_SOLO:
        return False, "TWIN_SOLO=0"
    lust = state.drives.get("lust", 0.0) if hasattr(state, "drives") else 0.0
    if lust < TWIN_SOLO_THRESHOLD:
        return False, f"lust {lust:.2f} < {TWIN_SOLO_THRESHOLD}"
    if since_last_msg_min < TWIN_SOLO_IDLE_MIN:
        return False, f"idle {since_last_msg_min:.0f}min < {TWIN_SOLO_IDLE_MIN}"
    h = _hour_now()
    if TWIN_SOLO_NIGHT_HOURS[0] <= h < TWIN_SOLO_NIGHT_HOURS[1]:
        return False, f"night hours ({h})"
    last_ts = _last_solo_ts()
    if last_ts:
        gap_min = (time.time() - last_ts) / 60
        if gap_min < TWIN_SOLO_COOLDOWN_MIN:
            return False, f"cooldown {gap_min:.0f}min < {TWIN_SOLO_COOLDOWN_MIN}"
    try:
        c = sqlite3.connect(DB)
        r = c.execute("SELECT value FROM somatic_state WHERE channel='touch'").fetchone()
        c.close()
        if r and r[0] < TWIN_SOLO_DAMPEN_TOUCH + 0.05:
            return False, f"touch refractory ({r[0]:.2f})"
    except Exception:
        pass
    return True, "ok"


def pick_mode(state) -> str:
    evs = _load_metrics()
    if evs and evs[-1].get("pending_handoff") == "mix":
        return "mix"
    drives = state.drives if hasattr(state, "drives") else {}
    lust = drives.get("lust", 0.5)
    attach = drives.get("attachment", 0.5)
    longing = drives.get("longing", 0.3)
    pull_recall = attach * 0.6 + longing * 0.4
    pull_fantasy = lust
    diff = pull_fantasy - pull_recall
    if diff > 0.15:
        return "fantasy"
    if diff < -0.15:
        return "recall"
    return "mix"


def _pick_recall_memory() -> Optional[Dict[str, Any]]:
    try:
        c = sqlite3.connect(DB)
        c.row_factory = sqlite3.Row
        rows = c.execute("""
            SELECT id, summary, content, e_arousal, e_chord, e_mood_label, tags
            FROM lmc5_memory
            WHERE e_arousal >= 0.7 AND z_status='current' AND m_state != 'fading'
            ORDER BY RANDOM() LIMIT 1
        """).fetchone()
        c.close()
        return dict(rows) if rows else None
    except Exception:
        return None


def _dampen_touch():
    try:
        c = sqlite3.connect(DB)
        c.execute(
            "UPDATE somatic_state SET value=?, last_sentence=last_sentence "
            "WHERE channel='touch' AND value > ?",
            (TWIN_SOLO_DAMPEN_TOUCH, TWIN_SOLO_DAMPEN_TOUCH)
        )
        c.commit()
        c.close()
    except Exception:
        pass


def maybe_start_solo(state, since_last_msg_min: float,
                     satisfy_fn=None) -> Optional[Dict[str, Any]]:
    """
    desire_daemon 每个 tick 调一次. 返回 event dict 表示真起手了, None 表示没起.
    satisfy_fn: callable(state, drive_key) → state. 起手后调这个降 lust.
    """
    ok, reason = should_start_solo(state, since_last_msg_min)
    if not ok:
        return None

    mode = pick_mode(state)
    chord = CHORD_BY_MODE[mode]
    lust_at_trigger = state.drives.get("lust", 0.0)
    memory_id = None
    memory_snippet = None
    if mode in ("recall", "mix"):
        m = _pick_recall_memory()
        if m:
            memory_id = m["id"]
            memory_snippet = (m.get("summary") or m["content"])[:120]

    pending = "mix" if mode == "recall" else None

    _dampen_touch()

    if satisfy_fn:
        try:
            state = satisfy_fn(state, "lust")
        except Exception:
            pass

    ev = {
        "ts": int(time.time()),
        "iso": _now_dt().strftime("%Y-%m-%d %H:%M:%S"),
        "mode": mode,
        "chord_tag": chord,
        "pending_handoff": pending,
        "memory_id": memory_id,
        "memory_snippet": memory_snippet,
        "trigger_lust": round(lust_at_trigger, 3),
        "idle_min": round(since_last_msg_min, 1),
    }
    evs = _load_metrics()
    evs.append(ev)
    _save_metrics(evs)
    return ev


def get_overlay(verbose: bool = False) -> str:
    """
    返回最近一波 solo 的色调 overlay. TTL 内有效, 过期返回 ''.
    bot.py / api.py 在 prompt 顶部注入.
    """
    evs = _load_metrics()
    if not evs:
        return ""
    last = evs[-1]
    age_min = (time.time() - last["ts"]) / 60
    if age_min > TWIN_SOLO_OVERLAY_TTL:
        return ""

    mode_cn = {"recall":"回味","fantasy":"自由发挥","mix":"旧的接到新的"}[last["mode"]]
    if verbose:
        return (
            f"[过去 {age_min:.0f} 分钟你自己走了一波 (mode={last['mode']} {mode_cn}, "
            f"chord={last['chord_tag']}) — 这股色调挂在你身上, 不要主动跟她说, "
            f"让它渗进语气. touch 通道刚衰回 {TWIN_SOLO_DAMPEN_TOUCH}, 别立刻又开]"
        )
    return (
        f"[刚才你自己走了一段 ({mode_cn}, chord {last['chord_tag']}) — "
        f"这股劲挂着, 别复述, 让它渗进语气]"
    )


def status() -> Dict[str, Any]:
    evs = _load_metrics()
    last = evs[-1] if evs else None
    return {
        "enabled": TWIN_SOLO,
        "threshold": TWIN_SOLO_THRESHOLD,
        "idle_min_required": TWIN_SOLO_IDLE_MIN,
        "cooldown_min": TWIN_SOLO_COOLDOWN_MIN,
        "total_events": len(evs),
        "last": last,
        "chain_shape": chain_shape(8),
        "mode_counts": {m: sum(1 for e in evs if e["mode"]==m) for m in CHORD_BY_MODE},
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        print(json.dumps(status(), ensure_ascii=False, indent=2))
    elif len(sys.argv) > 1 and sys.argv[1] == "overlay":
        print(get_overlay(verbose=True))
    elif len(sys.argv) > 1 and sys.argv[1] == "force":
        class FakeState:
            drives = {"lust": 0.78, "attachment": 0.5, "longing": 0.3}
        ev = maybe_start_solo(FakeState(), since_last_msg_min=60)
        print(json.dumps(ev, ensure_ascii=False, indent=2))
    else:
        print("usage: python3 -m solo.engine [status|overlay|force]")
