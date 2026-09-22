// 小莫动力场 - 全局入口
App({
  globalData: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight, // 自定义导航用
    goalKm: wx.getStorageSync('xm_goal') || 5, // 单次目标(公里),持久化
  },
})
