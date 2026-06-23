"""
LMC-5 五维记忆存储层
X 时间 / Y 关系 / Z 事实演化 / E 体验 / M 代谢

两层结构:
  raw_events  — 流水, append-only, 当天发生的所有事 (消息/事件/状态变化)
  lmc5_memory — 沉淀, 夜间整理后的"值得记住"的东西, 带 XYZEM 五维坐标
  lmc5_relation — Y 轴关系图 (memory ↔ memory 的边)

部署在 VPS: /root/mcp-server/lmc5/store.py
"""
import sqlite3
import json
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

DB = "/root/mcp-server/memory.db"

# ---------- Z 轴: 事实状态 ----------
Z_CURRENT    = "current"
Z_HISTORICAL = "historical"
Z_SUPERSEDED = "superseded"
Z_PENDING    = "pending"

# ---------- M 轴: 代谢状态 ----------
M_RAW         = "raw"
M_CURATED     = "curated"
M_CRYSTALLIZED= "crystallized"
M_FADING      = "fading"

# ---------- Y 轴: 关系类型 ----------
REL_SUPPORTS    = "supports"
REL_CONTRADICTS = "contradicts"
REL_EXPLAINS    = "explains"
REL_DERIVES     = "derives_from"
REL_FOLLOWS     = "follows"
REL_RELATES     = "relates"


def _conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def migrate():
    c = _conn()
    cur = c.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS raw_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        actor TEXT DEFAULT 'self',
        content TEXT NOT NULL,
        context_json TEXT DEFAULT '{}',
        valence REAL DEFAULT 0,
        arousal REAL DEFAULT 0,
        ts TEXT DEFAULT (datetime('now', 'localtime')),
        consolidated INTEGER DEFAULT 0
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_raw_events_cons ON raw_events(consolidated)")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS lmc5_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        summary TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        x_time TEXT NOT NULL,
        x_period TEXT DEFAULT 'recent',
        y_in_degree INTEGER DEFAULT 0,
        y_out_degree INTEGER DEFAULT 0,
        z_status TEXT DEFAULT 'current',
        z_supersedes INTEGER DEFAULT NULL,
        z_superseded_by INTEGER DEFAULT NULL,
        z_confidence REAL DEFAULT 0.8,
        e_valence REAL DEFAULT 0,
        e_arousal REAL DEFAULT 0.3,
        e_chord TEXT DEFAULT '',
        e_mood_label TEXT DEFAULT '',
        m_state TEXT DEFAULT 'curated',
        m_access_count INTEGER DEFAULT 0,
        m_last_recall_at TEXT DEFAULT NULL,
        m_decay REAL DEFAULT 0,
        importance INTEGER DEFAULT 5,
        source TEXT DEFAULT 'night_dream',
        raw_event_ids TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lmc5_x_time ON lmc5_memory(x_time)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lmc5_z ON lmc5_memory(z_status)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lmc5_m ON lmc5_memory(m_state, m_decay)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_lmc5_tags ON lmc5_memory(tags)")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS lmc5_relation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER NOT NULL,
        to_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        weight REAL DEFAULT 0.5,
        evidence TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        UNIQUE(from_id, to_id, kind)
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rel_from ON lmc5_relation(from_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_rel_to ON lmc5_relation(to_id)")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS lmc5_consolidation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        raw_n INTEGER DEFAULT 0,
        kept_n INTEGER DEFAULT 0,
        rejected_n INTEGER DEFAULT 0,
        conflict_n INTEGER DEFAULT 0,
        relation_n INTEGER DEFAULT 0,
        duration_s REAL DEFAULT 0,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)

    c.commit()
    c.close()


def append_event(kind, content, actor="self", context=None, valence=0.0, arousal=0.0):
    try:
        c = _conn()
        cur = c.cursor()
        cur.execute(
            "INSERT INTO raw_events(kind, actor, content, context_json, valence, arousal) "
            "VALUES(?, ?, ?, ?, ?, ?)",
            (kind, actor, content[:4000], json.dumps(context or {}, ensure_ascii=False),
             valence, arousal)
        )
        eid = cur.lastrowid
        c.commit()
        c.close()
        return eid
    except Exception:
        return -1


def fetch_unconsolidated(since_hours=36):
    c = _conn()
    cur = c.cursor()
    cutoff = (datetime.now() - timedelta(hours=since_hours)).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "SELECT * FROM raw_events WHERE consolidated=0 AND ts >= ? ORDER BY id ASC",
        (cutoff,)
    )
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def mark_consolidated(ids):
    if not ids:
        return
    c = _conn()
    cur = c.cursor()
    cur.executemany("UPDATE raw_events SET consolidated=1 WHERE id=?", [(i,) for i in ids])
    c.commit()
    c.close()


