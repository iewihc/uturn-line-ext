// 台灣地址工具（同 right-admin src/utils/addressUtils.ts、taiwanDistricts.ts）：
// 派單文字 vs Google 上車地址的門牌比對、行政區位置、去掉開頭「郵遞區號＋台灣」。
const DISTRICTS_BY_COUNTY = {
  基隆市: "仁愛區 中正區 信義區 中山區 安樂區 暖暖區 七堵區",
  臺北市: "中正區 大同區 中山區 松山區 大安區 萬華區 信義區 士林區 北投區 內湖區 南港區 文山區",
  新北市: "板橋區 汐止區 深坑區 石碇區 瑞芳區 平溪區 雙溪區 貢寮區 新店區 坪林區 烏來區 永和區 中和區 土城區 三峽區 樹林區 鶯歌區 三重區 新莊區 泰山區 林口區 蘆洲區 五股區 八里區 淡水區 三芝區 石門區 金山區 萬里區",
  桃園市: "桃園區 中壢區 平鎮區 八德區 楊梅區 蘆竹區 大溪區 龍潭區 龜山區 大園區 觀音區 新屋區 復興區",
  新竹市: "東區 北區 香山區",
  新竹縣: "竹北市 竹東鎮 新埔鎮 關西鎮 湖口鄉 新豐鄉 芎林鄉 橫山鄉 北埔鄉 寶山鄉 峨眉鄉 尖石鄉 五峰鄉",
  苗栗縣: "苗栗市 苑裡鎮 通霄鎮 竹南鎮 頭份市 後龍鎮 卓蘭鎮 大湖鄉 公館鄉 銅鑼鄉 南庄鄉 頭屋鄉 三義鄉 西湖鄉 造橋鄉 三灣鄉 獅潭鄉 泰安鄉",
  臺中市: "中區 東區 南區 西區 北區 北屯區 西屯區 南屯區 太平區 大里區 霧峰區 烏日區 豐原區 后里區 石岡區 東勢區 和平區 新社區 潭子區 大雅區 神岡區 大肚區 沙鹿區 龍井區 梧棲區 清水區 大甲區 外埔區 大安區",
  彰化縣: "彰化市 鹿港鎮 和美鎮 線西鄉 伸港鄉 福興鄉 秀水鄉 花壇鄉 芬園鄉 員林市 溪湖鎮 田中鎮 大村鄉 埔鹽鄉 埔心鄉 永靖鄉 社頭鄉 二水鄉 北斗鎮 二林鎮 田尾鄉 埤頭鄉 芳苑鄉 大城鄉 竹塘鄉 溪州鄉",
  南投縣: "南投市 埔里鎮 草屯鎮 竹山鎮 集集鎮 名間鄉 鹿谷鄉 中寮鄉 魚池鄉 國姓鄉 水里鄉 信義鄉 仁愛鄉",
  雲林縣: "斗六市 斗南鎮 虎尾鎮 西螺鎮 土庫鎮 北港鎮 古坑鄉 大埤鄉 莿桐鄉 林內鄉 二崙鄉 崙背鄉 麥寮鄉 東勢鄉 褒忠鄉 臺西鄉 元長鄉 四湖鄉 口湖鄉 水林鄉",
  嘉義市: "東區 西區",
  嘉義縣: "太保市 朴子市 布袋鎮 大林鎮 民雄鄉 溪口鄉 新港鄉 六腳鄉 東石鄉 義竹鄉 鹿草鄉 水上鄉 中埔鄉 竹崎鄉 梅山鄉 番路鄉 大埔鄉 阿里山鄉",
  臺南市: "新營區 鹽水區 白河區 柳營區 後壁區 東山區 麻豆區 下營區 六甲區 官田區 大內區 佳里區 學甲區 西港區 七股區 將軍區 北門區 新化區 善化區 新市區 安定區 山上區 玉井區 楠西區 南化區 左鎮區 仁德區 歸仁區 關廟區 龍崎區 永康區 東區 南區 北區 安南區 安平區 中西區",
  高雄市: "鹽埕區 鼓山區 左營區 楠梓區 三民區 新興區 前金區 苓雅區 前鎮區 旗津區 小港區 鳳山區 林園區 大寮區 大樹區 大社區 仁武區 鳥松區 岡山區 橋頭區 燕巢區 田寮區 阿蓮區 路竹區 湖內區 茄萣區 永安區 彌陀區 梓官區 旗山區 美濃區 六龜區 甲仙區 杉林區 內門區 茂林區 桃源區 那瑪夏區",
  屏東縣: "屏東市 潮州鎮 東港鎮 恆春鎮 萬丹鄉 長治鄉 麟洛鄉 九如鄉 里港鄉 鹽埔鄉 高樹鄉 萬巒鄉 內埔鄉 竹田鄉 新埤鄉 枋寮鄉 新園鄉 崁頂鄉 林邊鄉 南州鄉 佳冬鄉 琉球鄉 車城鄉 滿州鄉 枋山鄉 三地門鄉 霧臺鄉 瑪家鄉 泰武鄉 來義鄉 春日鄉 獅子鄉 牡丹鄉",
  宜蘭縣: "宜蘭市 羅東鎮 蘇澳鎮 頭城鎮 礁溪鄉 壯圍鄉 員山鄉 冬山鄉 五結鄉 三星鄉 大同鄉 南澳鄉",
  花蓮縣: "花蓮市 鳳林鎮 玉里鎮 新城鄉 吉安鄉 壽豐鄉 光復鄉 豐濱鄉 瑞穗鄉 富里鄉 秀林鄉 萬榮鄉 卓溪鄉",
  臺東縣: "臺東市 成功鎮 關山鎮 卑南鄉 大武鄉 太麻里鄉 東河鄉 長濱鄉 鹿野鄉 池上鄉 綠島鄉 延平鄉 海端鄉 達仁鄉 金峰鄉 蘭嶼鄉",
};
// 縣市 → 行政區（長的先比，避免「東區」先吃掉更長的名稱）
const COUNTY_DISTRICTS = Object.entries(DISTRICTS_BY_COUNTY).map(([county, names]) => [county, names.split(" ").sort((a, b) => b.length - a.length)]);

