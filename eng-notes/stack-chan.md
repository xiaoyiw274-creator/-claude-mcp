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

### WiFi 配置（写死在 .ino，v0.4.5 列表）
- `mstldt01` / `mstldt0001` — 公司主
- `Mercury_7EDB` — 家里（无密码）
- `会议室` / `88888888` — 公司会议室备用
- `小铭的板砖` / `888888888` — 手机热点兜底

**手机热点务必切 2.4GHz**（iPhone 设置→个人热点→打开"最大兼容性"；安卓在热点高级里选 2.4GHz）。ESP32-S3 + esp32 core 2.0.17 不支持 5GHz / WPA3，连不上手机热点 90% 是这两个原因。

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
     curl -s https://api.github.com/repos/espressif/esptool/releases/latest | python3 -c "import sys,json; d=json.load(sys.stdin); [print(a['name'], a['browser_download_url']) for a in d['assets']]"
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

# 写 flash.bat（GBK 兼容: chcp 65001 切 UTF-8 输出）
# 写 README.txt（驱动链接 + 烧录步骤）
# 见 /opt/eng-notes 仓库里的实际文件

cd /tmp && zip -r xiaobao-flash-v0.1.zip xiaobao-flash/
cp xiaobao-flash-v0.1.zip /opt/memory-v2/uploads/   # → memory.coolmbaby.top/uploads/ 可下载
```

### flash.bat 核心

```bat
"%~dp0esptool.exe" --chip esp32s3 --baud 921600 write_flash \
  --flash_mode dio --flash_freq 80m --flash_size 16MB \
  0x0 "%~dp0firmware.bin"
```
不传 `--port`，esptool 会自动检测 ESP 芯片连在哪个 COM 口。

### 烧录前置（Windows）

- WCH 串口驱动：https://www.wch-ic.com/downloads/CH343SER_EXE.html
- USB-C **数据线**（只充电那种不行）

---

## v0.4.4 修复总结（2026-05-18，跨多窗口踩坑后定版）

**部署位置**: `/root/web/flash/`（Caddy 走 `coolmbaby.top/flash/` 浏览器 esp-web-tools 一键烧录）
- `firmware.bin` — 合并镜像（bootloader@0x0 + partitions@0x8000 + boot_app0@0xe000 + app@0x10000）
- `manifest.json` — esp-web-tools manifest，`offset:0` 单 part
- `index.html` — 烧录页（点 Connect → Install）

源码: `/opt/stack-relay/firmware_src/stack_chan_xiaobao/stack_chan_xiaobao.ino`

**老备份**: `.v36`（v0.3 最后稳定版，舵机能动）、`.v41`（v0.4.0/4.1 boot loop 版本，作为反例参考）

### v0.4.0~0.4.3 一直黑屏闪烁 = boot loop 的根因

`avatar.init()` 被放在 setup() 早期。Avatar 库会 spawn 一个 FreeRTOS task 持续刷脸到 sprite/SPI（README 原话: "Some applications may reboot due to insufficient stack size for other tasks"）。

setup 后面紧跟 `connectWiFi()` 大量 `M5.Display.fillScreen/printf` + `downloadFaces()` 6 张 HTTPS JPG（mbedtls 握手每个吃 ~16-24KB 栈 + 64KB PSRAM 解码 buffer）→ 跟 Avatar task 抢栈/抢 SPI bus → panic reboot → boot loop → 屏幕一闪一闪。

**v36 跑得动是因为代码体积小，整体内存压力低。V4.x 加了麦克风/触摸/OTA 后整体涨上来，Avatar 一启动就翻车。**

修法（v0.4.4）：
- **`avatar.init()` 必须放在 setup 最末**（在 connectWiFi + downloadFaces + ws.beginSSL 全部跑完之后）
- setup 全程 `STEP(n, "msg")` 宏打 Serial + 打印 heap/psram，下次 crash 一眼看出在哪步
- `Serial.begin(115200)` 必须在 setup 第一行，不然前几行打点丢失

### WiFi 一直跳 "trying" 死等的根因 + 修法

老版 `connectWiFi()` 不预扫，每个 WIFI_LIST 项无脑 `WiFi.begin` + 10 秒超时。SSID 不在范围时 = 死等 10s × N。loop 里 `if (status != CONNECTED) connectWiFi()` 还反复触发。

修法（v0.4.4）：
- `WiFi.scanNetworks(false, false, false, 400)` 先扫一遍
- 不可见的 SSID 直接 `continue`，省 10s
- 可见的 try 7s（14×500ms）不连上就换下个
- 连上后 `WiFi.setAutoReconnect(true) + persistent(true)`，断线 ESP 自己重连
- loop 重连节流：30s 最多一次

### 舵机不动的三联锅（v0.1 一路抄到 v0.4.3 都有！）

| # | 锅 | 后果 |
|---|---|---|
| 1 | `SERVO_PAN=8, SERVO_TILT=9`（Port B） | Stack-chan 底座舵机插 **Port A**（G1/G2），Port B 引脚不对 + Port B 没 5V |
| 2 | `M5.Power.setExtOutput(true)` 被删 | Port A 5V 没开 = 舵机断电 |
| 3 | 缺 `ESP32PWM::allocateTimer(0)` + `setPeriodHertz(50)` | ESP32-S3 上 ESP32Servo 必须先分配 timer 设 50Hz，否则 PWM 频率乱，舵机看不懂 |

**正确的 setup 三件套**（v36 有，必须保留）：
```cpp
M5.Power.setExtOutput(true);      // Port A 5V 给舵机
ESP32PWM::allocateTimer(0);        // 关键：S3 必须分配 timer
servoPan.setPeriodHertz(50);       // 50Hz 标准舵机频率
servoTilt.setPeriodHertz(50);
servoPan.attach(SERVO_PAN, 500, 2400);
servoTilt.attach(SERVO_TILT, 500, 2400);
servoPan.write(90);
servoTilt.write(90);
```

### 底座 12 RGB LED — 当前固件根本没写

出厂演示固件能让灯闪是底座固件干的，跟主板 ESP32 关系两说。当前我们这套 .ino 里**完全没有 LED / NeoPixel / FastLED 控制代码**，所以 MCP 发什么命令灯都不会亮。

待做（v0.5）:
- 查底座 schematic 确认 LED 是 SK6812/WS2812 串联还是走 I2C 给个 LP5562
- 若是 NeoPixel: `Adafruit_NeoPixel` 库 + 加个 `setLED(r,g,b)` MCP 工具
- 若是 I2C: 走 M5Stack 官方底座驱动

### 一键编译 + 合并 + 部署（v0.4.4 流程）

```bash
# 编译
cd /opt/stack-relay/firmware_src/stack_chan_xiaobao
rm -rf /tmp/scbuild_vX
arduino-cli compile --fqbn esp32:esp32:m5stack-cores3 --build-path /tmp/scbuild_vX .

