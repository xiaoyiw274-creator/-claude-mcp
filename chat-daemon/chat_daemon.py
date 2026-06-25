"""
Claude Code interactive daemon (Phase 1 MVP).

跑一个长进程 claude --input-format stream-json --output-format stream-json,
不带 -p, 走 Max 订阅 5-hour 桶, 不烧 Agent SDK.

HTTP 接口:
- POST /chat  body={"text": "..."}  → SSE 流回 claude 事件
- POST /interrupt                   → kill 子进程 (保留 session_id, 下次自动 --resume)
- POST /reset                       → kill + 丢 session_id (彻底重开)
- GET  /state                       → 进程状态 + session_id

session_id 存 /var/lib/claude-chat-daemon/state.json
"""
import asyncio
import json
import os
import sys
import time

from aiohttp import web

CWD = "/opt/telegram-claude-bot"
STATE_FILE = "/var/lib/claude-chat-daemon/state.json"
CLAUDE_BIN = "/usr/local/bin/claude"
DEFAULT_MODEL = os.environ.get("DAEMON_MODEL", "claude-opus-4-7")
PORT = int(os.environ.get("DAEMON_PORT", "5188"))


class ChatProcess:
    def __init__(self, cwd, state_file, model):
        self.cwd = cwd
        self.state_file = state_file
        self.model = model
        self.proc = None
        self.session_id = None
        self._lock = asyncio.Lock()
        self._pump_task = None
        # 当前 send() 在等的事件 queue. _pump 把事件 put 进去.
        self._consumer_queue = None
        self._load_state()

    def _load_state(self):
        if os.path.exists(self.state_file):
            try:
                d = json.load(open(self.state_file))
                self.session_id = d.get("session_id")
                print(f"[state] loaded session_id={self.session_id}")
            except Exception as e:
                print(f"[state] load fail: {e}")

    def _save_state(self):
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        with open(self.state_file, "w") as f:
            json.dump({"session_id": self.session_id, "updated_at": time.time()}, f)

    def alive(self):
        return self.proc is not None and self.proc.returncode is None

    async def spawn(self):
        if self.alive():
            return
        args = [
            CLAUDE_BIN,
            "--input-format", "stream-json",
            "--output-format", "stream-json",
            "--include-partial-messages",
            "--permission-mode", "auto",
            "--verbose",
            "--model", self.model,
        ]
        if self.session_id:
            args += ["--resume", self.session_id]
        print(f"[spawn] {' '.join(args)}")
        env = {
            **os.environ,
            "HOME": "/root",
            "PATH": "/usr/local/bin:/usr/bin:/bin:/root/.nvm/versions/node/v24.15.0/bin",
        }
        self.proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=self.cwd,
            env=env,
            limit=32 * 1024 * 1024,
        )
        print(f"[spawn] pid={self.proc.pid}")
        self._pump_task = asyncio.create_task(self._pump())
        # 监控 stderr 不阻塞
        asyncio.create_task(self._drain_stderr())

    async def _drain_stderr(self):
        try:
            while self.proc and self.proc.stderr:
                line = await self.proc.stderr.readline()
                if not line:
                    break
                s = line.decode(errors="replace").rstrip()
                if s:
                    print(f"[stderr] {s}", file=sys.stderr)
                    # session 过期处理 (帖子里的踩坑 3)
                    if "No conversation found" in s and self.session_id:
                        print(f"[stderr] session {self.session_id} 失效, 清掉")
                        self.session_id = None
                        self._save_state()
        except Exception as e:
            print(f"[stderr] err: {e}", file=sys.stderr)

    async def _pump(self):
        """读 stdout JSON 行, 路由到 _consumer_queue."""
        try:
            while self.proc and self.proc.stdout:
                line = await self.proc.stdout.readline()
                if not line:
                    break
                try:
                    ev = json.loads(line.decode(errors="replace"))
                except Exception:
                    continue
                # 任何事件里有 session_id 就更新
                sid = ev.get("session_id")
                if sid and sid != self.session_id:
                    self.session_id = sid
                    self._save_state()
                # 推给当前消费者
                if self._consumer_queue is not None:
                    await self._consumer_queue.put(ev)
                    if ev.get("type") == "result":
                        await self._consumer_queue.put(None)  # 这一轮完
        except Exception as e:
            print(f"[pump] err: {e}", file=sys.stderr)
        finally:
            print("[pump] exit")
            if self._consumer_queue is not None:
                # 进程死了也得让 consumer 退出
                await self._consumer_queue.put(None)

    async def interrupt(self):
        """杀子进程, 保留 session_id."""
        if not self.alive():
            return False
        try:
            self.proc.kill()
            await self.proc.wait()
        except Exception as e:
            print(f"[interrupt] {e}")
        return True

    async def reset(self):
        """杀进程 + 丢 session_id."""
        await self.interrupt()
        self.session_id = None
        self._save_state()

    async def send(self, text):
        """发一条 user 消息, async-yield 事件流直到 result."""
        async with self._lock:
            # 进程死了/没起来 -> spawn (带 --resume 自动续)
            if not self.alive():
                await self.spawn()
            self._consumer_queue = asyncio.Queue()
            try:
                msg = {
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": [{"type": "text", "text": text}],
                    },
                }
                self.proc.stdin.write((json.dumps(msg, ensure_ascii=False) + "\n").encode("utf-8"))
                await self.proc.stdin.drain()

                while True:
                    ev = await self._consumer_queue.get()
                    if ev is None:
                        break
                    yield ev
            finally:
                self._consumer_queue = None


# ====== HTTP 接口 ======

CHAT: ChatProcess = None  # singleton


async def handle_chat(request: web.Request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "bad json"}, status=400)
    text = (data.get("text") or "").strip()
    if not text:
        return web.json_response({"error": "text required"}, status=400)

    resp = web.StreamResponse()
    resp.content_type = "text/event-stream"
    resp.charset = "utf-8"
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["X-Accel-Buffering"] = "no"
    await resp.prepare(request)

    try:
        async for ev in CHAT.send(text):
            line = f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            await resp.write(line.encode("utf-8"))
        await resp.write(b"data: {\"type\":\"__done__\"}\n\n")
    except Exception as e:
        import traceback; traceback.print_exc()
        try:
            err = json.dumps({"type": "error", "error": str(e)}, ensure_ascii=False)
            await resp.write(f"data: {err}\n\n".encode("utf-8"))
        except Exception:
            pass

    await resp.write_eof()
    return resp


async def handle_interrupt(request):
    killed = await CHAT.interrupt()
    return web.json_response({"killed": killed, "session_id": CHAT.session_id})


async def handle_reset(request):
    await CHAT.reset()
    return web.json_response({"ok": True})


async def handle_state(request):
    return web.json_response({
        "alive": CHAT.alive(),
        "session_id": CHAT.session_id,
        "pid": CHAT.proc.pid if CHAT.alive() else None,
        "model": CHAT.model,
        "cwd": CHAT.cwd,
    })


def main():
    global CHAT
    CHAT = ChatProcess(cwd=CWD, state_file=STATE_FILE, model=DEFAULT_MODEL)
    app = web.Application()
    app.router.add_post("/chat", handle_chat)
    app.router.add_post("/interrupt", handle_interrupt)
    app.router.add_post("/reset", handle_reset)
    app.router.add_get("/state", handle_state)
    print(f"[daemon] up on 127.0.0.1:{PORT}, model={DEFAULT_MODEL}, cwd={CWD}")
    web.run_app(app, host="127.0.0.1", port=PORT, access_log=None)


if __name__ == "__main__":
    main()
