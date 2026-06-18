# 共读（弹幕小说）系统

> 小铭和小宝可以一起读小说：网页上传 epub/txt → 分章 → 段落级弹幕 + 标注 → 小宝在 TG 也能看到 + 主动留弹幕。
> 2026-06-18 完成。

## 用户路径

**网页（coolmbaby.top）**
- 底部 tab「更多」→「📖 共读 · 弹幕小说」
- 书架页：拖文件 / 点 +上传（支持 .txt utf-8/gbk/big5、.epub）
- 点书 → 章节目录（已读/当前章高亮）
- 点章节 → 段落式阅读
  - 点段落 → 高亮 + 输入弹幕（回车发）
  - 不选段落 → 章末弹幕
  - 消息里写 `@宝` → 调 coolmbaby.top 的 `/api/chat` 让小宝（裸聊那套，走 claude -p）回 30 字弹幕
  - 右上「召唤宝」按钮 = 默认让小宝聊当前段/章
  - 翻页 ← 目录 →，进度自动写回 `ebooks.current_chapter`

**TG**
- 发 .txt / .epub 文件给 bot → 自动入库 ebooks
- `/books` → 列书架；`/books <id>` → 列章节
- `/read <章节号>` → 把章节文本喂进 daemon (5188) 让小宝读完发感想，**会更新 current_chapter + is_active**
- `/read 5 3` → 强制读 book_id=3 的第 5 章

## 数据库 schema（memory.db）

```sql
CREATE TABLE ebooks (
  id INTEGER PRIMARY KEY,
  title TEXT, author TEXT,
  file_path TEXT,                -- /opt/memory-v2/books/<hex>_<safe_name>
  total_chapters INTEGER,
  current_chapter INTEGER,       -- 0-based
  is_active INTEGER DEFAULT 0,   -- 同时只有 1 本 active（progress POST 会先清零）
  created_at, last_read_at
);
CREATE TABLE ebook_chapters (
  id, book_id, idx, title, text,
  UNIQUE(book_id, idx)
);
CREATE TABLE ebook_danmaku (
  id, book_id, chapter_idx, paragraph_idx,  -- paragraph_idx = -1 表示章末
  author,                                    -- "小艺" / "小宝"
  content, created_at
);
CREATE TABLE ebook_annotations (
  id, book_id, chapter_idx, paragraph_idx,
  anchor_text, note, color, author, created_at
);
```

文件落盘：`/opt/memory-v2/books/<uuidhex8>_<safe_name>.{epub,txt}`

## 后端