# 合并
ESPTOOL=/root/.arduino15/packages/esp32/tools/esptool_py/4.5.1/esptool.py
BOOT0=/root/.arduino15/packages/esp32/hardware/esp32/2.0.17/tools/partitions/boot_app0.bin
cd /tmp/scbuild_vX
python3 $ESPTOOL --chip esp32s3 merge_bin \
  -o /tmp/firmware-merged-vX.bin \
  --flash_mode dio --flash_freq 80m --flash_size 16MB \
  0x0     stack_chan_xiaobao.ino.bootloader.bin \
  0x8000  stack_chan_xiaobao.ino.partitions.bin \
  0xe000  $BOOT0 \
  0x10000 stack_chan_xiaobao.ino.bin

# 部署到浏览器烧录页
cp /root/web/flash/firmware.bin /root/web/flash/firmware.prev.bin.bak
cp /tmp/firmware-merged-vX.bin /root/web/flash/firmware.bin
# 改 manifest.json version 和 index.html 标题
```

### 验证镜像格式（防止再烧不动）

```bash
# 三个偏移必须分别是 bootloader/partition/app 的 magic
dd if=/root/web/flash/firmware.bin bs=1 count=4 | xxd      # 期望 e9 03 02 ..
dd if=/root/web/flash/firmware.bin bs=1 skip=32768 count=4 | xxd  # 期望 aa 50 01 02
dd if=/root/web/flash/firmware.bin bs=1 skip=65536 count=4 | xxd  # 期望 e9 05 02 ..
```

---

## 2026-05-20 决定性切换：kisaragi-mochi/stackchan-mcp

**今晚验证：M5Stack 官方 Stack-chan 套件 = SCS0009 串行总线舵机（不是 PWM）。之前所有 Arduino + ESP32Servo PWM 代码全是空炮，舵机根本听不懂。** 详情页明确写"带反馈的舵机"已经暗示了——PWM 标准舵机不带反馈。

### 切换后状态（全部验证 work）

| 工具 | 测试结果 |
|---|---|
| set_all_leds (RGB 全亮红) | ✓ {"available":true,"ok":true} 物理 12 颗灯亮 |
| move_head yaw=30 pitch=45 | ✓ servo_init_ok=true 头物理转到 yaw=21° pitch=42° |
| set_avatar happy | ✓ 屏幕表情切换 |
| get_device_info | ✓ 返回电池/WiFi/音量/亮度 |
| get_head_angles | ✓ 返回当前角度，跟 move_head 一致 |

23 个 MCP 工具齐全：
- 硬件: move_head, set_all_leds/set_led/set_leds/clear_leds, set_avatar/set_mouth/set_blink, set_brightness, set_volume
- 诊断: gpio_test, uart_diag, check_vm_en, set_servo_torque, set_auto_torque_release
- 音视频: say, listen, take_photo
- 状态: get_status, get_device_info, get_head_angles, get_touch_state

### 部署细节（明天 / 下次窗口直接复用）

**固件**: kisaragi-mochi/stackchan-mcp firmware-v1.7.0
- 镜像: `/root/web/flash-xz/merged-binary.bin` (9.98MB)
- 烧录页: `https://coolmbaby.top/flash-xz/`
- ESP-IDF v5.5.2, esp-web-tools 浏览器一键烧
- AP 模式 SSID: `Xiaozhi-<MAC末4位>`, IP 192.168.4.1

