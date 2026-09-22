// 运动记录存储(本地 storage,永不依赖云)
const KEY = 'xm_workouts';

function getWorkouts() {
  return wx.getStorageSync(KEY) || [];
}

function addWorkout(w) {
  const list = getWorkouts();
  const rec = {
    id: 'w' + Date.now(),
    ts: Date.now(),
    durationSec: w.durationSec || 0,
    distanceKm: +(w.distanceKm || 0).toFixed(2),
    kcal: Math.round(w.kcal || 0),
    avgSpeed: +(w.avgSpeed || 0).toFixed(1),
    maxSpeed: +(w.maxSpeed || 0).toFixed(1),
    avgCadence: Math.round(w.avgCadence || 0),
    avgResistance: +(w.avgResistance || 0).toFixed(1),
    // 最近 60 个速度采样点(供详情页画曲线)
    speedTrace: (w.speedTrace || []).slice(-60),
  };
  list.unshift(rec);
  wx.setStorageSync(KEY, list.slice(0, 200));
  return rec;
}

function getWorkout(id) {
  return getWorkouts().find(w => w.id === id) || null;
}

function weeklySummary() {
  const now = Date.now();
  const weekAgo = now - 7 * 86400e3;
  const ws = getWorkouts().filter(w => w.ts >= weekAgo);
  return {
    count: ws.length,
    distanceKm: +ws.reduce((a, w) => a + w.distanceKm, 0).toFixed(1),
    kcal: ws.reduce((a, w) => a + w.kcal, 0),
    durationSec: ws.reduce((a, w) => a + w.durationSec, 0),
  };
}

module.exports = { getWorkouts, addWorkout, getWorkout, weeklySummary };

// 按天聚合(最近 n 天):日报
function dailySummary(n) {
  const map = {};
  getWorkouts().forEach(w => {
    const d = new Date(w.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), count: 0, dist: 0, kcal: 0, dur: 0, wSum: 0 };
    const o = map[key];
    o.count++; o.dist += w.distanceKm; o.kcal += w.kcal; o.dur += w.durationSec; o.wSum += (w.avgWatts || 0);
  });
  return Object.values(map).sort((a, b) => b.ts - a.ts).slice(0, n)
    .map(o => ({ ...o, dist: +o.dist.toFixed(2), dur: Math.round(o.dur), avgW: o.count ? Math.round(o.wSum / o.count) : 0 }));
}

// 按月聚合(最近 n 个月):月报
function monthlySummary(n) {
  const map = {};
  getWorkouts().forEach(w => {
    const d = new Date(w.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), count: 0, dist: 0, kcal: 0, dur: 0, days: {} };
    const o = map[key];
    o.count++; o.dist += w.distanceKm; o.kcal += w.kcal; o.dur += w.durationSec;
    o.days[d.getDate()] = 1;
  });
  return Object.values(map).sort((a, b) => b.ts - a.ts).slice(0, n)
    .map(o => ({ ...o, dist: +o.dist.toFixed(2), dur: Math.round(o.dur), activeDays: Object.keys(o.days).length }));
}

module.exports.dailySummary = dailySummary;
module.exports.monthlySummary = monthlySummary;
