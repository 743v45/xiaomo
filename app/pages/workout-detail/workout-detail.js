const store = require('../../utils/store');
const { fmtTime, fmtDate } = require('../../utils/format');

Page({
  data: { statusBarHeight: 0 },
  onLoad(query) {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight });
    const w = store.getWorkout(query.id);
    if (!w) { wx.showToast({ title: '记录不存在', icon: 'none' }); return; }
    this.rec = w;
    this.setData({
      just: query.just === '1',
      dateText: fmtDate(w.ts),
      distanceKm: w.distanceKm.toFixed(2),
      durationText: fmtTime(w.durationSec),
      kcal: w.kcal,
      avgSpeed: w.avgSpeed.toFixed(1),
      maxSpeed: w.maxSpeed.toFixed(1),
      avgCadence: Math.round(w.avgCadence),
      avgWatts: w.avgWatts || 0,
    });
  },
  goBack() { wx.navigateBack({ delta: 1 }); },
  onReady() {
    wx.createSelectorQuery().in(this)
      .select('#trace').fields({ node: true, size: true })
      .exec(res => {
        if (!res[0] || !this.rec) return;
        const { node, width, height } = res[0];
        const dpr = wx.getWindowInfo().pixelRatio;
        node.width = width * dpr; node.height = height * dpr;
        const ctx = node.getContext('2d');
        ctx.scale(dpr, dpr);

        const pts = this.rec.speedTrace || [];
        if (pts.length < 2) return;
        const max = Math.max(...pts, 5) * 1.1;
        const step = width / (pts.length - 1);
        ctx.beginPath();
        pts.forEach((v, i) => {
          const x = i * step, y = height - (v / max) * (height - 16) - 8;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = '#EEFF00';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'transparent';
        ctx.stroke();
      });
  },
});
