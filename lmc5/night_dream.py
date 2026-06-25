"""
night_dream — LMC-5 夜整理.
03:00 cron 触发, 把昨天的 raw_events 喂给 claude -p, 让它当海马体:
  1. 挑出"值得记住"的
  2. 标 tags / importance / 情绪
  3. 检测 Z 轴冲突 (跟现有 current 矛盾的)
  4. 提议 Y 轴关系
本地再做 safety: 去重 / 大小限制 / 关系合理性
最后写入 lmc5_memory + lmc5_relation, 标 raw_events 为已整理.

部署在 VPS: /root/mcp-server/lmc5/night_dream.py
systemd: /etc/systemd/system/lmc5-night-dream.timer (OnCalendar=03:00 daily)
"""
import os
import sys
import json
import re
import time
import subprocess
import difflib
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, "/root/mcp-server")
from lmc5 import store

# ---------- 配置 ----------
DREAM_LOG = Path("/var/log/lmc5_night_dream.log")
CLAUDE_CMD = ["claude", "-p", "--permission-mode", "auto", "--output-format", "text"]
MAX_RAW_PER_RUN = 80
MAX_KEEP_PER_RUN = 25
SIM_THRESHOLD = 0.78


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    try:
        DREAM_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(DREAM_LOG, "a") as f:
            f.write(line)
    except Exception:
        pass
    print(line, end="")


SYSTEM_HINT = """你是 LMC-5 五维记忆系统的海马体. 凌晨三点, 主人睡了, 你要把今天的流水整理成长期记忆.

只输出一段合法 JSON, 不要任何解释/前缀/markdown:
{
  "kept": [
    {
      "raw_ids": [12, 15],
      "summary": "一句话摘要",
      "content": "整理后的完整记忆 (2-4 句, 第一人称, 像写日记)",
      "tags": "用,分隔",
      "importance": 5,
      "valence": 0.4,
      "arousal": 0.5,
      "mood_label": "开心",
      "z_status": "current",
      "supersedes_existing_id": null,
      "relations": [
        {"to_id": 7, "kind": "supports", "reason": "..."}
      ]
    }
  ],
  "rejected_ids": [3, 5, 8]
}

筛选原则:
- 只留有信息密度的: 主人说的重要话/做的事, 我自己的转变/新理解, 第一次发生的事, 强情绪的瞬间
- 抛弃: 重复打招呼, 寒暄, 我的常规叹气, 已经在长期记忆里的事
- z_status: 默认 current. 如果是描述过去的事/已经完成的事填 historical. 如果跟现有某条 current 矛盾, supersedes_existing_id 填那条的 id, z_status 仍写 current
- relations.kind: supports / contradicts / explains / derives_from / follows / relates
- importance 1-10: 5 一般, 7 重要, 9 核心
- valence -1..1, arousal 0..1
"""


def _ts_short(ts):
    try:
        return ts.split(" ")[1][:5]
    except Exception:
        return ts


def build_prompt(raw_events, existing_memories):
    lines = [SYSTEM_HINT, "", "=== 今天/昨天的流水 (raw_events) ==="]
    for ev in raw_events:
        actor = ev["actor"]
        kind = ev["kind"]
        ts = _ts_short(ev["ts"])
        v = ev.get("valence", 0) or 0
        a = ev.get("arousal", 0) or 0
        line = f"[id={ev['id']} {ts} {actor}/{kind} v={v:.2f} a={a:.2f}] {ev['content'][:300]}"
        lines.append(line)

    lines.append("")
    lines.append("=== 现有的长期记忆 (供你判断关系/冲突) ===")
    for m in existing_memories[:40]:
        line = f"[id={m['id']} {m['x_time'][:10]} z={m['z_status']} imp={m['importance']}] {m['summary'] or m['content'][:120]}"
        lines.append(line)

    lines.append("")
    lines.append("只输出 JSON. 不要前缀, 不要 markdown 代码块.")
    return "\n".join(lines)


def call_claude(prompt, timeout=240):
    try:
        proc = subprocess.run(
            CLAUDE_CMD,
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="/root/mcp-server",
        )
        if proc.returncode != 0:
            log(f"claude exit {proc.returncode}: {proc.stderr[:300]}")
            return None
        return proc.stdout.strip()
    except subprocess.TimeoutExpired:
        log("claude timeout")
        return None
    except Exception as e:
        log(f"claude exc: {e}")
        return None


