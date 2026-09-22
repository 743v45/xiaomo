const store = require('../../utils/store');
const { fmtTime, fmtDate } = require('../../utils/format');

Page({
  data: { seg: 'detail', week: {}, list: [], daily: [], monthly: [], statusBarHeight: 0 },
  onLoad() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight });
  },
  onShow() {
    const w = store.weeklySummary();
    const list = store.getWorkouts().map(x => ({
      ...x,
      dateText: fmtDate(x.ts),
      durationText: fmtTime(x.durationSec),
    }));
    this.setData({
      week: { ...w, min: Math.round(w.durationSec / 60) },
      list,
      daily: store.dailySummary(30),
      monthly: store.monthlySummary(12),
    });
  },
  setSeg(e) { this.setData({ seg: e.currentTarget.dataset.s }); },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/workout-detail/workout-detail?id=${e.currentTarget.dataset.id}` });
  },
});
