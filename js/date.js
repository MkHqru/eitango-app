// 日付の取得は必ずこの today() を経由する（new Date() を直接使わない）。
// 後の Issue で「デモ用に日付を進める機能」をここに追加する。
(function () {
  'use strict';

  function today() {
    return new Date();
  }

  // 'YYYY-MM-DD' 形式の文字列にする
  function formatDate(date) {
    var m = String(date.getMonth() + 1);
    var d = String(date.getDate());
    return date.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (d.length < 2 ? '0' + d : d);
  }

  window.today = today;
  window.formatDate = formatDate;
})();