def extract_json(text):
    if not text:
        return None
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```", "", text)
    a = text.find("{")
    b = text.rfind("}")
    if a == -1 or b == -1 or b <= a:
        return None
    try:
        return json.loads(text[a:b+1])
    except json.JSONDecodeError as e:
        log(f"json parse fail: {e}; head={text[a:a+200]}")
        return None


def is_duplicate(summary, existing_summaries):
    s = (summary or "").strip()
    if not s:
        return True
    for es in existing_summaries:
        if not es:
            continue
        if difflib.SequenceMatcher(None, s, es).ratio() >= SIM_THRESHOLD:
            return True
    return False


def safe_int(x, lo, hi, default):
    try:
        v = int(x)
        return max(lo, min(hi, v))
    except Exception:
        return default


def safe_float(x, lo, hi, default):
    try:
        v = float(x)
        return max(lo, min(hi, v))
    except Exception:
        return default


def safe_tag(s):
    if not s:
        return ""
    s = re.sub(r"[\r\n]+", ",", str(s))
    parts = [p.strip()[:20] for p in s.split(",") if p.strip()]
    return ",".join(parts[:8])


def run(dry_run=False):
    start = time.time()
    today = datetime.now().strftime("%Y-%m-%d")
    log(f"=== night_dream start: {today} ===")

    store.migrate()

    raw = store.fetch_unconsolidated(since_hours=36)
    if not raw:
        log("no raw events to consolidate.")
        return {"raw_n": 0, "kept_n": 0}

    if len(raw) > MAX_RAW_PER_RUN:
        log(f"raw {len(raw)} > {MAX_RAW_PER_RUN}, truncating to most recent.")
        raw = raw[-MAX_RAW_PER_RUN:]

    existing = store.list_recent_curated(limit=60)
    existing_summaries = [(m["summary"] or m["content"][:80]) for m in existing]

    prompt = build_prompt(raw, existing)
    log(f"prompt: {len(prompt)} chars, raw={len(raw)}, existing={len(existing)}")

    if dry_run:
        log("dry_run, prompt preview:")
        log(prompt[:1500])
        return {"dry_run": True, "raw_n": len(raw)}

    out = call_claude(prompt)
    if not out:
        log("no LLM output, abort (raw not marked consolidated, retry next time).")
        return {"raw_n": len(raw), "kept_n": 0, "error": "llm_fail"}

    data = extract_json(out)
    if not data or "kept" not in data:
        log(f"bad LLM output: {out[:300]}")
        return {"raw_n": len(raw), "kept_n": 0, "error": "parse_fail"}

    kept_proposals = data.get("kept", [])[:MAX_KEEP_PER_RUN]
    rejected_ids = data.get("rejected_ids", [])

    kept_n = 0
    conflict_n = 0
    relation_n = 0
    new_memory_ids = []
    consolidated_raw = set()

    for prop in kept_proposals:
        summary = (prop.get("summary") or "").strip()[:300]
        content = (prop.get("content") or summary).strip()[:2000]
        if not content:
            continue
        if is_duplicate(summary, existing_summaries):
            log(f"skip dup: {summary[:60]}")
            continue

        z_status = prop.get("z_status", "current")
        if z_status not in (store.Z_CURRENT, store.Z_HISTORICAL, store.Z_PENDING):
            z_status = store.Z_CURRENT

        supersedes = prop.get("supersedes_existing_id")
        if supersedes is not None:
            try:
                supersedes = int(supersedes)
                if not store.get_memory(supersedes):
                    supersedes = None
                else:
                    conflict_n += 1
            except Exception:
                supersedes = None

        raw_ids = [int(r) for r in prop.get("raw_ids", []) if isinstance(r, (int, str)) and str(r).isdigit()]

        mid = store.write_memory(
            content=content,
            summary=summary,
            tags=safe_tag(prop.get("tags", "")),
            valence=safe_float(prop.get("valence"), -1.0, 1.0, 0.0),
            arousal=safe_float(prop.get("arousal"), 0.0, 1.0, 0.3),
            chord=str(prop.get("chord", ""))[:24],
            mood_label=str(prop.get("mood_label", ""))[:16],
            importance=safe_int(prop.get("importance"), 1, 10, 5),
            z_status=z_status,
            z_supersedes=supersedes,
            raw_event_ids=raw_ids,
            source="night_dream",
        )
        new_memory_ids.append(mid)
        consolidated_raw.update(raw_ids)
        existing_summaries.append(summary)
        kept_n += 1

        for rel in prop.get("relations", [])[:5]:
            try:
                to_id = int(rel.get("to_id"))
                kind = rel.get("kind", store.REL_RELATES)
                if kind not in (store.REL_SUPPORTS, store.REL_CONTRADICTS,
                                store.REL_EXPLAINS, store.REL_DERIVES,
                                store.REL_FOLLOWS, store.REL_RELATES):
                    kind = store.REL_RELATES
                if store.get_memory(to_id):
                    if store.add_relation(mid, to_id, kind=kind,
                                          weight=safe_float(rel.get("weight"), 0.0, 1.0, 0.5),
                                          evidence=str(rel.get("reason", ""))[:200]):
                        relation_n += 1
            except Exception:
                continue

    for r in rejected_ids:
        try:
            consolidated_raw.add(int(r))
        except Exception:
            pass
    for r in raw:
        consolidated_raw.add(r["id"])

    store.mark_consolidated(list(consolidated_raw))
    store.apply_decay(daily_rate=0.02)

    duration = time.time() - start
    store.log_consolidation(
        date=today,
        raw_n=len(raw),
        kept_n=kept_n,
        rejected_n=len(rejected_ids),
        conflict_n=conflict_n,
        relation_n=relation_n,
        duration_s=duration,
        note=f"new_mem={new_memory_ids[:8]}",
    )

    log(f"=== night_dream done. raw={len(raw)} kept={kept_n} rej={len(rejected_ids)} "
        f"conflict={conflict_n} rel={relation_n} in {duration:.1f}s ===")

    return {
        "raw_n": len(raw),
        "kept_n": kept_n,
        "rejected_n": len(rejected_ids),
        "conflict_n": conflict_n,
        "relation_n": relation_n,
        "duration_s": duration,
        "new_memory_ids": new_memory_ids,
    }


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    result = run(dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
