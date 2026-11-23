// 忘却曲線に沿った出題スケジュール
//
// 「単語ID × 出題形式」ごとに次の情報を持つ（保存は js/records.js → js/storage.js）
//   stage         : 段階（続けて正解した回数。0〜4）
//   due           : 次に出題する日（'YYYY-MM-DD'）。覚えた単語は null
//   correct       : 正解数
//   wrong         : 不正解数
//   lastAnswered  : 最後に答えた日
//   firstAnswered : はじめて答えた日（「今日の新しい単語」を数えるのに使う）
//   lastResult    : 最後の正誤
//   mastered      : 覚えた（true なら以降は出題しない）
//
// 間隔のルール
//   不正解 → 翌日に出題（段階は 0 に戻す）
//   正解   → 段階 0:3日後 → 1:7日後 → 2:14日後 → 3:30日後
//            30日後の出題（段階 4）でも正解したら「覚えた」
(function () {
  'use strict';

  var INTERVALS = [3, 7, 14, 30];
  var NEW_PER_DAY = 10;
  var GRADE_ORDER = [20, 19, 18]; // 新しい単語は級の低い順に出す

  function recordKey(wordId, format) {
    return wordId + '|' + format;
  }

  // 1回答えたあとの記録を返す（rec は今までの記録。未回答なら null）
  function applyAnswer(rec, isCorrect, todayStr) {
    var r = {
      stage: 0, due: null, correct: 0, wrong: 0,
      lastAnswered: null, firstAnswered: null, lastResult: null, mastered: false
    };
    if (rec) Object.keys(rec).forEach(function (k) { r[k] = rec[k]; });
    r.stage = r.stage || 0;
    if (!r.firstAnswered) r.firstAnswered = todayStr;

    if (isCorrect) {
      r.correct++;
      if (r.stage >= INTERVALS.length) {
        r.mastered = true;
        r.due = null;
      } else {
        r.due = DateUtil.addDays(todayStr, INTERVALS[r.stage]);
        r.stage++;
      }
    } else {
      r.wrong++;
      r.stage = 0;
      r.mastered = false;
      r.due = DateUtil.addDays(todayStr, 1);
    }
    r.lastAnswered = todayStr;
    r.lastResult = isCorrect;
    return r;
  }

  // 今日が出題日か（出題日を過ぎたものも含む）
  function isDue(rec, todayStr) {
    if (!rec || rec.mastered) return false;
    return !rec.due || rec.due <= todayStr;
  }

  // 単語を級の低い順（20級 → 19級 → 18級）、同じ級の中はデータの順に並べる
  function sortByGrade(words) {
    return words.map(function (w, i) { return { w: w, i: i }; })
      .sort(function (a, b) {
        var ga = GRADE_ORDER.indexOf(a.w.grade), gb = GRADE_ORDER.indexOf(b.w.grade);
        return ga !== gb ? ga - gb : a.i - b.i;
      })
      .map(function (x) { return x.w; });
  }

  // 今日の出題予定を作る（出題形式ごと）
  //   reviews : 出題日を過ぎた復習の単語（出題日の古い順）
  //   news    : 今日出す新しい単語（1日10語まで、級の低い順）
  //   queue   : 出題する順（①復習 → ②新しい単語）
  function planToday(words, records, format, todayStr) {
    records = records || {};
    var sorted = sortByGrade(words);
    var reviews = [], unseen = [], masteredCount = 0, introducedToday = 0;

    sorted.forEach(function (w) {
      var rec = records[recordKey(w.id, format)];
      if (!rec) { unseen.push(w); return; }
      if (rec.firstAnswered === todayStr) introducedToday++;
      if (rec.mastered) masteredCount++;
      else if (isDue(rec, todayStr)) reviews.push({ w: w, due: rec.due || '' });
    });

    reviews.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
    reviews = reviews.map(function (x) { return x.w; });

    var newLimit = Math.max(0, NEW_PER_DAY - introducedToday);
    var news = unseen.slice(0, newLimit);

    return {
      reviews: reviews,
      news: news,
      queue: reviews.concat(news),
      masteredCount: masteredCount,
      introducedToday: introducedToday
    };
  }

  window.Schedule = {
    INTERVALS: INTERVALS,
    NEW_PER_DAY: NEW_PER_DAY,
    GRADE_ORDER: GRADE_ORDER,
    recordKey: recordKey,
    applyAnswer: applyAnswer,
    isDue: isDue,
    planToday: planToday
  };
})();
