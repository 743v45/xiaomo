# 小莫椭圆机 BLE 协议逆向

> 背景:小莫已倒闭停服,原版 iPad app 仍可蓝牙直连机器 → 蓝牙本地直连、不依赖云。
> 目标:逆向 BLE 协议 → 自研 app 复刻本地功能(实时数据、阻力控制、本地记录)。
> 抓包文件放 `captures/`,分析脚本放 `scripts/`。

## 实测 GATT 表(2026-09-22,iPad nRF Connect)

- 设备名:`MOBI000401`,广播服务:`FFE0`
- **判定:私有协议**(表中无 0x1826 FTMS / 0x2ACE Cross Trainer Data)

| Service | Characteristic | 属性 | 角色 |
|---|---|---|---|
| 0x1800 | — | — | Generic Access(标准) |
| 0x1801 | — | — | Generic Attribute(标准) |
| **FFE0** | **FFE3** | Write, Write Without Response | **app→机器 命令通道** |
| | **FFE4** | Notify (+0x2902 CCCD) | **机器→app 数据通道** |
| 0x180A | 2A29/2A24/2A25/2A27/2A26 | Read | 厂商/型号/序列号/硬件/固件版本(**待读取**) |
| 0xFE59 | 8EC90003-F31B-… | Write, Indicate | Nordic Buttonless DFU(**勿动,变砖风险**) |

### 关键推论

1. **通道已锁定**:FFE3/FFE4 为典型"串口透传"结构。命令协议 = FFE3 的字节格式(待抓包破解),数据协议 = FFE4 的字节格式。
2. **主控芯片为 Nordic nRF52 系列**(0xFE59 Secure DFU + buttonless 特征是 Nordic SDK 标志)。
   - 深挖后路:抓包卡壳时可走固件层面分析(勿在未了解 DFU 包来源前触发升级)。
3. `MOBI + 5位数字` 为方案商固件命名,GitHub / 全网检索无现成逆向成果,自研。
4. 待办:读 0x180A 各项字符串,厂商名可能直接暴露方案公司,便于搜通用协议。

## 抓包 SOP(2026-09-22 确认走 iPad HCI 路线)

> 路线 A(Mac 装 iOS 版小莫 + PacketLogger)失败:app 已从 App Store 下架。
> 已知协议草图来自 qdomyos-zwift(已 clone 至 `~/Code/opensource/qdomyos-zwift`,
> ChangYow 帧实现见 `src/devices/domyoselliptical/domyoselliptical.cpp` 的 `btinit_changyow`);
> 另有 ChangYow 官方 app 反编译 `~/Code/opensource/iconsoleplus-app-diff`。

### 一次性准备

1. iPad 数据线连 Mac,打开 Xcode 让其识别设备(触发开发者菜单出现)
2. 设置 → 隐私与安全性 → 开发者模式 → 开启 → 重启
3. **恢复小莫 app 蓝牙权限**(协议探测阶段曾关闭):设置 → 隐私与安全性 → 蓝牙 → 小莫运动 → 开
4. 杀掉 nRF Connect,避免抢占连接

### 每次抓包

1. 设置 → 搜索框搜「HCI」→ 开启蓝牙 HCI 抓包日志 → 开关一次蓝牙(日志仅记录开关之后)
2. 小莫 app 复现,每个操作间隔 ≥5 秒(备忘录记时刻更佳):
   连接(t1) → 开始+踩 30 秒(t2) → 阻力调特殊值 8(t3) → 暂停/继续(t4) → 断开(t5)
3. 设置 → 隐私与安全性 → 分析与改进 → 分析数据 → 按时间找最新含 bluetooth/hci 的文件 → 分享 → AirDrop 到 `captures/`

### 解析(拿到文件后)

`tshark -r <file> -Y "btatt"` → 对照协议草图:FFE3 Write = 命令(验证 F0 帧头/和校验/阻力帧),
FFE4 Notification = 26 字节状态帧(速度@6-7 步频@9 卡路里@10-11 距离@12-13 阻力@14 心率@18 坡度@21)。

## 后续里程碑

- [ ] 读出 0x180A 设备信息字符串 ✅(ChangYow / SI0027 / 固件 01)
- [x] **小程序 App v0.1**(2026-09-22):`app/` 目录,微信原生框架,HUD 竞技仪表风
      4 tab(运动/训练/历史/我的)+ 运动详情;mock 数据驱动,`utils/config.js` 的
      `USE_MOCK=false` 切真机;协议帧定义与 `scripts/protocol-console.html` 同源
- [x] **协议破译完成(2026-09-22)**:iPad HCI 实抓成功 → 帧头 0xAB(非 qdomyos 0xF0!),
  状态帧 16B@1Hz(FFE4)、阻力命令 7B 斜坡下发(FFE3)、**档位 1~24**、无启停命令。
  完整文档:**docs/PROTOCOL.md**;App 已切换到真实协议(protocol.js 重写,USE_MOCK=false 即真机可用)。
  待标定:踩踏采样值→速度/功率换算系数(现用 intensity/100≈km/h 初版)。
- [x] **Web 版控制端(2026-09-22)**:`web/index.html` 单文件零依赖,Mac Chrome 打开即用。
  真实协议(0xAB/24 档/斜坡下发)+ 卡通 3D 风格 + 全功能(Zone 仪表/课程/历史/FTP 设置),
  本地存储 `xm_web_workouts`。访问:`http://localhost:8321/web/index.html`(服务:`python3 -m http.server 8321`)。
- [ ] 小程序切 `USE_MOCK=false`,手机微信真机直连椭圆机验证
- [ ] Node/浏览器直连真机重放"调阻力"命令验证
- [ ] 自研 app 最终形态(协议验证后补全)
