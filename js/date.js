// 日付の処理はすべてこのファイルにまとめる。
// 今日の日付の取得は必ず today() を経由する（ほかのファイルで new Date() を直接使わない）。
//
// デモ用の日付操作：today() は「本当の今日 + ずらす日数」を返す。
// ずらす日数は js/storage.js 経由で保存するので、再読み込みしても残る（デモデータのリセットで 0 に戻る）。
(function () {
  'use strict';

  var OFFSET_KEY = 'demoDayOffset';
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  // ---- デモ用の日付操作 ----
  function getOffset() {
    var v = window.AppStorage ? AppStorage.get(OFFSET_KEY) : 0;
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function setOffset(days) {
    if (days) AppStorage.set(OFFSET_KEY, days);
    else AppStorage.remove(OFFSET_KEY);
  }

  // 今日の日付（デモ用にずらした日数を含む）
  function today() {
    var d = new Date(); // 本当の今日を取得するのはここだけ
    d.setDate(d.getDate() + getOffset());
    return d;
  }

  // ---- 日付の計算（'YYYY-MM-DD' 形式の文字列で扱う）----
  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function todayString() {
    return formatDate(today());
  }

  // 'YYYY-MM-DD' → Date（その日の0時）
  function parseDate(str) {
    var p = String(str).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  // str の n 日後（n がマイナスなら前）
  function addDays(str, n) {
    var d = parseDate(str);
    d.setDate(d.getDate() + n);
    return formatDate(d);
  }

  // from から to まで何日か
  function diffDays(from, to) {
    return Math.round((parseDate(to) - parseDate(from)) / 86400000);
  }

  // 画面表示用：2026年11月23日（月）
  function displayDate(str) {
    var d = parseDate(str);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WEEKDAYS[d.getDay()] + '）';
  }

  window.today = today;
  window.formatDate = formatDate;
  window.DateUtil = {
    todayString: todayString,
    addDays: addDays,
    diffDays: diffDays,
    displayDate: displayDate
  };
  window.DemoDate = {
    getOffset: getOffset,
    setOffset: setOffset,
    add: function (days) { setOffset(getOffset() + days); },
    reset: function () { setOffset(0); }
  };
})();