// 地址中緊接在縣市後面的行政區位置（例：臺中市「北區」）；對不到回 null。「台」先轉「臺」（同長度，位置不變）
function findDistrictRange(address) {
  const normalized = String(address || "").replaceAll("台", "臺");
  for (const [county, districts] of COUNTY_DISTRICTS) {
    for (let at = normalized.indexOf(county); at !== -1; at = normalized.indexOf(county, at + 1)) {
      const start = at + county.length;
      const district = districts.find((d) => normalized.startsWith(d, start));
      if (district) return { start, end: start + district.length };
    }
  }
  return null;
}

// 門牌寫法統一後再比：70-1、70之1、70－1 是同一個號碼
const normalizeAddressNumber = (v) => v.replace(/[－‐−之]/g, "-");
const NUMBER_PATTERNS = [
  { regex: /(\d+(?:[-－‐−之]\d+)?)巷/g, type: "lane" },
  { regex: /(\d+(?:[-－‐−之]\d+)?)弄/g, type: "alley" },
  { regex: /(\d+(?:[-－‐−之]\d+)?號(?:之\d+)?)/g, type: "number" },
  { regex: /([B]?\d+(?:[-－‐−之]\d+)?)樓/g, type: "floor" },
  { regex: /([A-Z]?\d+)室/g, type: "room" },
];
function extractAddressNumbers(address) {
  const segments = [];
  for (const { regex, type } of NUMBER_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    for (let m = re.exec(address); m !== null; m = re.exec(address)) segments.push({ type, value: m[1], position: m.index, length: m[0].length });
  }
  return segments.sort((a, b) => a.position - b.position);
}
// 派單文字 vs Google 上車地址：回傳 Google 地址中門牌不一致的片段（空陣列＝一致或無法比較）。任一方沒門牌（可能是地點名稱）不比
function getPickupAddressMismatchSegments(oriText, pickupAddress) {
  if (!oriText || !pickupAddress) return [];
  const s1 = extractAddressNumbers(oriText), s2 = extractAddressNumbers(pickupAddress);
  if (!s1.length || !s2.length) return [];
  const out = [];
  for (const type of ["lane", "alley", "number", "floor", "room"]) {
    const a = s1.find((s) => s.type === type), b = s2.find((s) => s.type === type);
    if ((a || b) && (!a || !b || normalizeAddressNumber(a.value) !== normalizeAddressNumber(b.value)) && b) out.push(b);
  }
  return out;
}
// Google 地址開頭的「郵遞區號＋台灣」（407台灣、411020臺灣）；沒郵遞區號時只在後面接縣市才算，避免誤砍「台灣大道」
const POSTAL_COUNTRY_PREFIX = /^\s*(?:\d{3,6}\s*(?:台灣|臺灣)|(?:台灣|臺灣)(?=\S{2}[縣市]))\s*/;
const stripPostalCountryPrefix = (address) => String(address || "").replace(POSTAL_COUNTRY_PREFIX, "");

// 依行政區與門牌不一致片段的邊界切段：[{ text, district, mismatch }]
function splitAddressPieces(address, mismatch = []) {
  const district = findDistrictRange(address);
  const marks = mismatch.map((s) => ({ start: s.position, end: s.position + s.length }));
  const cuts = new Set([0, address.length]);
  for (const r of [...marks, ...(district ? [district] : [])]) { cuts.add(Math.max(0, Math.min(address.length, r.start))); cuts.add(Math.max(0, Math.min(address.length, r.end))); }
  const points = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [start, end] = [points[i], points[i + 1]];
    if (start === end) continue;
    pieces.push({ text: address.slice(start, end), district: !!district && start >= district.start && end <= district.end, mismatch: marks.some((m) => start >= m.start && end <= m.end) });
  }
  return pieces;
}

export { findDistrictRange, getPickupAddressMismatchSegments, splitAddressPieces, stripPostalCountryPrefix };
