# Stack Chan（M5Stack CoreS3 + 底座）

## 设备
- M5Stack CoreS3（ESP32-S3 + 2英寸屏 + 喇叭 + 双麦 + 摄像头 + 16M Flash + 8M PSRAM）
- 底座: 2 个舵机 + 700mAh 电池 + 12 RGB LED + 3 区触控 + NFC

## VPS 端（已搭好）
- `/opt/stack-relay/server.py` (FastAPI + uvicorn + websockets)
- :5181 端口，Caddy 反代 `chan.coolmbaby.top` 走 443
- 服务: `stack-relay.service`

### Endpoint
- `wss://chan.coolmbaby.top/ws` — Stack Chan WebSocket 连这里
- `POST https://chan.coolmbaby.top/mcp` — Claude.ai HTTPS MCP connector 加这里
- `GET /tts/{md5}.mp3` — Edge TTS 生成的 mp3（zh-CN-YunxiNeural 男声）
- `GET /firmware/stack_chan_xiaobao.zip` — 固件下载
- `GET /api/devices` — 看在线设备
- `GET /` — 服务状态

### MCP 工具（Claude.ai 控制 Stack Chan）
- `set_emotion(emotion)` neutral/happy/sad/angry/surprised/sleepy/love/wink
- `rotate_head(angle)` -90~+90
- `speak(text)` 走 Edge TTS → mp3 → 推 Stack Chan 播
- `wiggle(times)` 扭动
- `get_status` 查在线/电量

### 协议
WebSocket 上行帧:
- `{type:"hello", device_id, name}` 握手
- `{type:"state", state:{emotion, head_angle, battery}}` 状态上报
- `{type:"result", request_id, result:{text}}` 命令应答

下行帧:
- `{type:"ack", device_id}` 握手回应
- `{type:"cmd", request_id, cmd, params}` 命令下发

## 固件（待烧）
- 项目: `/opt/stack-relay/firmware_src/stack_chan_xiaobao/`
- 主文件: `stack_chan_xiaobao.ino`（含 WiFi + WebSocket + 舵机 + 音频播放）
- shim: `AudioOutputM5Speaker.h`
- README: 详细 Windows Arduino IDE 烧录步骤

### 烧录步骤摘要（同事 Windows）
1. 装 Arduino IDE 2.x
2. 加 M5Stack 开发板 URL，装 M5Stack 包
3. 装库: M5Unified, M5Stack-Avatar, ArduinoJson, WebSockets, ESP32Servo, ESP8266Audio
4. 工具→开发板→M5CoreS3，Flash 16MB，PSRAM OPI，Partition 16M
5. USB-C 接电脑，选 COM 端口，点上传

### WiFi 配置（已写死在 .ino）
- Mercury_7EDB（无密码）
- 会议室 / 8888888

## 待做（v0.2）
- OTA 推送服务（手机网页推固件）
- Q 版头像（PNG → BMP 烧 flash → set_avatar 工具）
- 录音 → STT → /api/chat（小宝端语音对话闭环）
- 手机管理页（音量/表情/对话日志）
