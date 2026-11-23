// 先生画面で使う集計と操作
//
// 数字は生徒画面と同じ計算を使う（別の計算は作らない）
//   今の級              … GradeProgress.get（js/grade.js）
//   覚えた単語数        … Schedule.planToday の masteredCount（js/schedule.js）
//   今日の復習の残り数  … Schedule.planToday の reviews の数（js/schedule.js）
// ここで新しく数えるのは、記録（js/records.js）をそのまま集めるだけのもの
//   最後に学習した日（記録の「最後に答えた日」の一番新しい日）、正答率（正解数 ÷ 回答数）、苦手単語（不正解数）
(function () {
  'use strict';

  var INACTIVE_DAYS = 3; // この日数以上学習していない生徒を目立たせる
  var WEAK_LIMIT = 10;

  // 1人の生徒のまとめ（records：その生徒の記録、progress：その生徒の級の記録）
  function summarize(words, records, progress, todayStr) {
    records = records || {};
    var lastStudied = null, correct = 0, wrong = 0;
    Object.keys(records).forEach(function (k) {
      var r = records[k];
      if (r.lastAnswered && (!lastStudied || r.lastAnswered > lastStudied)) lastStudied = r.lastAnswered;
      correct += r.correct || 0;
      wrong += r.wrong || 0;
    });
    var daysSince = lastStudied ? DateUtil.diffDays(lastStudied, todayStr) : null;

    var mastered = {}, reviews = {};
    Quiz.FORMATS.forEach(function (f) {
      var plan = Schedule.planToday(words, records, f, todayStr, progress.currentGrade);
      mastered[f] = plan.masteredCount;
      reviews[f] = plan.reviews.length;
    });

    var answered = correct + wrong;
    return {
      currentGrade: progress.currentGrade,
      allCleared: !!progress.allCleared,
      lastStudied: lastStudied,
      daysSince: daysSince,
      inactive: lastStudied === null || daysSince >= INACTIVE_DAYS,
      mastered: mastered,
      reviews: reviews,
      answered: answered,
      accuracy: answered ? Math.round(correct / answered * 100) : null
    };
  }

  // 苦手な単語（不正解数の多い順。同じ数なら単語データの順）
  // recordsList：記録のリスト（1人分なら [records]、全生徒なら全員分）
  function weakWords(words, recordsList, format, limit) {
    var list = [];
    words.forEach(function (w, i) {
      var wrong = 0, correct = 0, students = 0;
      recordsList.forEach(function (records) {
        var r = (records || {})[Schedule.recordKey(w.id, format)];
        if (!r) return;
        wrong += r.wrong || 0;
        correct += r.correct || 0;
        if (r.wrong) students++;
      });
      if (wrong > 0) list.push({ word: w, wrong: wrong, correct: correct, students: students, order: i });
    });
    list.sort(function (a, b) { return b.wrong - a.wrong || a.order - b.order; });
    return list.slice(0, limit || WEAK_LIMIT);
  }

  // ---- 画面から使うもの（先生でログインしているときだけ）----
  function studentReport(id) {
    if (!Auth.isTeacher()) return null;
    var s = summarize(window.WORDS, Records.getAll(id), GradeProgress.get(id), DateUtil.todayString());
    s.id = id;
    return s;
  }

  function allReports() {
    return Auth.listStudents().map(studentReport);
  }

  function studentWeakWords(id, format) {
    if (!Auth.isTeacher()) return [];
    return weakWords(window.WORDS, [Records.getAll(id)], format);
  }

  // 全体の苦手単語ランキング（全生徒の不正解数の合計が多い順に上位10語）
  function ranking(format) {
    if (!Auth.isTeacher()) return [];
    return weakWords(window.WORDS, Auth.listStudents().map(Records.getAll), format);
  }

  // 生徒を削除する（アカウントと、学習記録・級の記録）。問題があればメッセージ、成功したら null
  function deleteStudent(id) {
    var error = Auth.deleteStudent(id);
    if (error) return error;
    Records.clear(id);
    GradeProgress.clear(id);
    return null;
  }

  window.Teacher = {
    INACTIVE_DAYS: INACTIVE_DAYS,
    summarize: summarize,
    weakWords: weakWords,
    studentReport: studentReport,
    allReports: allReports,
    studentWeakWords: studentWeakWords,
    ranking: ranking,
    deleteStudent: deleteStudent
  };
})();
