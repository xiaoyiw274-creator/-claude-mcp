# SillyTavern Bark Push

ST 前端扩展。生成完成时通过 [Bark](https://github.com/Finb/Bark) 把通知推到 iPhone。

## 工作原理

监听 ST 的 `GENERATION_ENDED` 事件,取最新一条 AI 消息,`fetch(api.day.app/{key}/{角色名}/{前30字})` 推到 Bark。CORS 用 `mode: 'no-cors'` 绕开——浏览器照样把 GET 发出去,Bark 收到就推,只是 JS 这边读不到响应(也不需要)。

## 安装

```
cd <SillyTavern>/public/scripts/extensions/third-party/
git clone <this repo> sillytavern-bark
```

刷新 ST 页面,在右栏 Extensions 抽屉里找 **📱 Bark 推送**,填 Key,点测试。

## 选项

- 启用 / 停用
- 仅在 ST 标签页不在前台时推送(默认开,自己在看时不打扰)
- Bark Key(iPhone 装 Bark app 后首页复制)
- 服务端(默认 `https://api.day.app`,自建 Bark 可改)
- 预览长度(默认 30)

## 备注

- 纯前端,不需要 server-side plugin,也不用动 `config.yaml`
- 监听 `GENERATION_ENDED`(流式/非流式都会触发),用 `chat[chat.length-1]` 拿最新消息
- 同一条消息不会重复推(`last_pushed_index` 去重)
