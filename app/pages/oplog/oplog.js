const oplog = require('../../utils/oplog');
const { TYPES } = require('../../utils/oplog');

Page({
  data: { list: [], statusBarHeight: 0 },
  onLoad() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight });
  },
  onShow() { this.refresh(); },
  refresh() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const list = oplog.list().map(x => {
      const t = new Date(x.ts);
      const tm = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
      const dy = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
      const meta = TYPES[x.type] || { icon: '•', label: x.type };
      return { ...x, icon: meta.icon, label: meta.label, timeText: dy === today ? `今天 ${tm}` : `${dy.slice(5)} ${tm}` };
    });
    this.setData({ list });
  },
  clearAll() {
    wx.showModal({
      title: '清空操作日志',
      content: '确定清空全部蓝牙操作记录?',
      success: r => { if (r.confirm) { oplog.clear(); this.refresh(); } },
    });
  },
  goBack() { wx.navigateBack({ delta: 1 }); },
});
