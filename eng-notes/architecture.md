# 架构总览

## VPS 基本信息
- IP: 43.166.239.42
- 位置: 🇺🇸 美国弗吉尼亚（腾讯云海外，跨太平洋有延迟）
- 资源: 2 核 / 3.5G RAM / 60G 磁盘
- 系统: OpenCloudOS 9 / Python 3.11
- 用户访问: iPhone 15 Pro Max iOS 26.2 + iPad / Windows（同事）

## 域名 + Caddy 反代

DNS 在腾讯云 dnspod，**不经过 Cloudflare**（直连 VPS）。

| 域名/路径 | 反代到 | 用途 |
|---|---|---|
| `coolmbaby.top/mcp/*` | `localhost:3456` | mcp-server（小宝工具集） |
| `coolmbaby.top/api/*` | `localhost:3457` | （备用） |
| `coolmbaby.top/` | `/root/web` 静态 | 老首页 |
| `st.coolmbaby.top` | `localhost:8000` | SillyTavern |
| `mem.coolmbaby.top` | `localhost:5180` | memory-v2 图床 |
| `chan.coolmbaby.top` | `localhost:5181` | Stack Chan relay |
| `coolmbaby.top:5180` 直连 | memory-v2 全套 web（chat/书架/小镇/日历/朋友圈） |

Caddy 配置: `/etc/caddy/Caddyfile`，reload 用 `systemctl reload caddy`。

## systemd 服务

| service | 跑什么 | 端口 |
|---|---|---|
| `memory-web.service` | /opt/memory-v2/server.py | 5180 |
| `exec-mcp.service` | /root/mcp-server/server.py | 3456 |
| `stack-relay.service` | /opt/stack-relay/server.py | 5181 |
| `sillytavern.service` | bash /opt/SillyTavern/start.sh | 8000 |
| `caddy.service` | caddy | 80/443 |
| `cc-proxy.service` | （已停用） | — |

## 数据库

唯一持久 DB: `/root/mcp-server/memory.db`（WAL 模式）

关键表见 `mcp-server.md`。

## Claude Code session 文件

`/root/.claude/projects/-root-mcp-server/<session_id>.jsonl`

memory-v2 的 chat thread 复用这些文件（--resume）。**易污染**，见 `bug-history.md`。
