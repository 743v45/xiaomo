// 功率区间体系(Power Zone)
// Zone 定义:Coggan 功率区间(FTP 百分比);色阶为全产品固定视觉骨架(design.md §1.6)
const ZONES = [
  { id: 1, name: '恢复', en: 'RECOVERY', min: 0, max: 55, color: '#9CA3AF' },
  { id: 2, name: '耐力', en: 'ENDURANCE', min: 56, max: 75, color: '#3B82F6' },
  { id: 3, name: '节奏', en: 'TEMPO', min: 76, max: 90, color: '#22C55E' },
  { id: 4, name: '阈值', en: 'THRESHOLD', min: 91, max: 105, color: '#EEFF00' },
  { id: 5, name: '最大摄氧', en: 'VO2 MAX', min: 106, max: 120, color: '#F97316' },
  { id: 6, name: '无氧', en: 'ANAEROBIC', min: 121, max: 150, color: '#EF4444' },
  { id: 7, name: '神经肌肉', en: 'NEUROMUSCULAR', min: 151, max: 9999, color: '#B91C1C' },
];

const FTP_KEY = 'xm_ftp';
const DEFAULT_FTP = 150; // W,新手椭圆机量级,「我的」页可调

function getFTP() {
  return wx.getStorageSync(FTP_KEY) || DEFAULT_FTP;
}
function setFTP(v) {
  wx.setStorageSync(FTP_KEY, Math.max(50, Math.min(500, Math.round(v) || DEFAULT_FTP)));
  return getFTP();
}

// FTP 百分比 → Zone
function zoneForPct(pct) {
  return ZONES.find(z => pct >= z.min && pct <= z.max) || ZONES[0];
}
function zoneForWatts(watts, ftp) {
  return zoneForPct(Math.round(watts / (ftp || getFTP()) * 100));
}

// 功率估算:机器只上报速度+阻力(qdomyos 同款估算法,待协议验证后精化)
function estWatts(speedKmh, resistance) {
  return Math.round(8 + speedKmh * 3.5 * (0.5 + resistance / 24));
}

module.exports = { ZONES, getFTP, setFTP, zoneForPct, zoneForWatts, estWatts, DEFAULT_FTP };
