// 虚拟小莫:按人踩椭圆机的物理直觉模拟数据流
// 接口与 real.js 完全同构,MOCK=true 时由 index.js 分发到这里
const protocol = require('../utils/protocol');

const state = {
  connected: false,
  resistance: 1,
  speed: 0,
  cadence: 0,
  heart: 0,
  kcal: 0,
  distance: 0,
  sessionSec: 0,
  running: false,
  timer: null,
  cb: null,
  speedSamples: [],
};

function tick() {
  if (!state.running) return;
  const dt = 0.5; // 500ms

  // 速度模型:目标速度随阻力上升(1~24 档),带惯性渐近 + 微小踩踏波动
  const target = 5 + state.resistance * 0.85;
  state.speed += (target - state.speed) * 0.06;
  const wobble = Math.sin(Date.now() / 1700) * 0.4 + (Math.random() - 0.5) * 0.3;
  const spd = Math.max(0, state.speed + wobble);

  // 步频:与速度弱相关;心率:强度相关,带漂移
  state.cadence = Math.round(52 + spd * 3.2 + (Math.random() - 0.5) * 3);
  const hrTarget = 88 + state.resistance * 3.4 + spd * 2.2;
  state.heart = Math.round((state.heart || hrTarget) * 0.97 + hrTarget * 0.03);

  // 累计
  const watts = Math.round(8 + spd * 3.5 * (0.5 + state.resistance / 24));
  state.sessionSec += dt;

  state.speedSamples.push(+spd.toFixed(1));
  if (state.speedSamples.length > 60) state.speedSamples.shift();

  state.cb && state.cb({
    speed: +spd.toFixed(1),
    cadence: state.cadence,
    intensity: Math.round(spd * 100), // 与真机协议对齐:强度=速度×100
    resistance: state.resistance,
    heart: state.heart,
    watts, // 估算功率
    raw: null,
  });
}

module.exports = {
  isMock: true,
  connect({ onStatus, onDisconnect } = {}) {
    state.cb = onStatus;
    setTimeout(() => { state.connected = true; onDisconnect && onDisconnect(null); }, 700);
    return Promise.resolve({ name: 'MOBI000401 (虚拟)' });
  },
  disconnect() {
    clearInterval(state.timer); state.timer = null;
    state.connected = false; state.running = false;
  },
  startWorkout() {
    if (state.timer) return;
    state.running = true;
    state.timer = setInterval(tick, 500);
  },
  pauseWorkout() { state.running = false; },
  resumeWorkout() { state.running = true; },
  stopWorkout() {
    state.running = false;
    clearInterval(state.timer); state.timer = null;
    return {
      durationSec: Math.round(state.sessionSec),
      distanceKm: state.distance,
      kcal: state.kcal,
      speedTrace: [...state.speedSamples],
    };
  },
  reset() {
    state.speed = 0; state.cadence = 0; state.heart = 0;
    state.kcal = 0; state.distance = 0; state.sessionSec = 0;
    state.speedSamples = [];
  },
  sendResistance(level) {
    state.resistance = Math.min(24, Math.max(1, level));
  },
  getCurrentResistance() { return state.resistance; },
  _proto: protocol, // 调试用
};
