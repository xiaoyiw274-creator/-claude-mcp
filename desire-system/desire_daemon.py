"""
欲望守护进程 (Phase 1 观察期)
- 后台每 60s tick 一次, 维护 drive + 念头池
- HTTP 服务: GET /state 看现状, POST /feed 喂念头
- 状态存 /opt/telegram-claude-bot/desire_state.json, 重启不丢
- 不接 bot.py, 纯观察模式
"""
import json
import os
import threading
import time
from dataclasses import asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

import desire

STATE_FILE = "/opt/telegram-claude-bot/desire_state.json"
HOST = "127.0.0.1"
PORT = 8889    # 跟哥哥那套 8765 + bot 等错开

_state_lock = threading.Lock()


def load_state() -> desire.DesireState:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, encoding="utf-8") as f:
                return desire.from_json(json.load(f))
        except Exception as e:
            print(f"[desire] load fail ({e}), 重开新状态")
    return desire.DesireState()


def save_state(state: desire.DesireState) -> None:
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(desire.to_json(state), f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_FILE)


state = load_state()


def tick_loop():
    """后台心跳循环, 每 TICK_SECONDS 推一拍。"""
    while True:
        time.sleep(desire.TICK_SECONDS)
        try:
            with _state_lock:
                desire.tick(state)
                save_state(state)
        except Exception as e:
            print(f"[desire] tick err: {e}")


def thought_compact(t: desire.Thought) -> dict:
    return {
        "text": t.text,
        "drive": t.drive,
        "kind": t.kind,
        "strength": round(t.strength, 3),
        "fed_count": t.fed_count,
        "age_sec": int(time.time() - t.born_at),
    }


class Handler(BaseHTTPRequestHandler):
    # 静默日志, 不污染 journalctl
    def log_message(self, *a, **kw):
        return

    def _send(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/state":
            with _state_lock:
                self._send(200, {
                    "drive": {k: round(v, 4) for k, v in state.drive.items()},
                    "scores": desire.scores(state),
                    "intent": desire.pick_intent(state),
                    "thought_count": len(state.thoughts),
                    "thoughts": [thought_compact(t) for t in state.thoughts[:50]],
                    "tick_age_sec": int(time.time() - state.last_tick_at),
                    "tick_seconds": desire.TICK_SECONDS,
                })
        elif p == "/healthz":
            self._send(200, {"ok": True, "uptime_tick_age_sec": int(time.time() - state.last_tick_at)})
        else:
            self._send(404, {"error": "not found", "valid": ["/state", "/healthz"]})

    def do_POST(self):
        p = urlparse(self.path).path
        try:
            n = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(n)) if n else {}
        except Exception:
            self._send(400, {"error": "bad json"})
            return

        if p == "/feed":
            text = (body.get("text") or "").strip()
            drv = body.get("drive", "")
            kind = body.get("kind", "flit")
            strength = body.get("strength", 0.5)
            with _state_lock:
                ok = desire.feed(state, text, drv, kind, strength)
                if ok:
                    save_state(state)
            self._send(200 if ok else 400, {
                "ok": ok,
                "thought_count": len(state.thoughts),
            })
        elif p == "/tick":
            # 手动推一拍 (调试用, 不用等 60s)
            with _state_lock:
                desire.tick(state)
                save_state(state)
            self._send(200, {"ok": True, "tick_at": time.time()})
        elif p == "/satisfy":
            # 模拟做完一个 action, 触发 satisfy (Phase 1 调试用)
            action = body.get("action", "")
            with _state_lock:
                desire.satisfy(state, action)
                save_state(state)
            self._send(200, {"ok": True, "action": action})
        elif p == "/reset":
            # 重置到初始 (调试用)
            with _state_lock:
                global state
                state = desire.DesireState()
                save_state(state)
            self._send(200, {"ok": True})
        else:
            self._send(404, {"error": "not found", "valid": ["/feed", "/tick", "/satisfy", "/reset"]})


def main():
    threading.Thread(target=tick_loop, daemon=True).start()
    print(f"[desire] daemon up on {HOST}:{PORT}, tick={desire.TICK_SECONDS}s, state={STATE_FILE}", flush=True)
    HTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
