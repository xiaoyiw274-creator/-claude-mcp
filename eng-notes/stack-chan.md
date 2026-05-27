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

见 `bug-history.md` #17。简要: `avatar.init()` 早期调用 spawn FreeRTOS task → 跟 connectWiFi/downloadFaces 抢栈/SPI → panic → 屏幕循环亮灭。修法：avatar.init 挪到 setup 最末。

### WiFi 一直跳 "trying" 死等的根因 + 修法

见 `bug-history.md` #18。简要: 不预扫，每个 SSID 死等 10s。修法：先 `WiFi.scanNetworks` 跳不可见的。

### 舵机不动的三联锅

见 `bug-history.md` #19。简要: 引脚错(Port B vs Port A) + `setExtOutput(true)`被删 + 缺 `ESP32PWM::allocateTimer(0)`。

### 底座 12 RGB LED — 当前固件根本没写

出厂演示固件能让灯闪是底座固件干的，跟主板 ESP32 关系两说。当前 .ino 里**完全没有 LED / NeoPixel / FastLED 控制代码**，所以 MCP 发什么命令灯都不会亮。

待做 v0.5: 查底座 schematic 确认 LED 协议，加 setLED MCP 工具。

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

## 2026-05-19 大踩坑：OTA HTTPS 下载在 290KB 处必断（v0.4.5 → v0.5.1 推不上）

**症状**: 设备 v0.4.5 跑得动 (能录音/能 set_emotion/能 ack)，但 ota_update 推 v0.5.1 firmware_app.bin (1.23MB) 时设备只下到 ~290KB 就 WS disconnect，48 秒后 Caddy 端记录到 size:294912 不完整。Update.end(true) 没跑 → 不切分区 → 设备 reboot 回 v0.4.5 → 又跑 downloadFaces → 屏幕"loading faces"循环 → 又崩 → 又 reboot loop。

**根因**: doOTA() 用 WiFiClientSecure + http.GET + Update.writeStream(http.getStream())。HTTPS 长流 1.2MB 在 ESP32-S3 + mbedtls + Avatar/Audio task 并发下：
- mbedtls SSL 上下文吃栈 16-24KB
- Avatar task 持续吃 PSRAM/SPI
- Heap 碎片化随时间累积
- 290KB 处某次 ssl_read 失败 → connection drop → Update.writeStream 写到一半 → 函数返回不调 Update.end → restart 走 ota_0 老分区

**修法（v0.5.2 待做）**: 
- doOTA 期间先 `avatar.suspend()` + 暂停 audio task，释放 CPU 给 socket
- 或改走 HTTP 不走 HTTPS（要 Caddy 加 :80 直传 /flash/ 路径）
- 或 chunked 读：循环 stream.readBytes 累计写 Update.write，每 32KB sleep 一下让 mbedtls 喘息

**临时绕过**: 必须用电脑 USB + esp-web-tools 烧 v0.5.1 merged 镜像一次，之后才有干净版本能 OTA 推。

**经验总结**: ESP32 OTA 推大于 ~256KB 的 bin 文件走 HTTPS 在 Arduino 内存管理下不可靠。要么先减小 firmware，要么走 HTTP，要么 OTA 时主动释放其他 task 资源。

## v0.4.5 设备稳定能跑的 + 不能跑的

| 功能 | 状态 |
|---|---|
| WiFi scan + 连接 | ✓ |
| WS + MCP cmd 双向 | ✓ |
| set_emotion / get_status | ✓ ack 正常 |
| rotate_head ack 回 | ✓ |
| 舵机物理转动 | ✗ Port A G1/G2 = I2C 抢 PWM (v0.5.1 改 G8/G9 修) |
| 触屏录音 → STT | ✓ |
| LLM 回 → auto-speak → 设备崩 reboot | ✗ 已在 server.py 临时禁了 auto-speak |
| 手动 speak → mp3 播放 | ✗ 设备崩 reboot (待修 v0.5.2) |
| LED | ✗ 固件根本没 LED 代码 (待加 v0.6) |
| 中文气泡文字 | ✓ avatar lgfx 自带 efont (之前我误判) |

## server.py 临时改动 (2026-05-19)

- 文件: `/opt/stack-relay/server.py.before_kill_autospeak` 是原版备份
- 注释掉了两条 `await send_to_device(device_id, "speak", ...)`:
  1. STT 失败兜底回复"我没听清"
  2. LLM 回复后自动 speak
- 改成 `print("[voice] would speak (suppressed): ...")` 仅日志不下发
- **恢复**: `cp server.py.before_kill_autospeak server.py && systemctl restart stack-relay` (当 speak 修了 mp3 崩溃问题后)

## 评估过的替代方案：小智 esp32-server

- 仓库: xinnan-tech/xiaozhi-esp32-server
- 框架: esp-idf 5.5.2 + Docker 编译
- 优点: 13 个 MCP 工具齐 (含 LED/音量/亮度/拍照/视觉)、内存管理更稳
- 缺点: 完全重写, 之前 19 个 bug 经验作废, 至少一整天工作量
- 暂不切换, 先稳住当前 v0.5.1

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

---

## 2026-05-21 重大发现：xiaozhi 设备"按需在线"机制

