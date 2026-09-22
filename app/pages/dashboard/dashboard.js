const bt = require('../../bluetooth/index');
const store = require('../../utils/store');
const { fmtTime } = require('../../utils/format');
const { ZONES, zoneForWatts, getFTP } = require('../../utils/zones');
const oplog = require('../../utils/oplog');
const { MAX_RESISTANCE } = require('../../utils/protocol');

const SPARK_MAX = 60; // 曲线保留采样数
const TICKS = Array.from({ length: MAX_RESISTANCE }, (_, i) => i + 1);

Page({
  data: {
    connected: false, deviceName: '', isMock: bt.isMock,
    running: false,
    watts: 0, zone: ZONES[0], zonePct: 0, zones: ZONES,
    status: { speed: '0.0', cadence: 0, kcal: 0, distance: '0.00' },
    session: { timeText: '00:00', dist: '0.00', progPct: 0 },
    goalKm: getApp().globalData.goalKm,
    resistance: 1,
    maxRes: MAX_RESISTANCE,
    ticks: TICKS,
    pressed: null,
    mainBtnText: '开始运动',
    showStop: false,
  },

  spark: null, ring: null,
  localSpeeds: [],

  onLoad() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight });
    bt.connect({}).then(info => {
      this.setData({ connected: true, deviceName: info.name, resistance: bt.getCurrentResistance() });
    }).catch(e => {
      oplog.add('conn_fail', (e && e.errMsg) || '自动连接失败');
      // 模拟器/未开蓝牙会走到这里;用户点「连接机器」可重试
    });
    // mock/真机统一的数据入口:bluetooth 层不直接推帧给页面,
    // 这里用 500ms 视图刷新循环读取 session.last
    this.viewTimer = setInterval(() => this.render(), 500);
  },

  onShow() {
    this.setData({ goalKm: getApp().globalData.goalKm });
  },

  onUnload() { clearInterval(this.viewTimer); },

  // ---- 视图渲染(500ms) ----
  render() {
    const s = bt.session;
    const last = s.last;
    const running = s.state !== 'idle';
    if (last && s.state === 'running') {
      this.localSpeeds.push(last.speed);
      if (this.localSpeeds.length > SPARK_MAX) this.localSpeeds.shift();
    }
    const watts = running ? (s.watts || 0) : 0;
    const ftp = getFTP();
    const z = zoneForWatts(Math.max(watts, 1), ftp); // 0W 也归 Z1
    this.setData({
      running,
      watts,
      zone: z,
      zonePct: Math.round(watts / ftp * 100),
      status: {
        speed: (last ? last.speed : 0).toFixed(1),
        cadence: last ? last.cadence : 0,
        kcal: Math.round(s.kcal),
        distance: s.distance.toFixed(2),
      },
      session: {
        timeText: fmtTime(s.elapsed),
        dist: s.distance.toFixed(2),
        progPct: Math.min(100, Math.round(s.distance / this.data.goalKm * 100)),
      },
      mainBtnText: s.state === 'running' ? '暂 停' : s.state === 'paused' ? '继 续' : '开始运动',
      showStop: s.state !== 'idle',
    });
    if (running && !this.spark) this.initSpark(); // hero 内 canvas 随 wx:if 出现
    this.drawSpark();
    this.drawRing(z);
  },

  // ---- canvas 初始化 ----
  onReady() { this.initRing(); },

  initCanvas(id) {
    return new Promise(resolve => {
      wx.createSelectorQuery().in(this)
        .select(id).fields({ node: true, size: true })
        .exec(res => {
          if (!res[0] || !res[0].node) return resolve(null);
          const { node, width, height } = res[0];
          const dpr = wx.getWindowInfo().pixelRatio;
          node.width = width * dpr; node.height = height * dpr;
          const ctx = node.getContext('2d');
          ctx.scale(dpr, dpr);
          resolve({ ctx, w: width, h: height });
        });
    });
  },

  async initSpark() {
    this.spark = await this.initCanvas('#spark');
    this.drawSpark();
  },
  async initRing() {
    this.ring = await this.initCanvas('#ring');
    this.drawRing(this.data.zone);
  },

  // ---- 速度曲线(紫底白线) ----
  drawSpark() {
    if (!this.spark) return;
    const { ctx, w, h } = this.spark;
    ctx.clearRect(0, 0, w, h);
    const pts = this.localSpeeds;
    if (pts.length < 2) return;
    const max = Math.max(...pts, 5) * 1.1;
    const step = w / (SPARK_MAX - 1);
    const x0 = w - (pts.length - 1) * step; // 右对齐

    ctx.beginPath();
    pts.forEach((v, i) => {
      const x = x0 + i * step, y = h - (v / max) * (h - 8) - 4;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 渐变填充
    ctx.lineTo(x0 + (pts.length - 1) * step, h); ctx.lineTo(x0, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fill();
  },

  // ---- 环形距离进度(色随当前 Zone) ----
  drawRing(z) {
    if (!this.ring) return;
    const { ctx, w, h } = this.ring;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, r = w / 2 - 12;
    const pct = Math.min(1, bt.session.distance / this.data.goalKm);
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1B1E26';
    ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.stroke();
    if (pct > 0) {
      ctx.strokeStyle = z.color;
      ctx.beginPath();
      ctx.arc(cx, cx, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }
  },

  // ---- 主控 ----
  mainAction() {
    if (!bt.isConnected()) {  // 未连接 → 重试连接,不做假开始
      wx.showToast({ title: '正在连接机器…', icon: 'none' });
      bt.connect({}).then(info => {
        this.setData({ connected: true, deviceName: info.name, resistance: bt.getCurrentResistance() });
      }).catch(e => {
        oplog.add('conn_fail', (e && e.errMsg) || '连接失败');
        wx.showToast({ title: '连接失败,靠近机器重试', icon: 'none' });
      });
      return;
    }
    const s = bt.session;
    if (s.state === 'idle') {
      bt.resetSession(); bt.start();
      this.localSpeeds = [];
    } else if (s.state === 'running') {
      bt.pause();
    } else if (s.state === 'paused') {
      bt.resume();
    }
    this.render();
  },

  stopAction() {
    const rec = bt.stop();
    if (rec && rec.durationSec > 5) {
      const saved = store.addWorkout(rec);
      this.localSpeeds = [];
      wx.navigateTo({ url: `/pages/workout-detail/workout-detail?id=${saved.id}&just=1` });
    } else {
      wx.showToast({ title: '运动太短,未保存', icon: 'none' });
    }
    this.render();
  },

  // ---- 阻力:加减大按键,双段震动(按下 light + 档位 medium 顿挫,键盘段落手感) ----
  resPress(e) {
    this.setData({ pressed: e.currentTarget.dataset.dir }); // 立刻点亮手指所在的按钮
    wx.vibrateShort({ type: 'light' }); // 按下瞬间,轻
  },
  resRelease() {
    this.setData({ pressed: null });
  },
  resUp() { this.setResistance(this.data.resistance + 1); },
  resDown() { this.setResistance(this.data.resistance - 1); },

  // UI + 顿挫震动;BLE 命令 250ms 防抖。课程引擎自动调阻也走这里。
  setResistance(r) {
    if (!bt.isConnected()) { wx.showToast({ title: '请先连接机器', icon: 'none' }); return; }
    r = Math.min(MAX_RESISTANCE, Math.max(1, r));
    if (r === this.data.resistance) return; // 到边界不震不转
    oplog.add('res', `目标 L${r}`);
    this.setData({ resistance: r });
    wx.vibrateShort({ type: 'medium' }); // 档位咬合,顿挫
    clearTimeout(this._resDebounce);
    this._resDebounce = setTimeout(() => bt.sendResistance(r), 250);
  },
});
