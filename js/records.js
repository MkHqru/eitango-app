// 回答の記録。「単語 × 出題方向」ごとに保存する（英→日と日→英は別々に管理）。
// 保存は js/storage.js 経由。キーは records:ユーザーID
// 中身の例：{ "apple|en-ja": { correct: 1, wrong: 0, lastAnswered: "2026-11-23", lastResult: true } }
(function () {
  'use strict';

  function storageKey(userId) {
    return 'records:' + userId;
  }

  function recordKey(en, direction) {
    return en + '|' + direction;
  }

  function getAll(userId) {
    return AppStorage.get(storageKey(userId)) || {};
  }

  // 未回答なら null
  function get(userId, en, direction) {
    return getAll(userId)[recordKey(en, direction)] || null;
  }

  function save(userId, en, direction, isCorrect) {
    var all = getAll(userId);
    var key = recordKey(en, direction);
    var rec = all[key] || { correct: 0, wrong: 0, lastAnswered: null, lastResult: null };
    if (isCorrect) rec.correct++; else rec.wrong++;
    rec.lastAnswered = formatDate(today());
    rec.lastResult = isCorrect;
    all[key] = rec;
    AppStorage.set(storageKey(userId), all);
  }

  window.Records = { getAll: getAll, get: get, save: save };
})();