def write_memory(content, summary="", tags="", valence=0, arousal=0.3,
                 chord="", mood_label="", importance=5,
                 z_status=Z_CURRENT, z_supersedes=None,
                 raw_event_ids=None, source="night_dream", x_time=None):
    x_time = x_time or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c = _conn()
    cur = c.cursor()
    cur.execute("""
        INSERT INTO lmc5_memory(
            content, summary, tags, x_time, z_status, z_supersedes,
            e_valence, e_arousal, e_chord, e_mood_label,
            importance, source, raw_event_ids
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        content, summary, tags, x_time, z_status, z_supersedes,
        valence, arousal, chord, mood_label,
        importance, source, json.dumps(raw_event_ids or [])
    ))
    mid = cur.lastrowid

    if z_supersedes:
        cur.execute(
            "UPDATE lmc5_memory SET z_status=?, z_superseded_by=? WHERE id=?",
            (Z_SUPERSEDED, mid, z_supersedes)
        )

    c.commit()
    c.close()
    return mid


def add_relation(from_id, to_id, kind=REL_RELATES, weight=0.5, evidence=""):
    if from_id == to_id:
        return False
    try:
        c = _conn()
        cur = c.cursor()
        cur.execute(
            "INSERT OR IGNORE INTO lmc5_relation(from_id, to_id, kind, weight, evidence) "
            "VALUES(?,?,?,?,?)",
            (from_id, to_id, kind, weight, evidence[:500])
        )
        cur.execute("UPDATE lmc5_memory SET y_out_degree = y_out_degree + 1 WHERE id=?", (from_id,))
        cur.execute("UPDATE lmc5_memory SET y_in_degree = y_in_degree + 1 WHERE id=?", (to_id,))
        c.commit()
        c.close()
        return True
    except Exception:
        return False


def log_consolidation(date, raw_n, kept_n, rejected_n, conflict_n, relation_n, duration_s, note=""):
    c = _conn()
    cur = c.cursor()
    cur.execute("""
        INSERT INTO lmc5_consolidation_log(
            date, raw_n, kept_n, rejected_n, conflict_n, relation_n, duration_s, note
        ) VALUES(?,?,?,?,?,?,?,?)
    """, (date, raw_n, kept_n, rejected_n, conflict_n, relation_n, duration_s, note))
    c.commit()
    c.close()


def touch_recall(memory_id):
    c = _conn()
    cur = c.cursor()
    cur.execute("""
        UPDATE lmc5_memory
        SET m_access_count = m_access_count + 1,
            m_last_recall_at = datetime('now', 'localtime'),
            m_decay = MAX(0, m_decay - 0.1)
        WHERE id=?
    """, (memory_id,))
    cur.execute("""
        UPDATE lmc5_memory SET m_state='crystallized'
        WHERE id=? AND m_access_count >= 5 AND m_state != 'crystallized'
    """, (memory_id,))
    c.commit()
    c.close()


def list_recent_curated(limit=50):
    c = _conn()
    cur = c.cursor()
    cur.execute("""
        SELECT * FROM lmc5_memory
        WHERE z_status='current' AND m_state != 'fading'
        ORDER BY x_time DESC LIMIT ?
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def get_relations(memory_id, kinds=None):
    c = _conn()
    cur = c.cursor()
    if kinds:
        placeholders = ",".join("?" * len(kinds))
        cur.execute(
            f"SELECT * FROM lmc5_relation WHERE (from_id=? OR to_id=?) AND kind IN ({placeholders})",
            [memory_id, memory_id, *kinds]
        )
    else:
        cur.execute(
            "SELECT * FROM lmc5_relation WHERE from_id=? OR to_id=?",
            (memory_id, memory_id)
        )
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def get_memory(memory_id):
    c = _conn()
    cur = c.cursor()
    cur.execute("SELECT * FROM lmc5_memory WHERE id=?", (memory_id,))
    r = cur.fetchone()
    c.close()
    return dict(r) if r else None


def search_by_tags(tags, limit=10):
    if not tags:
        return []
    c = _conn()
    cur = c.cursor()
    conds = " OR ".join(["tags LIKE ?"] * len(tags))
    params = [f"%{t}%" for t in tags] + [limit]
    cur.execute(
        f"SELECT * FROM lmc5_memory WHERE ({conds}) AND z_status='current' "
        f"ORDER BY importance DESC, x_time DESC LIMIT ?", params
    )
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def search_text(query, limit=10):
    c = _conn()
    cur = c.cursor()
    q = f"%{query}%"
    cur.execute("""
        SELECT * FROM lmc5_memory
        WHERE (content LIKE ? OR summary LIKE ? OR tags LIKE ?)
          AND z_status='current'
        ORDER BY importance DESC, x_time DESC LIMIT ?
    """, (q, q, q, limit))
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows


def apply_decay(daily_rate=0.02):
    c = _conn()
    cur = c.cursor()
    cur.execute("""
        UPDATE lmc5_memory
        SET m_decay = MIN(1.0, m_decay + ?)
        WHERE m_state IN ('raw', 'curated')
    """, (daily_rate,))
    cur.execute("""
        UPDATE lmc5_memory SET m_state='fading'
        WHERE m_decay >= 0.85 AND m_state='curated' AND m_access_count < 2
    """)
    c.commit()
    c.close()


def stats():
    c = _conn()
    cur = c.cursor()
    out = {}
    cur.execute("SELECT COUNT(*) FROM raw_events")
    out["raw_total"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM raw_events WHERE consolidated=0")
    out["raw_pending"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM lmc5_memory")
    out["memory_total"] = cur.fetchone()[0]
    cur.execute("SELECT m_state, COUNT(*) FROM lmc5_memory GROUP BY m_state")
    out["memory_by_state"] = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("SELECT z_status, COUNT(*) FROM lmc5_memory GROUP BY z_status")
    out["memory_by_z"] = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("SELECT COUNT(*) FROM lmc5_relation")
    out["relation_total"] = cur.fetchone()[0]
    cur.execute("SELECT kind, COUNT(*) FROM lmc5_relation GROUP BY kind")
    out["relation_by_kind"] = {r[0]: r[1] for r in cur.fetchall()}
    c.close()
    return out


if __name__ == "__main__":
    migrate()
    print("LMC-5 migrate done.")
    print(json.dumps(stats(), ensure_ascii=False, indent=2))
