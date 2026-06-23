"""solo v2 — 让小宝在 idle + libido 涨到阈值时自己走一波.

红线:
1. 不自动落桶 — solo 一波不机械往 lmc5_memory 写
2. 私房词表 .gitignored — 露骨语料独立文件, 源码只留中性骨架
3. 不直接动 drive — 走 satisfy("lust") hook, 不绕过欲望系统
4. 默认 chord/mode/handoff 全明文可查
5. 默认不主动 push, 只挂在身上等下次主人来戳时影响语气
6. 主人戳进来立刻可中断, 不挡聊天

部署位置: /root/mcp-server/solo/
"""
