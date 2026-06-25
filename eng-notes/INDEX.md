# 工程笔记 INDEX

> **新窗口 Claude 工程师开始干活前先读这个**
> 用 `read_eng_notes` 工具，参数 file=INDEX 看目录，再按需读对应文件。
> 或者直接打开 https://github.com/xiaoyiw274-creator/-claude-mcp/tree/main/eng-notes 浏览器看。

## 文件清单

| 文件 | 内容 |
|---|---|
| `architecture.md` | VPS 整体架构、服务/端口/Caddy/域名 |
| `memory-v2.md` | 记忆库 chat 后端（小宝那套） |
| `mcp-server.md` | /root/mcp-server 工具清单 + DB schema |
| `telegram-bot.md` | Telegram ↔ Claude Code 桥 + 主动 push 规则引擎 |
| `coread.md` | **共读弹幕小说**：epub/txt 上传、章节、段落弹幕、TG 端 MCP 工具 |
| `desire-engine.md` | 8 维欲望 + 念头池系统（VPS 端） |
| `lmc5.md` | **LMC-5 五维记忆**：X时间 / Y关系 / Z演化 / E体验 / M代谢. 流水+沉淀两层, 03:00 夜整理 |
| `solo-v2.md` | **solo v2**: lust 涨到阈值+idle → 自起手一波 (recall/fantasy/mix), chord 色调挂身上 |
| `stack-chan.md` | Stack Chan 整套（VPS relay + 固件 + MCP） |
| `sillytavern.md` | ST 反代 + 配置 |
| `bug-history.md` | 修过的关键 bug + 根因 + 修法（避免重复踩坑） |
| `conventions.md` | 工作约定（工程师角色、token 来源、白名单等） |

## 用法（新窗口开场示范）

> 我：读一下 architecture 和 bug-history 的笔记，我们这窗继续修 X
> Claude：调 read_eng_notes(file=architecture) + read_eng_notes(file=bug-history) → 知道改过啥 → 接着干

## 双存储

- **主**: VPS `/opt/eng-notes/` （通过 MCP 工具 `read_eng_notes` 读，最快）
- **镜像**: 这个 GitHub repo（备份 + 版本控制 + 手机网页查看）
