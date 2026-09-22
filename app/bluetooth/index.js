// 蓝牙同构层:MOCK 开关分发。页面只 import 本文件,不感知 mock/真机差异。
// session(单次运动的累计统计)在此层维护,页面切换不丢数据。
const config = require('../utils/config');
const { estWatts } = require('../utils/zones');
const oplog = require('../utils/oplog');
const bt = config.USE_MOCK ? require('./mock') : require('./real');

const session = {
  state: 'idle', // idle | running | paused
  elapsed: 0,
  distance: 0,
  kcal: 0,
  maxSpeed: 0,
  speedSum: 0, speedN: 0, cadenceSum: 0,
  resistanceSum: 0, resistanceN: 0,
  wattsSum: 0, wattsN: 0, watts: 0,
  speedTrace: [],
  last: null, // 最近一帧状态
  timer: null,
};

function tickSec() {
  if (session.state !== 'running') return;
  session.elapsed += 1;
}

function onFrame(st) {
  if (session.state !== 'running') return;
  // 统一本地积分:距离/卡路里/功率(真机 0xAB 帧不携带这些字段,mock 帧亦统一走此路径)
  const now = Date.now();
  const dt = session._t ? Math.min(2, (now - session._t) / 1000) : 0.5;
  session._t = now;
  if (st.watts == null) st.watts = estWatts(st.speed, st.resistance);
  session.last = st;
  session.distance += (st.speed / 3600) * dt;
  session.kcal += st.watts * dt / 3600 * 0.86;
  session.watts = st.watts;
  session.maxSpeed = Math.max(session.maxSpeed, st.speed);
  session.speedSum += st.speed; session.speedN++;
  session.cadenceSum += st.cadence;
  session.wattsSum += st.watts; session.wattsN++;
  if (st.resistance > 0) { session.resistanceSum += st.resistance; session.resistanceN++; }
  session.speedTrace.push(st.speed);
  if (session.speedTrace.length > 600) session.speedTrace.shift();
}

module.exports = {
  isMock: bt.isMock,
  session,
  isConnected() { return !!session.connected; },
  connect(opts) {
    session.timer = setInterval(tickSec, 1000);
    if (bt.setDisconnectHook) bt.setDisconnectHook(() => { session.connected = false; });
    return bt.connect({ ...opts, onStatus: onFrame }).then(info => {
      session.connected = true;
      return info;
    });
  },
  disconnect() { clearInterval(session.timer); if (session.connected) oplog.add('disc', '主动断开'); session.connected = false; bt.disconnect(); },
  start() { bt.startWorkout(); session.state = 'running'; oplog.add('start', '开始记录'); },
  pause() { bt.pauseWorkout(); session.state = 'paused'; oplog.add('pause'); },
  resume() { bt.resumeWorkout(); session.state = 'running'; oplog.add('resume'); },
  stop() {
    bt.stopWorkout();
    session.state = 'idle';
    clearInterval(session.timer); session.timer = null;
    const rec = {
      durationSec: session.elapsed,
      distanceKm: session.distance,
      kcal: session.kcal,
      avgSpeed: session.speedN ? session.speedSum / session.speedN : 0,
      maxSpeed: session.maxSpeed,
      avgCadence: session.speedN ? session.cadenceSum / session.speedN : 0,
      avgResistance: session.resistanceN ? session.resistanceSum / session.resistanceN : 0,
      avgWatts: session.wattsN ? Math.round(session.wattsSum / session.wattsN) : 0,
      speedTrace: session.speedTrace.slice(-60),
    };
    this.resetSession();
    oplog.add('stop', `结束 · ${rec.durationSec}s · ${rec.distanceKm.toFixed(2)}km`);
    return rec;
  },
  resetSession() {
    session.state = 'idle'; session.elapsed = 0; session.distance = 0; session.kcal = 0;
    session.maxSpeed = 0; session.speedSum = 0; session.speedN = 0; session.cadenceSum = 0;
    session.resistanceSum = 0; session.resistanceN = 0; session.speedTrace = []; session.last = null;
    session.wattsSum = 0; session.wattsN = 0; session.watts = 0;
    bt.reset();
  },
  sendResistance(level) { return bt.sendResistance(level); },
  getCurrentResistance() { return bt.getCurrentResistance(); },
};