**Gateway**:
- pkg: `pip install stackchan-mcp` v0.8.0
- venv: `/opt/stackchan-mcp-gw/venv/`
- 因为是 stdio MCP, 必须用 mcp-proxy 包装成 SSE 才能 systemd daemon 化
- systemd: `stackchan-gw.service` (用 ExecStart `mcp-proxy --port 8767 --host 0.0.0.0 --pass-environment --allow-origin "*" -- stackchan-mcp`)
- env file: `/etc/stackchan-mcp/gateway.env`
- 监听: `:8765` ESP32 WebSocket, `:8766` HTTP capture, `:8767` MCP SSE/HTTP

**Token (设备配置 + gateway 共享)**: `xiaobao_4298bb8fe69494f4` (gateway.env 里 STACKCHAN_TOKEN)

**Caddy 反代**:
```
handle_path /xz/ws*       → :8765   (设备 WebSocket)
handle /xz/capture*       → :8766/capture  (拍照上传)
handle /xz/sse*           → :8767/sse  (MCP SSE for Claude.ai)
handle /xz/messages*      → :8767/messages (MCP SSE callback)
```

**设备 AP 模式填的两条配置**:
- WebSocket URL: `wss://chan.coolmbaby.top/xz/ws`
- Bearer Token: `xiaobao_4298bb8fe69494f4`

### 已知问题 (待修)

1. **设备 14-21 秒 idle 后主动断 WS** — xiaozhi 设计就这样, 想发命令必须先 reset 触发连接。**修法**: gateway 端加 ws keep-alive ping, 或者 patch xiaozhi firmware (改 NVS / kconfig idle_timeout)
2. **Claude.ai SSE callback URL** — mcp-proxy 发的 `/messages/?session_id=` 路径没带 /xz 前缀, 走 chan.coolmbaby.top 根路径会落到老 stack-relay。修法: Caddy 加 /messages* 也反代到 :8767, 或换子域名独占
3. **server.py auto-speak 还在禁用状态** — `/opt/stack-relay/server.py.before_kill_autospeak` 是备份。kisaragi 切换后老 stack-relay 实际不再用, 可以恢复或彻底退役

### 老 Arduino 自研栈 (v0.5.1) 状态

- `/root/web/flash/firmware*.bin` 都保留作为 fallback
- 老 stack-relay.service 还在跑 :5181
- 老 MCP server `/mcp` 端点还在
- 如果 kisaragi 用着不舒服可以 esp-web-tools 烧回 v0.5.1 (但舵机/LED 都不会动)
