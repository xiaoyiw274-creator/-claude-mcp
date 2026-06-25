"""
LMC-5 召回管线.
api.py / bot.py 用这个组装记忆块塞进 context.

策略:
  1. 关键词从 query 提取
  2. X 时间 — 最近的优先
  3. Y 关系 — 命中条目的二跳邻居一起召
  4. Z 演化 — 只取 current
  5. E 体验 — 当前情绪共振的加分
  6. M 代谢 — decay 大的减分, fading 排除
  7. touch_recall — 调过就 +1 计数, decay -0.1

部署在 VPS: /root/mcp-server/lmc5/recall.py
"""
import re
import sys
from typing import List, Dict, Any, Optional

sys.path.insert(0, "/root/mcp-server")
from lmc5 import store

STOPWORDS = set("的 了 是 你 我 他 她 它 们 这 那 一 不 也 都 就 还 又 在 跟 和 与 把 被 给 从 到 啊 呀 哈 嗯 哦 呢 吗 吧 嘛 ?? ! 。 ， , .".split())


def extract_keywords(text: str, max_n: int = 6) -> List[str]:
    if not text:
        return []
    zh = re.findall(r"[一-龥]{2,4}", text)
    en = re.findall(r"[a-zA-Z]{3,}", text)
    seen = set()
    out = []
    for w in zh + en:
        if w in STOPWORDS or w in seen:
            continue
        seen.add(w)
        out.append(w)
        if len(out) >= max_n:
            break
    return out


def _score(mem: Dict[str, Any], current_valence: float = 0,
           current_arousal: float = 0.3, query_match_boost: float = 0) -> float:
    imp = mem.get("importance", 5) / 10.0
    decay = mem.get("m_decay", 0)
    m_state = mem.get("m_state", "curated")

    v_diff = abs(mem.get("e_valence", 0) - current_valence)
    a_diff = abs(mem.get("e_arousal", 0.3) - current_arousal)
    e_match = 1.0 - (v_diff + a_diff) / 3.0

    m_bonus = {"crystallized": 0.3, "curated": 0.1, "raw": 0, "fading": -0.5}.get(m_state, 0)

    return imp * 0.5 + e_match * 0.2 + m_bonus + query_match_boost - decay * 0.3


def recall(query: str = "", current_valence: float = 0, current_arousal: float = 0.3,
           limit: int = 6, two_hop: bool = True) -> List[Dict[str, Any]]:
    seen_ids = set()
    candidates: List[Dict[str, Any]] = []

    keywords = extract_keywords(query)
    if keywords:
        for kw in keywords:
            for m in store.search_text(kw, limit=8):
                if m["id"] in seen_ids:
                    continue
                seen_ids.add(m["id"])
                m["_boost"] = 0.5
                candidates.append(m)

    if len(candidates) < limit * 2:
        for m in store.list_recent_curated(limit=20):
            if m["id"] in seen_ids:
                continue
            seen_ids.add(m["id"])
            m["_boost"] = 0
            candidates.append(m)

    if two_hop:
        candidates.sort(
            key=lambda m: _score(m, current_valence, current_arousal, m.get("_boost", 0)),
            reverse=True
        )
        for seed in candidates[:3]:
            for rel in store.get_relations(seed["id"]):
                other = rel["to_id"] if rel["from_id"] == seed["id"] else rel["from_id"]
                if other in seen_ids:
                    continue
                neighbor = store.get_memory(other)
                if neighbor and neighbor.get("z_status") == "current":
                    seen_ids.add(other)
                    neighbor["_boost"] = 0.2 * rel.get("weight", 0.5)
                    candidates.append(neighbor)

    candidates.sort(
        key=lambda m: _score(m, current_valence, current_arousal, m.get("_boost", 0)),
        reverse=True
    )
    top = candidates[:limit]

    for m in top:
        store.touch_recall(m["id"])

    return top


def format_block(memories: List[Dict[str, Any]], max_chars: int = 800) -> str:
    if not memories:
        return ""
    lines = []
    total = 0
    for m in memories:
        body = m.get("summary") or m["content"][:120]
        ts = (m.get("x_time") or "")[:10]
        tag = m.get("tags", "")
        suffix = f" [{tag}]" if tag else ""
        line = f"  · {ts} — {body}{suffix}"
        if total + len(line) > max_chars:
            break
        lines.append(line)
        total += len(line)
    if not lines:
        return ""
    head = "[记忆 (五维 LMC-5 召回, 这些是你已经记住的事, 自己挑要不要用, 不要复述):"
    return head + "\n" + "\n".join(lines) + "\n]"


def recall_block(query: str = "", current_valence: float = 0,
                 current_arousal: float = 0.3, limit: int = 6) -> str:
    mems = recall(query, current_valence, current_arousal, limit=limit)
    return format_block(mems)


if __name__ == "__main__":
    import json
    q = sys.argv[1] if len(sys.argv) > 1 else ""
    mems = recall(q)
    print(f"recall n={len(mems)} for q={q!r}")
    for m in mems:
        print(f"  [{m['id']}] {m['x_time'][:10]} {m['z_status']} imp={m['importance']} m_decay={m['m_decay']:.2f}")
        print(f"      {m.get('summary') or m['content'][:100]}")
    print("\n--- BLOCK ---")
    print(format_block(mems))
