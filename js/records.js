// 回答の記録。「単語ID × 出題形式」ごとに保存する。
// 出題形式は 'en-ja'（英→日）/ 'ja-en'（日→英）/ 'fill'（例文穴埋め）の3種類で、それぞれ別々に管理する。
// 保存は js/storage.js 経由。キーは records:ユーザーID
// 記録の中身（段階・次に出題する日など）と間隔のルールは js/schedule.js を参照。
(function () {
  'use strict';

  function storageKey(userId) {
    return 'records:' + userId;
  }

  function getAll(userId) {
    return AppStorage.get(storageKey(userId)) || {};
  }

  // 未回答なら null
  function get(userId, wordId, format) {
    return getAll(userId)[Schedule.recordKey(wordId, format)] || null;
  }

  function save(userId, wordId, format, isCorrect) {
    var all = getAll(userId);
    var key = Schedule.recordKey(wordId, format);
    all[key] = Schedule.applyAnswer(all[key] || null, isCorrect, DateUtil.todayString());
    AppStorage.set(storageKey(userId), all);
    return all[key];
  }

  // その生徒の記録をまとめて保存する（サンプルデータを入れるとき）
  function setAll(userId, records) {
    AppStorage.set(storageKey(userId), records);
  }

  // その生徒の記録をすべて消す（先生が生徒を削除したとき）
  function clear(userId) {
    AppStorage.remove(storageKey(userId));
  }

  window.Records = { getAll: getAll, get: get, save: save, setAll: setAll, clear: clear };
})();
