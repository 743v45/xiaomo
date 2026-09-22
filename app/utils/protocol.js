// 小莫 MOBI000401 真实协议(docs/PROTOCOL.md,2026-09-22 iPad HCI 实抓验证)
// 帧头 0xAB;状态帧 16B(FFE4 notify,1Hz);阻力命令 7B(FFE3 write);档位 1~24。

const MAX_RESISTANCE = 24;

// 阻力命令:AB 03 00 0B 13 [LEVEL] 01
function buildResistance(level) {
  const lv = Math.max(1, Math.min(MAX_RESISTANCE, Math.round(level)));
  return [0xAB, 0x03, 0x00, 0x0B, 0x13, lv, 0x01];
}

// 状态帧:AB 04 15 0B 13 64 01 [采样4B大端] 00 00 [档位] 00
// 踩踏采样强度:intensity/100 ≈ km/h(初版标定系数,待精调)
const INTENSITY_TO_KMH = 0.01;

function parseStatus(b) {
  if (!b || b.length < 15 || b[0] !== 0xAB) return null;
  const u = i => b[i] & 0xFF;
  const intensity = (b[7] << 24 | b[8] << 16 | b[9] << 8 | u(10)) >>> 0; // 4B 大端
  const resistance = u(13);
  const speed = +(intensity * INTENSITY_TO_KMH).toFixed(1); // 待标定
  return {
    type: b[1],
    intensity,
    speed,                       // 由强度换算(标定系数待精调)
    cadence: Math.round(speed * 6), // 估算步频(待标定)
    resistance,
    kcal: null, distance: null,  // 机器不上报,由 app 本地积分
  };
}

// 已废弃的 qdomyos 老协议(0xF0/26B/1-15 档)不再使用,历史见 git。
const NOOP = null; // 本协议无心跳要求(实抓未见保活帧)

module.exports = { MAX_RESISTANCE, buildResistance, parseStatus, INTENSITY_TO_KMH, NOOP };
