const config = require('../../utils/config');
const zones = require('../../utils/zones');

Page({
  data: {
    modeText: config.USE_MOCK ? '模拟数据(MOCK)' : '真机 BLE',
    goalKm: getApp().globalData.goalKm,
    ftp: zones.getFTP(),
    protoStatus: '帧定义已就绪,待真机抓包验证',
    statusBarHeight: 0,
  },
  onLoad() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight });
  },
  onFTPChange(e) {
    this.setData({ ftp: zones.setFTP(parseFloat(e.detail.value)) });
    wx.showToast({ title: 'FTP 已更新', icon: 'none' });
  },
  openOplog() {
    wx.navigateTo({ url: '/pages/oplog/oplog' });
  },
  onGoalChange(e) {
    const v = Math.max(0.5, parseFloat(e.detail.value) || 5);
    getApp().globalData.goalKm = v;
    wx.setStorageSync('xm_goal', v); // 持久化
    this.setData({ goalKm: v });
  },
});
