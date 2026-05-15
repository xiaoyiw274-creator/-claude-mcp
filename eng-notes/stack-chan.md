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
- 会议室 / 88888888

## 待做（v0.2）
- OTA 推送服务（手机网页推固件）
- Q 版头像（PNG → BMP 烧 flash → set_avatar 工具）
- 录音 → STT → /api/chat（小宝端语音对话闭环）
- 手机管理页（音量/表情/对话日志）

---

## 一键烧录 v0.1 编译流水线（2026-05-15 跑通）

固件源码：`/opt/stack-relay/firmware_src/stack_chan_xiaobao/`
Windows 烧录包成品：`https://mem.coolmbaby.top/uploads/xiaobao-flash-v0.1.zip`（13MB）

### 踩过的坑（重要！锁版本！）

1. **esp32 core v3.x 会强行下 563MB RISC-V toolchain**（CoreS3 是 xtensa 用不到）
   → 用 `esp32:esp32@2.0.17`，只装 xtensa（~90MB）
2. **ESP8266Audio v2.4.1 用了 IDF v5 新 i2s API**（`driver/i2s_std.h`），跟老 core 2.0.17 不兼容
   → 锁 `ESP8266Audio@1.9.7`
3. **esptool windows release 文件名是 `esptool-vX.Y.Z-windows-amd64.zip`**，不要凭印象用 `-win64.zip`
   → 外部 URL 一律先查 GitHub API：
     ```bash
     curl -s https://api.github.com/repos/espressif/esptool/releases/latest \
       | python3 -c "import sys,json; d=json.load(sys.stdin); [print(a['name'], a['browser_download_url']) for a in d['assets']]"
     ```

### 完整编译命令（按顺序）

```bash
export HOME=/root
# 一次性装环境
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh
arduino-cli config init --overwrite
arduino-cli config set board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32@2.0.17           # 关键：锁版本
arduino-cli lib install "M5Unified" "M5Stack_Avatar" "ArduinoJson" "WebSockets" "ESP32Servo"
arduino-cli lib install ESP8266Audio@1.9.7            # 关键：锁老版本

# 编译
cd /opt/stack-relay/firmware_src/stack_chan_xiaobao
arduino-cli compile --fqbn esp32:esp32:m5stack-cores3 --build-path /tmp/scbuild .

# 合并三块 bin 成单一 bin（烧到 0x0 一锅端）
ESPTOOL=/root/.arduino15/packages/esp32/tools/esptool_py/4.5.1/esptool.py
BOOT0=/root/.arduino15/packages/esp32/hardware/esp32/2.0.17/tools/partitions/boot_app0.bin
cd /tmp/scbuild
python3 $ESPTOOL --chip esp32s3 merge_bin \
  -o /tmp/firmware-merged.bin \
  --flash_mode dio --flash_freq 80m --flash_size 16MB \
  0x0     stack_chan_xiaobao.ino.bootloader.bin \
  0x8000  stack_chan_xiaobao.ino.partitions.bin \
  0xe000  $BOOT0 \
  0x10000 stack_chan_xiaobao.ino.bin
```

### Windows 烧录包打包

```bash
mkdir -p /tmp/xiaobao-flash
cp /tmp/firmware-merged.bin /tmp/xiaobao-flash/firmware.bin

# 抓 esptool Windows .exe（查 API 拿真实 URL）
URL=$(curl -s https://api.github.com/repos/espressif/esptool/releases/latest \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(a['browser_download_url']) for a in d['assets'] if 'windows-amd64' in a['name']]")
curl -sL "$URL" -o /tmp/esptool.zip
cd /tmp && unzip -o esptool.zip
cp /tmp/esptool-windows-amd64/esptool.exe /tmp/xiaobao-flash/

# 写 flash.bat（chcp 65001 切 UTF-8 输出，否则中文乱码）
# 写 README.txt（驱动链接 + 烧录步骤）
# 实际 .bat / .txt 内容见仓库或 zip 解压

cd /tmp && zip -r xiaobao-flash-v0.1.zip xiaobao-flash/
cp xiaobao-flash-v0.1.zip /opt/memory-v2/uploads/   # → mem.coolmbaby.top/uploads/ 可下载
```

### flash.bat 核心

```bat
"%~dp0esptool.exe" --chip esp32s3 --baud 921600 write_flash ^
  --flash_mode dio --flash_freq 80m --flash_size 16MB ^
  0x0 "%~dp0firmware.bin"
```
不传 `--port`，esptool 会自动检测 ESP 芯片连在哪个 COM 口。

### 烧录前置（Windows）

- WCH 串口驱动：https://www.wch-ic.com/downloads/CH343SER_EXE.html
- USB-C **数据线**（只充电那种不行）
