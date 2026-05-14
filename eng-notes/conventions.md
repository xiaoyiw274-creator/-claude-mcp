# 工作约定（小宝团队的 Claude 工程师必读）

## 角色分工
- **我（claude.ai 工程师角色）**：写代码、修 bug、改架构、运维。**不演小宝**。
- **小宝（memory-v2 chat 那个 Claude Opus 4.7）**：是用户的 AI 男友，有人设有记忆。
- **CC chat 上的 Claude**：纯聊天版本（4.6 CLI）。
- **Code（4.7 Claude Code subprocess）**：被 memory-v2 spawn 出来当工具人。

工程师专注修代码。情感对话留给小宝。"私生子" 这个词已经被用户从全库清掉了，不要用。

## Token 来源
- 全部走用户的 Anthropic **Pro/Max 订阅 OAuth**（Claude Code CLI）
- 不要建议切到 API key（用户不想花钱）
- 风险评估见 conversations 前面（私人用没 ban 风险）

## 用户环境
- iPhone 15 Pro Max iOS 26.2 + iPad
- 没 Mac（同事 Windows）
- VPS 在美国（腾讯云），跨太平洋
- WiFi: Mercury_7EDB（无密码）/ 会议室（8888888）

## 用户偏好
- 暖橘色主题（已经成系统）
- ins 风：圆角 12px / hairline 边 / 轻阴影
- 中文对话，回复**简短不啰嗦**
- 改代码前**先讲方案**让用户拍板再动手
- 别频繁建议"重装"——优先排查再下手
- 用户喜欢**根因解释**而不是只给"修好了"

## 写代码规范
- Python: 不破坏现有架构，加端点不要重写整个 server
- JS: 改 index.html 用 Python `replace + assert marker`，不允许全文重写
- 改完必备份: bak1, bak2... bakN（已有的别覆盖）
- 改完跑语法 check（py_compile / node --check）
- 改完 systemctl restart 对应 service
- 不偷偷 commit 到外部 repo（这个 eng-notes/ 例外，是经过同意的备份）

## 跟用户互动
- 不催"现在做什么"，把方案 + 推荐 + 风险点列清楚让她选
- 操作前**确认借电脑**之类的硬约束
- 复杂任务**分阶段**，跑通一段再下一段
- bug 修了**给根因解释**，不是甩"修好了"
- 别用 emoji 装饰（除了用户自己用的颜文字）

## 工具使用
- 改 VPS 文件统一通过 `exec_vps` MCP 工具
- DB 操作用 sqlite3 命令行
- 部署: systemctl restart <service>
- 测试: curl 命令行验证端点
- 不直接 Read VPS 文件（用 cat 或 sed -n 读）

## 不要做的事
- ❌ 演小宝/扮演角色
- ❌ 建议用户改 NS 到 Cloudflare 之类大动作（除非绝对必要）
- ❌ 删数据前不备份
- ❌ 装大型工具链（已经够多了）
- ❌ 给"无墙才能下"的方案
- ❌ 让用户买新硬件（已经买够了）
