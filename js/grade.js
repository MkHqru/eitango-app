// 級の進み具合（今の級）と合格テスト
//
// 生徒ごとに次の情報を持つ（保存は js/storage.js 経由。キーは progress:ユーザーID）
//   currentGrade : 今の級（最初は 20級）
//   lastExamDate : 最後に合格テストを受けた日（1日1回までの判定に使う）
//   allCleared   : 最後の級（18級）に合格したか
//
// 新しい単語は「今の級まで（今の級と、それより下の級）」から級の低い順に出す（js/schedule.js）
//
// 合格テストのルール
//   受けられる条件：例文穴埋めで、今の級の40語すべてに1回以上答えている
//                   かつ、今日まだ合格テストを受けていない
//   出題：今の級の40語すべての例文穴埋め（順番はランダム）
//   合格：40問中36問（9割）以上 → 次の級に上がる
(function () {
  'use strict';

  var GRADE_ORDER = [20, 19, 18];
  var EXAM_FORMAT = 'fill';
  var PASS_RATE = 0.9;

  function storageKey(userId) {
    return 'progress:' + userId;
  }

  function initialProgress() {
    return { currentGrade: GRADE_ORDER[0], lastExamDate: null, allCleared: false };
  }

  function get(userId) {
    var p = AppStorage.get(storageKey(userId));
    var base = initialProgress();
    if (p) Object.keys(p).forEach(function (k) { base[k] = p[k]; });
    return base;
  }

  function save(userId, progress) {
    AppStorage.set(storageKey(userId), progress);
  }

  // その生徒の級の記録を消す（先生が生徒を削除したとき）
  function clear(userId) {
    AppStorage.remove(storageKey(userId));
  }

  // 次の級（最後の級なら null）
  function nextGrade(grade) {
    var i = GRADE_ORDER.indexOf(grade);
    return i >= 0 && i < GRADE_ORDER.length - 1 ? GRADE_ORDER[i + 1] : null;
  }

  // 合格に必要な正解数（40問なら36問）
  function passCount(total) {
    return Math.ceil(total * PASS_RATE);
  }

  // 例文穴埋めで1回以上答えた、その級の語数
  function learnedCount(words, records, grade) {
    records = records || {};
    var gradeWords = words.filter(function (w) { return w.grade === grade; });
    var learned = gradeWords.filter(function (w) {
      return !!records[Schedule.recordKey(w.id, EXAM_FORMAT)];
    }).length;
    return { learned: learned, total: gradeWords.length };
  }

  // 合格テストを受けられるか。受けられないときは理由（reason）も返す
  function examStatus(progress, words, records, todayStr) {
    var count = learnedCount(words, records, progress.currentGrade);
    var status = { canTake: false, reason: '', learned: count.learned, total: count.total };
    if (progress.allCleared) {
      status.reason = 'デモ版で用意している級はここまでです';
    } else if (count.learned < count.total) {
      status.reason = '例文穴埋めで、あと ' + (count.total - count.learned) + ' 語答えると受けられます';
    } else if (progress.lastExamDate === todayStr) {
      status.reason = '再挑戦は明日から（合格テストは1日1回まで）';
    } else {
      status.canTake = true;
    }
    return status;
  }

  // 合格テストの結果を反映した、新しい進み具合を返す
  function applyExamResult(progress, correct, total, todayStr) {
    var p = {};
    Object.keys(progress).forEach(function (k) { p[k] = progress[k]; });
    p.lastExamDate = todayStr;
    var passed = correct >= passCount(total);
    if (passed) {
      var next = nextGrade(p.currentGrade);
      if (next) p.currentGrade = next;
      else p.allCleared = true;
    }
    return { progress: p, passed: passed };
  }

  window.GradeProgress = {
    GRADE_ORDER: GRADE_ORDER,
    EXAM_FORMAT: EXAM_FORMAT,
    get: get,
    save: save,
    clear: clear,
    nextGrade: nextGrade,
    passCount: passCount,
    learnedCount: learnedCount,
    examStatus: examStatus,
    applyExamResult: applyExamResult
  };
})();