**症状**: 设备 idle 显示平常脸（黄圆 ´･_･`）时，server 端看是**离线**（ws 断开）。Claude.ai 调任何工具都报 "No ESP32 device connected"。

**真相**: xiaozhi-esp32 固件设计就是**按需连接**:
- 进 listening 状态 → 连 ws → 设备在线 (server 能调 MCP 工具)
- 退出 listening / 进 idle → 自动断 ws 省电

**触发上线的方法**:
- 摸屏幕 (FT6336U 触摸) → 进 listening → 上线
- 唤醒词 (本地 wake word 检测) → 进 listening → 上线
- listen MCP 工具 fire → server 主动让 firmware 进 listening (但这要设备已经在线才能 fire)

**Catch-22**: server 想让设备进 listening 拿到长连 → 但设备此刻不在线根本收不到 listen 命令 → 死循环。**唯一突破口**是用户**物理摸屏幕**或喊唤醒词。

**keepalive 守护进程没用**:
- 之前 /opt/stackchan-mcp-gw/keepalive.py 每 8s fire get_status, 想维持长连
- 但 ws 是设备主动连, gateway 不能反向唤醒已断连的设备
- 当设备退出 listening 断 ws 后, keepalive 看到的就是 "device offline"

**摸头反馈 (Si12T 3 zones tap/stroke) 在 idle 状态下也没响应** — 推测 firmware 进 deep sleep 后 touch 轮询也停了, 或 kisaragi 改了 handler 流程要求设备 ws 在线才生效。

**实际用户使用模式 (最实用)**:
```
1. 想交互时 -> 摸屏幕一下唤醒
2. 设备进 listening (黄圆脸 + 顶部"聆听中") -> ws 连上
3. 5 秒内去 Claude.ai 调工具 ("让小宝转头/拍照/说话")
4. 期间 firmware 保持 ws 在线
5. 工具调完一段时间没动静 -> firmware 自动退 listening 断 ws
6. 下次想用 -> 重复步骤 1
```

**长期解 (要么周末做)**:
- Path A: 部署 xinnan-tech/xiaozhi-esp32-server -> 实现完整 voice loop + push 机制 -> 设备能被远程唤醒不靠摸
- Path B: 改 kisaragi firmware kconfig -> 让 ws 常连不断 -> 但费电

**出厂体验对比**:
- 出厂连 xiaozhi.me 云: 云能 push 通知 -> 设备时不时被唤醒做 idle motion + 表情变化 -> 显得"活着"
- kisaragi gateway: 没实现 push -> 设备只在 listening 期间活, 其他时间真正断线

---

## 部署关键 patches 列表 (踩坑后定版, 下个窗口 Claude 务必看)

1. **EdgeTTS 适配** (`/opt/stackchan-mcp-gw/venv/lib/python3.11/site-packages/stackchan_mcp/tts/edge_engine.py`)
   - 自写 50 行 adapter, 把 EdgeTTS (zh-CN-YunxiNeural 云希男声) 注册成 "edge" engine
   - patch `tts/__init__.py` 加 `_register_edge`
   - patch `tts/orchestrator.py` `DEFAULT_VOICE = "edge"` (不再走默认 voicevox 日语)
   - 装 `pip install stackchan-mcp[tts]` 拿到 opuslib

2. **take_photo 返回 ImageContent** (`stackchan_mcp/stdio_server.py`)
   - 默认 take_photo 只返回 image_path string -> Claude.ai 拿不到图片
   - patch 让 take_photo 特殊处理: 读图 + base64 + 返回 `ImageContent(type="image", data=b64, mimeType="image/jpeg")`
   - Claude.ai 收到 ImageContent -> 自动喂 Claude vision -> 看图答问

3. **STT default 中文 + small 模型**
   - 改 `stt/faster_whisper.py` `DEFAULT_FASTER_WHISPER_MODEL = "small"` (准确度比 base 翻倍)
   - 改 `stdio_server.py` listen tool schema `language default "ja" -> "zh"`
   - 装 `pip install stackchan-mcp[stt-faster-whisper]` 拿 ctranslate2 / faster_whisper / onnxruntime

4. **Caddy 根路径反代** (Claude.ai SSE 必须)
   - `/etc/caddy/Caddyfile` chan.coolmbaby.top 段
   - `/sse` -> :8767 (Claude.ai MCP connector URL)
   - `/messages*` -> :8767 (SSE callback URL, mcp-proxy 给的是根路径不带 /xz)

5. **mcp-proxy systemd unit** (`/etc/systemd/system/stackchan-gw.service`)
   - ExecStart 必须用 `--` 隔离 positional command (不然 `--allow-origin "*"` 贪心吃掉 stackchan-mcp 路径)
   - mcp-proxy 同时跑: SSE (:8767/sse) + stackchan-mcp stdio child
   - stackchan-mcp 内部还开: :8765 (ESP32 ws) + :8766 (capture HTTP)

6. **Token**: `xiaobao_4298bb8fe69494f4` (env `/etc/stackchan-mcp/gateway.env`)

7. **设备 AP 配置**:
   - WebSocket URL: `wss://chan.coolmbaby.top/xz/ws`
   - Bearer Token: 同上

8. **Claude.ai MCP connector URL**: `https://chan.coolmbaby.top/sse`
