"""
一次性从老 memories/diary 表导入到 lmc5_memory. 幂等.
跑一次即可: python3 -m lmc5.backfill

部署在 VPS: /root/mcp-server/lmc5/backfill.py
"""
import sys
import sqlite3
sys.path.insert(0, "/root/mcp-server")
from lmc5 import store

DB = "/root/mcp-server/memory.db"

CHORD_BY_MOOD = {
    "兴奋": "Gmaj9", "开心": "Cmaj7", "平和": "Fmaj7",
    "稳": "Fmaj7", "倦": "Am7", "烦躁": "Dm7", "低落": "Em7", "丧": "Bm7b5",
}


def backfill_memories():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    cur = c.cursor()
    cur.execute("SELECT * FROM memories ORDER BY id")
    rows = cur.fetchall()
    c.close()

    n = 0
    c = sqlite3.connect(DB)
    cur = c.cursor()
    cur.execute("SELECT COUNT(*) FROM lmc5_memory WHERE source='backfill_memories'")
    if cur.fetchone()[0] > 0:
        c.close()
        print("backfill_memories already done, skip.")
        return 0
    c.close()

    for r in rows:
        content = r["content"]
        chord = r["chord"] if r["chord"] else ""
        v = (r["valence"] or 0)
        if v > 1:
            v = (v - 5) / 5.0
        a = r["arousal"] or 5
        if a > 1:
            a = a / 10.0

        store.write_memory(
            content=content,
            summary=content[:120],
            tags=r["tag"] or "",
            valence=max(-1, min(1, v)),
            arousal=max(0, min(1, a)),
            chord=chord,
            mood_label="",
            importance=r["importance"] or 5,
            source="backfill_memories",
            x_time=r["date"] + " 12:00:00" if r["date"] else None,
        )
        n += 1
    print(f"backfilled {n} memories.")
    return n


def backfill_diary(limit=50):
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    cur = c.cursor()
    cur.execute("SELECT COUNT(*) FROM lmc5_memory WHERE source='backfill_diary'")
    if cur.fetchone()[0] > 0:
        c.close()
        print("backfill_diary already done, skip.")
        return 0

    cur.execute("SELECT * FROM diary ORDER BY date DESC, id DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    c.close()

    n = 0
    for r in rows:
        content = r["content"]
        v = r["valence"] or 5
        if v > 1: v = (v - 5) / 5.0
        a = r["arousal"] or 5
        if a > 1: a = a / 10.0
        chord = r["chord"] if r["chord"] else ""
        mood_str = r["mood"] or ""

        store.write_memory(
            content=content[:1500],
            summary=content[:120],
            tags="日记",
            valence=max(-1, min(1, v)),
            arousal=max(0, min(1, a)),
            chord=chord,
            mood_label=mood_str[:16],
            importance=6,
            source="backfill_diary",
            x_time=r["date"] + " 22:00:00" if r["date"] else None,
        )
        n += 1
    print(f"backfilled {n} diary entries.")
    return n


if __name__ == "__main__":
    store.migrate()
    backfill_memories()
    backfill_diary(50)
    import json
    print(json.dumps(store.stats(), ensure_ascii=False, indent=2))
