// 真机 BLE 层:微信小程序蓝牙 API 直连 MOBI000401
// 注意:开发者工具模拟器不支持 BLE,须真机预览调试;帧格式待协议验证后修正。
const config = require('../utils/config');
const proto = require('../utils/protocol');
const oplog = require('../utils/oplog');

const state = { device: null, writeChar: null, notifyChar: null, cb: null, res: 1, onDisc: null, onConnState: null };

function ab2arr(buf) { return Array.from(new Uint8Array(buf)); }

// 微信 API 包 Promise
function writeValue(deviceId, serviceId, charId, buf) {
  return new Promise((resolve, reject) =>
    wx.writeBLECharacteristicValue({ deviceId, serviceId, characteristicId: charId, value: buf, success: resolve, fail: reject }));
}

async function send(arr) {
  const deviceId = state.device.deviceId;
  for (let i = 0; i < arr.length; i += 20) {
    const buf = new Uint8Array(arr.slice(i, i + 20)).buffer;
    await writeValue(deviceId, config.SERVICE_UUID, config.CHAR_WRITE, buf);
  }
}

module.exports = {
  isMock: false,
  async connect({ onStatus } = {}) {
    state.cb = onStatus;
    await new Promise((ok, bad) => wx.openBluetoothAdapter({ success: ok, fail: bad }));
    // 扫描并按名字前缀过滤
    const found = await new Promise((ok) => {
      wx.onBluetoothDeviceFound(res => {
        const d = res.devices.find(x => (x.name || '').toUpperCase().startsWith(config.DEVICE_NAME_PREFIX));
        if (d) ok(d);
      });
      wx.startBluetoothDevicesDiscovery({ services: [config.SERVICE_UUID] });
    });
    state.device = found;
    emit('connecting');
    await new Promise((ok, bad) => wx.createBLEConnection({ deviceId: found.deviceId, success: ok, fail: bad }));
    // 微信 iOS 经典坑:连接后立刻服务发现会返回空,必须延迟
    await new Promise(ok => setTimeout(ok, 1200));
    const { serviceId } = await new Promise((ok, bad) =>
      wx.getBLEDeviceServices({ deviceId: found.deviceId, success: r => ok(r.services.find(s => s.uuid.toUpperCase() === config.SERVICE_UUID) || {}), fail: bad }));
    if (!serviceId) throw new Error('未找到 FFE0 服务,请重试');
    const chars = await new Promise((ok, bad) =>
      wx.getBLEDeviceCharacteristics({ deviceId: found.deviceId, serviceId, success: ok, fail: bad }));
    state.writeChar = (chars.characteristics.find(c => c.uuid.toUpperCase() === config.CHAR_WRITE)).uuid;
    state.notifyChar = (chars.characteristics.find(c => c.uuid.toUpperCase() === config.CHAR_NOTIFY)).uuid;

    wx.onBLECharacteristicValueChange(r => {
      const st = proto.parseStatus(ab2arr(r.value));
      if (st && state.cb) state.cb(st);
    });
    await new Promise((ok, bad) =>
      wx.notifyBLECharacteristicValueChange({ deviceId: found.deviceId, serviceId, characteristicId: state.notifyChar, state: true, success: ok, fail: bad }));

    // 真实协议(docs/PROTOCOL.md):连接后仅需订阅 FFE4,无初始化序列、无心跳、无启停命令
    oplog.add('conn', `已连接 ${found.name}`);
    wx.onBLEConnectionStateChange(r => {
      if (!r.connected) { state.writeChar = null; oplog.add('disc', '连接已断开'); state.onDisc && state.onDisc(); }
    });
    return { name: found.name };
  },
  setDisconnectHook(fn) { state.onDisc = fn; },
  disconnect() {
    if (state.device) wx.closeBLEConnection({ deviceId: state.device.deviceId });
    wx.closeBluetoothAdapter();
  },
  startWorkout() {},  // 真实协议:无启停命令,机器自动检测踩踏并上报(docs/PROTOCOL.md)
  pauseWorkout() {},
  resumeWorkout() {},
  stopWorkout() { return null; },
  reset() {},
  sendResistance(level) {
    state.res = Math.min(proto.MAX_RESISTANCE, Math.max(1, level));
    send(proto.buildResistance(state.res));
  },
  getCurrentResistance() { return state.res; },
};
