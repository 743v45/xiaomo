// 蓝牙操作日志(语义级事件:连接/断开/阻力/会话),本地存储,上限 500 条
const KEY = 'xm_oplog';

function add(type, detail) {
  const list = wx.getStorageSync(KEY) || [];
  list.unshift({ ts: Date.now(), type, detail: detail || '' });
  wx.setStorageSync(KEY, list.slice(0, 500));
}

function list() { return wx.getStorageSync(KEY) || []; }

function clear() { wx.setStorageSync(KEY, []); }

// 类型 → 展示(图标 + 中文名)
const TYPES = {
  conn: { icon: '🔗', label: '连接成功' },
  conn_fail: { icon: '⚠️', label: '连接失败' },
  disc: { icon: '✂️', label: '断开连接' },
  res: { icon: '🎚', label: '设置阻力' },
  start: { icon: '▶️', label: '开始运动' },
  pause: { icon: '⏸', label: '暂停' },
  resume: { icon: '⏯', label: '继续' },
  stop: { icon: '⏹', label: '结束运动' },
};

module.exports = { add, list, clear, TYPES };
