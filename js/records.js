// 回答の記録。「単語ID × 出題形式」ごとに保存する。
// 出題形式は 'en-ja'（英→日）/ 'ja-en'（日→英）/ 'fill'（例文穴埋め）の3種類で、それぞれ別々に管理する。
// 保存は js/storage.js 経由。キーは records:ユーザーID
// 中身の例：{ "20-01|fill": { correct: 1, wrong: 0, lastAnswered: "2026-11-23", lastResult: true } }
(function () {
  'use strict';

  function storageKey(userId) {
    return 'records:' + userId;
  }

  function recordKey(wordId, format) {
    return wordId + '|' + format;
  }

  function getAll(userId) {
    return AppStorage.get(storageKey(userId)) || {};
  }

  // 未回答なら null
  function get(userId, wordId, format) {
    return getAll(userId)[recordKey(wordId, format)] || null;
  }

  function save(userId, wordId, format, isCorrect) {
    var all = getAll(userId);
    var key = recordKey(wordId, format);
    var rec = all[key] || { correct: 0, wrong: 0, lastAnswered: null, lastResult: null };
    if (isCorrect) rec.correct++; else rec.wrong++;
    rec.lastAnswered = formatDate(today());
    rec.lastResult = isCorrect;
    all[key] = rec;
    AppStorage.set(storageKey(userId), all);
  }

  window.Records = { getAll: getAll, get: get, save: save };
})();