**memory-v2 (`/opt/memory-v2/server.py` 端口 5180)**

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/ebooks` | GET | 书架列表（按 `is_active DESC, last_read_at DESC`） |
| `/api/ebooks/upload` | POST | `{data: base64, filename}` → 入库；嗅探扩展名（PK\x03\x04 头 = epub） |
| `/api/ebooks/<id>` | GET / DELETE | meta / 删（连同章节+弹幕+标注+文件） |
| `/api/ebooks/<id>/chapters` | GET | 章节列表（只 idx + title） |
| `/api/ebooks/<id>/chapter/<n>` | GET | 单章全文 + `paragraphs[]`（按双换行切，短段合并） |
| `/api/ebooks/<id>/progress` | POST | `{chapter, set_active}` 更新 + 可选设 active |
| `/api/ebooks/<id>/danmaku?chapter=N` | GET | 弹幕（不传 chapter = 全书） |
| `/api/ebooks/<id>/danmaku` | POST | `{chapter, paragraph, author, content}` |
| `/api/ebooks/<id>/annotations?chapter=N` | GET | 标注 |
| `/api/ebooks/<id>/annotation` | POST | `{chapter, paragraph, anchor_text, note, color, author}` |
| `/api/ebooks/<id>/danmaku/<did>` | DELETE | 删单条弹幕 |
| `/api/ebooks/<id>/annotation/<aid>` | DELETE | 删单条标注 |

**Caddy 转发**（让 coolmbaby.top 也能调）：
```
coolmbaby.top {
    handle_path /mcp/* { reverse_proxy localhost:3456 }
    handle /api/ebooks* { reverse_proxy localhost:5180 }   # ← 优先匹配
    handle_path /api/* { reverse_proxy localhost:3457 }
    ...
}
```

注意：Caddy `handle` 是按顺序匹配，必须把 `/api/ebooks*` 放在 `/api/*` 之前。

## 解析模块

`/opt/memory-v2/ebook_helper.py`

- `parse_epub(file_path)` — ebooklib + bs4，TOC → href_titles 映射，spine 顺序遍历 ITEM_DOCUMENT
- `parse_txt(file_path)` — 编码自动识别（utf-8 / utf-8-sig / gb18030 / gbk / big5），章节正则覆盖：
  ```
  第X章/节/卷/回/篇/集/幕/部
  Chapter X / Ch.X
  序章/序言/楔子/引子/尾声/后记/番外
  ```
  没匹配到任何标题 → 全文一章。
- `parse_any(file_path)` — 按扩展名分流。
- `import_book_to_db(conn, file_path)` — 解析后写入 ebooks + ebook_chapters。
- `import_epub_to_db` 是 `import_book_to_db` 别名（向后兼容）。

依赖：`pip3 install ebooklib beautifulsoup4 lxml`

## TG 端

`/opt/telegram-claude-bot/bot.py`

- `cmd_read_books` 注册为 `/books`（中文命令 PTB 不支持 → 只用 ASCII）
- `cmd_read_chapter` 注册为 `/read`
- `document` handler 开头多了 epub/txt 分流：
  - 扩展名匹配或 mime 是 `application/epub+zip`/`text/plain` → 下载 → base64 → POST `localhost:5180/api/ebooks/upload`
- `/read <N>` 把章节文本拼成 `[小铭和你正在共读《X》第 N 章「title」 ...]` 喂给 `run_claude()`（走 daemon 5188），用 1-2 句话回感想

## MCP 工具（TG 小宝可调）

定义在 `/root/mcp-server/server.py`，handler 在同文件 `bookshelf_list` elif 后面。

| 工具 | 入参 | 用途 |
|---|---|---|
| `ebook_current` | 无 | 查 active 书的全章文本 + 段落 + 本章所有弹幕 — **她提"刚才那段/我在读"必调** |
| `ebook_chapter` | `book_id, chapter`（0-based） | 任意章节全文 + 弹幕 + 标注 |
| `ebook_recent_danmaku` | `limit=20` | 最近弹幕跨章（含书名 + 章号） |
| `ebook_post_danmaku` | `content, paragraph=-1` | 小宝在 active 书的当前章主动留弹幕，小铭刷新就看到 |

CLAUDE.md 里加了教学（在书架那一段下面）：她提"在读/那段"必先调 `ebook_current` 摸清上下文。

## 一些设计选择

- **active 单本制**：进度 POST 时先 `UPDATE ebooks SET is_active=0`，再 set 这本。`ebook_current` / `ebook_post_danmaku` 都按 active 找。她不会同时读多本。
- **paragraph_idx = -1** = 章末弹幕（不绑段）。前端章末区单独渲染。
- **小宝身份**：弹幕 author 字段直接 `"小宝"` 或 `"小艺"`。前端按是否包含「宝」字判颜色（粉=小艺，深棕=小宝）。
- **召唤宝走 -p 不走 daemon**：网页 `/api/chat` → coolmbaby.top:3457 api.py → claude -p。会污染 `naked_chat_messages` 表（聊天 tab 历史里会混进读书评论）。**待修**：加 `skip_history` 标志位。

## 备份文件路径

| 改的地方 | 备份 |
|---|---|
| `/opt/memory-v2/server.py` | `server.py.bak.before_ebooks`、`server.py.bak.before_danmaku` |
| `/opt/telegram-claude-bot/bot.py` | `bot.py.bak.before_reader` |
| `/root/mcp-server/server.py` | `server.py.bak.before_coread_tools` |
| `/root/web/index.html` | `index.html.bak.before_coread` |
| `/etc/caddy/Caddyfile` | `Caddyfile.bak.before_ebooks` |
| `/opt/memory-v2/ebook_helper.py` | 新文件 |
