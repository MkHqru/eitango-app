// データ保存の窓口。アプリ内のデータ保存は必ずこのファイルを経由する。
// 本番化するときは、このファイルの中身を Firebase / Supabase などに差し替える。
(function () {
  'use strict';

  var PREFIX = 'eitango:';

  function get(key) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }

  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  // このアプリが保存したデータだけを全部消す
  function clearAll() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  }

  window.AppStorage = { get: get, set: set, remove: remove, clearAll: clearAll };
})();
