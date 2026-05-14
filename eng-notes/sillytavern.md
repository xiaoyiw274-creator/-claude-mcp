# SillyTavern（酒馆）

## 路径
- `/opt/SillyTavern/`
- 配置: `/opt/SillyTavern/config.yaml`
- 数据: `/opt/SillyTavern/data/default-user/`

## 访问
- 外部: `https://st.coolmbaby.top`（Caddy 反代到 :8000，强缓存 + gzip）
- 内部: `http://127.0.0.1:8000`
- Basic Auth: `xiaoyi / yse0415`
- 服务: `sillytavern.service`，跑 `bash start.sh`，里面 `node server.js --disableCsrf`

## 关键配置
```yaml
listen: true
port: 8000
basicAuthMode: true
basicAuthUser: {username: xiaoyi, password: yse0415}
cors:
  enabled: true
  origin: [null, https://st.coolmbaby.top, http://coolmbaby.top:8000]
  methods: [OPTIONS, GET, POST, PUT, DELETE]
  credentials: true
performance:
  lazyLoadCharacters: true
  requestCompression.enabled: true
securityOverride: false  # CSRF 通过启动参数 --disableCsrf 关掉
```

## 修过的关键问题
- **慢**：跨太平洋 + max-age=0 → Caddy 加 7 天浏览器缓存（*.js/*.css 等）
- **保存失败**：CSRF token 因为反代失效 → 启动加 `--disableCsrf`
- **CORS origin 默认只 "null"** → 加上 st.coolmbaby.top

## 角色卡目录
- 在用: `/opt/SillyTavern/data/default-user/characters/`（72 张）
- 备份: `characters_backup/`
- 聊天: `chats/`
