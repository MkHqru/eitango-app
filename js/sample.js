// サンプルの学習記録（デモ用）
//
// 初回起動時と「デモデータをリセット」のときに、juku001〜005 に学習記録を入れる。
// 記録は、生徒が実際にアプリで解いたときと同じ計算（js/schedule.js の Schedule.planToday・Schedule.applyAnswer、
// js/grade.js の合格テストのルール）で、1日ずつ「その日の問題を解いた」ことにして作る。
// そのため、記録の形・段階・次に出題する日・今の級は、本当に解いたときとまったく同じになる。
//
// 日付は、リセットした日（today()）を基準にした「何日前」で決めている（固定の日付は使わない）。
// 正解・不正解は、生徒ごとに決まった乱数（毎回同じ結果になる）で決める。
(function () {
  'use strict';

  // 毎回同じ結果になる乱数（0以上1未満）
  function seededRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // from〜to 日（今日 = 0、昨日 = -1）のうち、skip に入っていない日
  function days(from, to, skip) {
    var list = [];
    for (var d = from; d <= to; d++) {
      if (!skip || skip.indexOf(d) === -1) list.push(d);
    }
    return list;
  }

  var ALL = ['en-ja', 'ja-en', 'fill'];

  // 生徒ごとの学習のしかた
  //   studyDays : 学習した日（今日 = 0、昨日 = -1 …）
  //   formatsOn : その日に解いた出題形式
  //   accuracy  : 出題形式ごとの正解しやすさ（0〜1）
  //   exams     : 級ごとの合格テストの結果（受けられるようになったら、学習した日に順に受ける）
  var PROFILES = [
    {
      id: 'juku001', note: '約2か月、毎日続けている。18級まで進み、覚えた単語が多い',
      seed: 101,
      studyDays: days(-59, 0),
      formatsOn: function (d) { return d === 0 ? ['en-ja'] : ALL; }, // 今日は英→日だけ解いた
      accuracy: { 'en-ja': 0.94, 'ja-en': 0.9, 'fill': 0.9 },
      exams: { 20: ['pass'], 19: ['pass'] }
    },
    {
      id: 'juku002', note: '最初だけやって、1週間止まっている',
      seed: 202,
      studyDays: [-21, -20, -19, -17, -14, -11, -7],
      formatsOn: function () { return ['en-ja', 'fill']; },
      accuracy: { 'en-ja': 0.72, 'ja-en': 0.6, 'fill': 0.65 },
      exams: {}
    },
    {
      id: 'juku003', note: '英→日は得意だが、日→英が苦手',
      seed: 303,
      studyDays: days(-21, -1, [-17, -12, -6]),
      formatsOn: function () { return ALL; },
      accuracy: { 'en-ja': 0.96, 'ja-en': 0.42, 'fill': 0.8 },
      exams: { 20: ['fail', 'pass'] }
    },
    {
      id: 'juku004', note: '平均的',
      seed: 404,
      studyDays: days(-21, -1, [-19, -15, -13, -8, -4]),
      formatsOn: function () { return ALL; },
      accuracy: { 'en-ja': 0.8, 'ja-en': 0.75, 'fill': 0.78 },
      exams: { 20: ['pass'] }
    },
    {
      id: 'juku005', note: '平均的（合格テストは一度不合格）',
      seed: 505,
      studyDays: days(-21, -2, [-20, -18, -16, -12, -10, -5, -3]),
      formatsOn: function () { return ALL; },
      accuracy: { 'en-ja': 0.75, 'ja-en': 0.7, 'fill': 0.72 },
      exams: { 20: ['fail'] }
    }
  ];

  // 1人分の記録を作る。{ records, progress } を返す
  function build(profile, todayStr, words) {
    words = words || window.WORDS;
    var random = seededRandom(profile.seed);
    var records = {};
    var progress = { currentGrade: GradeProgress.GRADE_ORDER[0], lastExamDate: null, allCleared: false };
    var exams = {};
    Object.keys(profile.exams).forEach(function (g) { exams[g] = profile.exams[g].slice(); });

    function answer(word, format, ok, dateStr) {
      var key = Schedule.recordKey(word.id, format);
      records[key] = Schedule.applyAnswer(records[key] || null, ok, dateStr);
    }

    profile.studyDays.slice().sort(function (a, b) { return a - b; }).forEach(function (d) {
      var dateStr = DateUtil.addDays(todayStr, d);

      // その日の問題（復習 → 新しい単語）を、生徒ホームと同じ計算で作って全部解く
      profile.formatsOn(d).forEach(function (format) {
        var plan = Schedule.planToday(words, records, format, dateStr, progress.currentGrade);
        plan.queue.forEach(function (w) {
          answer(w, format, random() < profile.accuracy[format], dateStr);
        });
      });

      // 合格テスト（受けられる日で、まだ受ける予定が残っていれば受ける）
      var plannedResults = exams[progress.currentGrade];
      if (!plannedResults || !plannedResults.length) return;
      if (!GradeProgress.examStatus(progress, words, records, dateStr).canTake) return;
      var pass = plannedResults.shift() === 'pass';
      var examWords = words.filter(function (w) { return w.grade === progress.currentGrade; })
        .map(function (w) { return { w: w, r: random() }; })
        .sort(function (a, b) { return a.r - b.r; })
        .map(function (x) { return x.w; });
      var wrongCount = pass ? 1 + Math.floor(random() * 3) : 5 + Math.floor(random() * 4); // 合格：1〜3問、不合格：5〜8問まちがえる
      examWords.forEach(function (w, i) {
        answer(w, GradeProgress.EXAM_FORMAT, i >= wrongCount, dateStr);
      });
      progress = GradeProgress.applyExamResult(progress, examWords.length - wrongCount, examWords.length, dateStr).progress;
    });

    return { records: records, progress: progress };
  }

  // juku001〜005 にサンプルの記録を入れる
  function seedAll(todayStr) {
    PROFILES.forEach(function (p) {
      var result = build(p, todayStr);
      Records.setAll(p.id, result.records);
      GradeProgress.save(p.id, result.progress);
    });
  }

  window.SampleData = { PROFILES: PROFILES, build: build, seedAll: seedAll };

  // デモデータ全体の初期化
  window.DemoData = {
    // 全データを消して、アカウントとサンプルの記録を入れ直す（デモ日付も今日に戻る）
    reset: function () {
      Auth.resetDemoData();
      seedAll(DateUtil.todayString());
    },
    // 初回起動時（まだ何も保存されていないとき）だけ、デモデータを入れる
    ensureInitialized: function () {
      if (!Auth.hasAccounts()) this.reset();
    }
  };
})();
