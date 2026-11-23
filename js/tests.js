// チェック用テストページ（tests.html）の中身。
// 単語データの抜け、判定、日付計算、出題スケジュール（間隔ルール）が仕様どおりかを確認する。アプリ本体からは読み込まない。
(function () {
  'use strict';

  var WORDS = window.WORDS;
  var groups = [];
  var current = null;

  function group(title) {
    current = { title: title, tests: [] };
    groups.push(current);
  }

  // problems が空ならOK。problems には見つかった問題を1つずつ入れる
  function check(name, problems) {
    current.tests.push({ name: name, problems: problems });
  }

  function eachWord(fn) {
    var problems = [];
    WORDS.forEach(function (w) {
      var p = fn(w);
      if (p) problems.push((w.id || '(IDなし)') + ' ' + (w.en || '') + '：' + p);
    });
    return problems;
  }

  function isText(v) { return typeof v === 'string' && v.trim() !== ''; }

  function countBlank(s) { return isText(s) ? s.split(Quiz.BLANK).length - 1 : 0; }

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function containsPhrase(sentence, phrase) {
    return new RegExp('(^|[^a-z])' + escapeRegExp(phrase.toLowerCase()) + '($|[^a-z])').test(sentence.toLowerCase());
  }

  // ---------- 単語データ ----------
  group('単語データ');

  check('合計120語ある', WORDS.length === 120 ? [] : ['いま ' + WORDS.length + ' 語']);

  Quiz.GRADES.forEach(function (g) {
    var n = Quiz.wordsOfGrade(g).length;
    check(g + '級が40語ある', n === 40 ? [] : ['いま ' + n + ' 語']);
  });

  check('級が 20 / 19 / 18 のどれか', eachWord(function (w) {
    return Quiz.GRADES.indexOf(w.grade) === -1 ? '級が「' + w.grade + '」' : null;
  }));

  check('ID が「級-2けたの番号」の形で、級と合っている', eachWord(function (w) {
    if (!/^\d{2}-\d{2}$/.test(w.id || '')) return 'ID の形がおかしい';
    if (w.id.slice(0, 2) !== String(w.grade)) return 'ID と級が合っていない';
    return null;
  }));

  (function () {
    var seen = {}, problems = [];
    WORDS.forEach(function (w) {
      if (seen[w.id]) problems.push(w.id + ' が重複');
      seen[w.id] = true;
    });
    check('ID が重複していない', problems);
  })();

  check('英語・日本語訳・品詞が空でない', eachWord(function (w) {
    var missing = [];
    if (!isText(w.en)) missing.push('英語');
    if (!isText(w.ja)) missing.push('日本語訳');
    if (!isText(w.pos)) missing.push('品詞');
    return missing.length ? missing.join('・') + 'が空' : null;
  }));

  check('正解（answers）が1つ以上あり、英語（en）も含まれている', eachWord(function (w) {
    if (!Array.isArray(w.answers) || w.answers.length === 0) return '正解が登録されていない';
    if (!w.answers.every(isText)) return '空の正解がある';
    var norm = w.answers.map(Quiz.normalize);
    if (norm.indexOf(Quiz.normalize(w.en)) === -1) return '英語（en）が正解に入っていない';
    return null;
  }));

  check('例文（日本語・英語・日本語の空所に入る言葉）が空でない', eachWord(function (w) {
    var ex = w.example;
    if (!ex) return '例文がない';
    var missing = [];
    if (!isText(ex.ja)) missing.push('日本語の例文');
    if (!isText(ex.en)) missing.push('英語の例文');
    if (!isText(ex.jaAnswer)) missing.push('日本語の空所に入る言葉');
    return missing.length ? missing.join('・') + 'が空' : null;
  }));

  check('日本語の例文に空所（____）がちょうど1か所ある', eachWord(function (w) {
    var n = countBlank(w.example && w.example.ja);
    return n === 1 ? null : '空所が ' + n + ' か所';
  }));

  check('英語の例文に空所（____）がちょうど1か所ある', eachWord(function (w) {
    var n = countBlank(w.example && w.example.en);
    return n === 1 ? null : '空所が ' + n + ' か所';
  }));

  check('英語の例文の空所以外に、答えがそのまま書かれていない', eachWord(function (w) {
    if (!w.example || !isText(w.example.en) || !Array.isArray(w.answers)) return null;
    var hit = w.answers.filter(function (a) { return containsPhrase(w.example.en, a); });
    return hit.length ? '「' + hit.join(' / ') + '」が文中にある' : null;
  }));

  Quiz.GRADES.forEach(function (g) {
    var seenJa = {}, seenEn = {}, problems = [];
    Quiz.wordsOfGrade(g).forEach(function (w) {
      if (seenJa[w.ja]) problems.push(w.id + ' 日本語訳「' + w.ja + '」が ' + seenJa[w.ja] + ' と同じ');
      if (seenEn[w.en]) problems.push(w.id + ' 英語「' + w.en + '」が ' + seenEn[w.en] + ' と同じ');
      seenJa[w.ja] = w.id;
      seenEn[w.en] = w.id;
    });
    check(g + '級の中で、英語・日本語訳が重複していない（4択で同じ選択肢が出ないように）', problems);
  });

  // 例文は「その級までに出てくる単語」で作る → 自分より上の級（数字が小さい級）の単語を使っていないか
  (function () {
    var problems = [];
    WORDS.forEach(function (w) {
      if (!w.example || !isText(w.example.en)) return;
      WORDS.forEach(function (other) {
        if (other.grade >= w.grade) return; // 同じ級・下の級の単語は使ってよい
        // 同じ英語が自分の級以下にもあれば、その単語として使ってよい
        var alsoEasier = WORDS.some(function (x) { return x.grade >= w.grade && x.en === other.en; });
        if (alsoEasier) return;
        other.answers.forEach(function (a) {
          if (containsPhrase(w.example.en, a)) {
            problems.push(w.id + '（' + w.grade + '級）の例文に ' + other.grade + '級の「' + a + '」');
          }
        });
      });
    });
    check('例文に、自分より上の級の単語を使っていない', problems);
  })();

  // ---------- 判定 ----------
  group('判定（入力の答え合わせ）');

  function find(en) { return WORDS.filter(function (w) { return w.en === en; })[0]; }

  function judgeCases(en, format, cases) {
    var w = find(en);
    if (!w) return ['単語「' + en + '」がデータにない'];
    var q = { word: w, format: format };
    var problems = [];
    cases.forEach(function (c) {
      var got = Quiz.isCorrect(q, c[0]);
      if (got !== c[1]) problems.push('「' + c[0] + '」が' + (got ? '正解' : '不正解') + 'になった（期待：' + (c[1] ? '正解' : '不正解') + '）');
    });
    return problems;
  }

  check('大文字・小文字、語と語の間の空白の数、前後の空白を無視する（How many）', judgeCases('how many', 'fill', [
    ['How many', true], ['how  many', true], ['How Many', true], ['  how many  ', true],
    ['HOW MANY', true], ['how\tmany', true], ['howmany', false], ['how much', false]
  ]));

  check('正解が複数ある単語は、どれを入れても正解（everyone / everybody）', judgeCases('everyone', 'ja-en', [
    ['everyone', true], ['everybody', true], ['Everybody', true], ['every one', false]
  ]));

  check('正解が複数ある単語は、例文穴埋めでもどれを入れても正解（a lot of / lots of）', judgeCases('a lot of', 'fill', [
    ['a lot of', true], ['lots of', true], ['A  lot  of', true], ['a lot', false]
  ]));

  check('アポストロフィーの種類（\' と ’）の違いを無視する', (function () {
    var problems = [];
    var q = { word: { answers: ["don't"] }, format: 'fill' };
    [["don't", true], ['don’t', true], ['don‘t', true], ['Don’t', true], ['dont', false]].forEach(function (c) {
      if (Quiz.isCorrect(q, c[0]) !== c[1]) problems.push('「' + c[0] + '」の判定がおかしい');
    });
    return problems;
  })());

  check('間違った答えは不正解になる', judgeCases('water', 'ja-en', [
    ['water', true], ['waters', false], ['wate', false], ['', false]
  ]));

  // ---------- 日付計算 ----------
  group('日付計算（js/date.js）');

  function eqCases(cases) {
    var problems = [];
    cases.forEach(function (c) {
      if (c[1] !== c[2]) problems.push(c[0] + '：' + c[1] + '（期待：' + c[2] + '）');
    });
    return problems;
  }

  check('n日後の計算（月末・年末・うるう年をまたぐ）', eqCases([
    ['11/23 の1日後', DateUtil.addDays('2026-11-23', 1), '2026-11-24'],
    ['11/30 の1日後', DateUtil.addDays('2026-11-30', 1), '2026-12-01'],
    ['12/31 の1日後', DateUtil.addDays('2026-12-31', 1), '2027-01-01'],
    ['2027/2/28 の1日後（うるう年でない）', DateUtil.addDays('2027-02-28', 1), '2027-03-01'],
    ['2028/2/28 の1日後（うるう年）', DateUtil.addDays('2028-02-28', 1), '2028-02-29'],
    ['11/23 の30日後', DateUtil.addDays('2026-11-23', 30), '2026-12-23'],
    ['3/1 の1日前', DateUtil.addDays('2026-03-01', -1), '2026-02-28']
  ]));

  check('2つの日付の差（日数）', eqCases([
    ['11/23 → 11/26', DateUtil.diffDays('2026-11-23', '2026-11-26'), 3],
    ['12/25 → 1/8', DateUtil.diffDays('2026-12-25', '2027-01-08'), 14],
    ['同じ日', DateUtil.diffDays('2026-11-23', '2026-11-23'), 0]
  ]));

  check('デモ用の日付操作：+1日・+3日・+7日・今日に戻す で today() がずれる', (function () {
    var saved = DemoDate.getOffset();
    try {
      DemoDate.reset();
      var base = DateUtil.todayString();
      var results = [];
      DemoDate.add(1); results.push(['+1日', DateUtil.todayString(), DateUtil.addDays(base, 1)]);
      DemoDate.add(3); results.push(['続けて +3日（合計 +4日）', DateUtil.todayString(), DateUtil.addDays(base, 4)]);
      DemoDate.add(7); results.push(['続けて +7日（合計 +11日）', DateUtil.todayString(), DateUtil.addDays(base, 11)]);
      results.push(['today() と todayString() が同じ日', formatDate(today()), DateUtil.todayString()]);
      DemoDate.reset(); results.push(['今日に戻す', DateUtil.todayString(), base]);
      return eqCases(results);
    } finally {
      DemoDate.setOffset(saved); // アプリのデモ日付を元に戻す
    }
  })());

  check('日付の表示（年月日と曜日）', eqCases([
    ['2026-11-23', DateUtil.displayDate('2026-11-23'), '2026年11月23日（月）'],
    ['2027-01-01', DateUtil.displayDate('2027-01-01'), '2027年1月1日（金）']
  ]));

  // ---------- 間隔ルール ----------
  group('間隔ルール（js/schedule.js）');

  var D0 = '2026-11-23'; // テスト用の「今日」
  function day(n) { return DateUtil.addDays(D0, n); }

  check('不正解 → 翌日に出題、段階は最初（0）に戻る', (function () {
    var r = Schedule.applyAnswer(null, false, D0);
    var p = [];
    if (r.due !== day(1)) p.push('次の出題日が ' + r.due);
    if (r.stage !== 0) p.push('段階が ' + r.stage);
    if (r.wrong !== 1 || r.correct !== 0) p.push('正解数・不正解数がおかしい');
    if (r.lastAnswered !== D0) p.push('最後に答えた日が ' + r.lastAnswered);
    return p;
  })());

  check('正解するたびに 3日後 → 7日後 → 14日後 → 30日後 と延び、その次の正解で「覚えた」', (function () {
    var p = [], r = null, d = D0;
    [3, 7, 14, 30].forEach(function (gap, i) {
      r = Schedule.applyAnswer(r, true, d);
      if (r.due !== DateUtil.addDays(d, gap)) p.push((i + 1) + '回目の正解：次の出題日が ' + r.due + '（期待：' + gap + '日後）');
      if (r.stage !== i + 1) p.push((i + 1) + '回目の正解：段階が ' + r.stage);
      d = r.due;
    });
    r = Schedule.applyAnswer(r, true, d);
    if (!r.mastered) p.push('30日後の出題で正解しても「覚えた」にならない');
    if (r.correct !== 5) p.push('正解数が ' + r.correct);
    return p;
  })());

  check('途中で間違えると翌日に戻り、そのあと正解すると また3日後から', (function () {
    var p = [];
    var r = Schedule.applyAnswer(null, true, D0);   // 3日後
    r = Schedule.applyAnswer(r, true, r.due);        // 7日後
    r = Schedule.applyAnswer(r, true, r.due);        // 14日後
    var d = r.due;
    r = Schedule.applyAnswer(r, false, d);           // 間違えた
    if (r.due !== DateUtil.addDays(d, 1)) p.push('間違えたあとの出題日が ' + r.due);
    if (r.stage !== 0) p.push('間違えたあとの段階が ' + r.stage);
    var d2 = r.due;
    r = Schedule.applyAnswer(r, true, d2);
    if (r.due !== DateUtil.addDays(d2, 3)) p.push('その次の正解のあとの出題日が ' + r.due + '（期待：3日後）');
    return p;
  })());

  // ---------- 出題スケジュール ----------
  group('出題スケジュール（今日の出題）');

  var W = window.WORDS;
  function ids(list) { return list.map(function (w) { return w.id; }); }
  // grade：今の級（省略すると20級）
  function plan(recs, format, d, grade) { return Schedule.planToday(W, recs, format, d, grade || 20); }
  function answerIds(recs, list, format, ok, d) {
    list.forEach(function (id) {
      var k = Schedule.recordKey(id, format);
      recs[k] = Schedule.applyAnswer(recs[k] || null, ok, d);
    });
  }
  function reviewHas(recs, id, d) { return ids(plan(recs, 'en-ja', d).reviews).indexOf(id) !== -1; }

  check('【#3 完成の条件1】間違える → その日は出ない → +1日で復習に出る', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01'], 'en-ja', false, D0);
    if (reviewHas(recs, '20-01', D0)) p.push('同じ日に復習に出た');
    if (!reviewHas(recs, '20-01', day(1))) p.push('+1日で復習に出ない');
    return p;
  })());

  check('【#3 完成の条件2】正解する → +1日・+2日では出ない → +3日（合計）で出る', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01'], 'en-ja', true, D0);
    if (reviewHas(recs, '20-01', day(1))) p.push('+1日で出た');
    if (reviewHas(recs, '20-01', day(2))) p.push('+2日で出た');
    if (!reviewHas(recs, '20-01', day(3))) p.push('+3日で出ない');
    if (!reviewHas(recs, '20-01', day(5))) p.push('出題日を過ぎても（+5日）出ない');
    return p;
  })());

  check('【#3 完成の条件3】続けて正解すると 7日・14日・30日と間隔が延び、覚えたら出なくなる', (function () {
    var recs = {}, p = [], d = D0;
    answerIds(recs, ['20-01'], 'en-ja', true, d); // 次は3日後
    [7, 14, 30].forEach(function (gap) {
      d = recs[Schedule.recordKey('20-01', 'en-ja')].due;
      answerIds(recs, ['20-01'], 'en-ja', true, d);
      if (reviewHas(recs, '20-01', DateUtil.addDays(d, gap - 1))) p.push(gap + '日間隔：' + (gap - 1) + '日後に出た');
      if (!reviewHas(recs, '20-01', DateUtil.addDays(d, gap))) p.push(gap + '日間隔：' + gap + '日後に出ない');
    });
    d = recs[Schedule.recordKey('20-01', 'en-ja')].due;
    answerIds(recs, ['20-01'], 'en-ja', true, d); // 30日後も正解 → 覚えた
    var later = DateUtil.addDays(d, 365);
    if (reviewHas(recs, '20-01', later)) p.push('覚えたあとも出る');
    if (plan(recs, 'en-ja', later).masteredCount !== 1) p.push('覚えた単語数が 1 にならない');
    if (ids(plan(recs, 'en-ja', later).news).indexOf('20-01') !== -1) p.push('覚えた単語が新しい単語として出る');
    return p;
  })());

  check('【#3 完成の条件4】途中で間違えると、翌日に出る状態に戻る', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01'], 'en-ja', true, D0);         // → 3日後
    answerIds(recs, ['20-01'], 'en-ja', true, day(3));     // → 10日目
    answerIds(recs, ['20-01'], 'en-ja', false, day(10));   // 間違えた
    if (reviewHas(recs, '20-01', day(10))) p.push('間違えた日にもう一度出た');
    if (!reviewHas(recs, '20-01', day(11))) p.push('翌日に出ない');
    return p;
  })());

  check('【#3 完成の条件5】新しい単語は1日10語まで。次の日はまた10語', (function () {
    var recs = {}, p = [];
    var first = plan(recs, 'en-ja', D0);
    if (first.news.length !== 10) p.push('はじめの日の新しい単語が ' + first.news.length + ' 語');
    answerIds(recs, ids(first.news).slice(0, 4), 'en-ja', true, D0);
    var mid = plan(recs, 'en-ja', D0);
    if (mid.news.length !== 6) p.push('4語答えたあと、残りの新しい単語が ' + mid.news.length + ' 語（期待：6語）');
    answerIds(recs, ids(mid.news), 'en-ja', false, D0);
    var after = plan(recs, 'en-ja', D0);
    if (after.news.length !== 0) p.push('10語答えたあと、まだ新しい単語が ' + after.news.length + ' 語');
    if (after.queue.length !== 0) p.push('10語答えたあと、今日の問題が残っている（' + after.queue.length + ' 問）');
    var next = plan(recs, 'en-ja', day(1));
    if (next.news.length !== 10) p.push('次の日の新しい単語が ' + next.news.length + ' 語');
    if (next.reviews.length !== 6) p.push('次の日の復習が ' + next.reviews.length + ' 語（間違えた6語のはず）');
    return p;
  })());

  check('出題の優先順：①出題日を過ぎた復習 → ②新しい単語', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01', '20-02'], 'en-ja', false, D0);
    var q = ids(plan(recs, 'en-ja', day(1)).queue);
    if (q[0] !== '20-01' || q[1] !== '20-02') p.push('先頭が復習になっていない：' + q.slice(0, 3).join(', '));
    if (q.length !== 12) p.push('問題の数が ' + q.length + '（復習2 + 新しい単語10 のはず）');
    return p;
  })());

  check('今の級が20級なら、新しい単語は20級から ID の順に出て、40語出し終えたら0語になる（次の級は出ない）', (function () {
    var recs = {}, p = [], d = D0, order = [];
    for (var i = 0; i < 6; i++) {
      var news = plan(recs, 'en-ja', d, 20).news;
      order = order.concat(ids(news));
      answerIds(recs, ids(news), 'en-ja', true, d);
      d = DateUtil.addDays(d, 1);
    }
    if (order.length !== 40) p.push('新しい単語が全部で ' + order.length + ' 語（期待：40語）');
    var notGrade20 = order.filter(function (id) { return id.slice(0, 2) !== '20'; });
    if (notGrade20.length) p.push('20級以外が出た：' + notGrade20.slice(0, 3).join(', '));
    if (order.slice(0, 10).join() !== ['20-01','20-02','20-03','20-04','20-05','20-06','20-07','20-08','20-09','20-10'].join()) p.push('はじめの10語が 20-01〜20-10 になっていない');
    if (plan(recs, 'en-ja', d, 19).news[0] && plan(recs, 'en-ja', d, 19).news[0].id !== '19-01') p.push('今の級を19級にしたとき、はじめの新しい単語が 19-01 でない');
    return p;
  })());

  check('出題形式（英→日・日→英・例文穴埋め）は別々に管理される', (function () {
    var recs = {}, p = [];
    answerIds(recs, ids(plan(recs, 'en-ja', D0).news), 'en-ja', false, D0);
    if (plan(recs, 'en-ja', D0).news.length !== 0) p.push('英→日の新しい単語が残っている');
    if (plan(recs, 'ja-en', D0).news.length !== 10) p.push('英→日を解いたら、日→英の新しい単語が減った');
    if (plan(recs, 'fill', D0).news.length !== 10) p.push('英→日を解いたら、例文穴埋めの新しい単語が減った');
    if (plan(recs, 'ja-en', day(1)).reviews.length !== 0) p.push('英→日で間違えた単語が、日→英の復習に出た');
    if (plan(recs, 'en-ja', day(1)).reviews.length !== 10) p.push('英→日の復習が10語にならない');
    return p;
  })());

  check('1回の問題は10問まで。4択は選択肢が4つで重複がなく、正解が入っていて、同じ級から選ばれる', (function () {
    var p = [], recs = {};
    // 20級の単語を全部「今日が復習日」にして、問題を作る
    answerIds(recs, ids(W.filter(function (w) { return w.grade === 20; })), 'en-ja', false, day(-1));
    for (var i = 0; i < 100 && !p.length; i++) {
      var qs = Quiz.createSession('en-ja', recs, D0, 20);
      if (qs.length !== Quiz.QUESTION_COUNT) p.push('問題数が ' + qs.length);
      qs.forEach(function (q) {
        var c = q.choices;
        var uniq = c.filter(function (x, k) { return c.indexOf(x) === k; });
        var sameGrade = c.every(function (ja) {
          return W.some(function (w) { return w.ja === ja && w.grade === q.word.grade; });
        });
        if (c.length !== 4 || uniq.length !== 4 || c.indexOf(q.word.ja) === -1 || !sameGrade) {
          p.push(q.word.id + '：' + c.join(' / '));
        }
      });
    }
    return p.slice(0, 5);
  })());

  // ---------- 級と合格テスト ----------
  group('級と合格テスト（js/grade.js）');

  function progress0() { return { currentGrade: 20, lastExamDate: null, allCleared: false }; }
  function gradeIds(g) { return ids(W.filter(function (w) { return w.grade === g; })); }
  function exam(prog, recs, d) { return GradeProgress.examStatus(prog, W, recs, d); }

  check('【#9 完成の条件1】新しい生徒は20級から始まり、19級・18級の新しい単語は出ない（3つの形式すべて）', (function () {
    var p = [];
    var prog = GradeProgress.get('__test_new_student__'); // 保存されていない生徒
    if (prog.currentGrade !== 20) p.push('最初の級が ' + prog.currentGrade);
    Quiz.FORMATS.forEach(function (f) {
      var recs = {}, d = D0, seen = [];
      for (var i = 0; i < 8; i++) {
        var news = plan(recs, f, d, prog.currentGrade).news;
        seen = seen.concat(ids(news));
        answerIds(recs, ids(news), f, true, d);
        d = DateUtil.addDays(d, 1);
      }
      var other = seen.filter(function (id) { return id.slice(0, 2) !== '20'; });
      if (other.length) p.push(f + '：' + other[0] + ' が出た');
      if (seen.length !== 40) p.push(f + '：新しい単語が ' + seen.length + ' 語（20級の40語を出し終えたら0語のはず）');
    });
    return p;
  })());

  check('【#9 完成の条件2】例文穴埋めで20級の40語すべてに答えるまで、合格テストは受けられない', (function () {
    var p = [], recs = {}, prog = progress0();
    var all = gradeIds(20);
    var s0 = exam(prog, recs, D0);
    if (s0.canTake) p.push('何も学習していないのに受けられる');
    if (s0.reason !== '例文穴埋めで、あと 40 語答えると受けられます') p.push('理由の表示：' + s0.reason);
    answerIds(recs, all.slice(0, 32), 'fill', true, D0);
    var s1 = exam(prog, recs, D0);
    if (s1.canTake || s1.learned !== 32 || s1.reason !== '例文穴埋めで、あと 8 語答えると受けられます') p.push('32語のとき：' + s1.learned + ' / ' + s1.total + ' ' + s1.reason);
    answerIds(recs, all, 'en-ja', true, D0); // 英→日でいくら答えても数えない
    answerIds(recs, all, 'ja-en', true, D0);
    if (exam(prog, recs, D0).canTake) p.push('英→日・日→英で答えた分で受けられるようになった');
    answerIds(recs, all.slice(32), 'fill', false, D0); // 不正解でも「答えた」に数える
    var s2 = exam(prog, recs, D0);
    if (!s2.canTake || s2.learned !== 40) p.push('40語答えたのに受けられない：' + s2.reason);
    return p;
  })());

  check('合格テストの問題：今の級の40語すべての例文穴埋めで、順番はランダム', (function () {
    var p = [], orders = {};
    for (var i = 0; i < 20; i++) {
      var qs = Quiz.createExam(19);
      if (qs.length !== 40) { p.push('問題数が ' + qs.length); break; }
      if (!qs.every(function (q) { return q.format === 'fill' && q.word.grade === 19; })) { p.push('例文穴埋め以外か、19級以外の問題がある'); break; }
      var u = {}; qs.forEach(function (q) { u[q.word.id] = true; });
      if (Object.keys(u).length !== 40) { p.push('同じ単語が2回出た'); break; }
      orders[ids(qs.map(function (q) { return q.word; })).join()] = true;
    }
    if (!p.length && Object.keys(orders).length < 2) p.push('20回作っても順番が同じ');
    return p;
  })());

  check('【#9 完成の条件3】36問以上正解で19級に上がり、19級の新しい単語が出るようになる', (function () {
    var p = [];
    if (GradeProgress.passCount(40) !== 36) p.push('合格ラインが ' + GradeProgress.passCount(40) + '問');
    var r = GradeProgress.applyExamResult(progress0(), 36, 40, D0);
    if (!r.passed || r.progress.currentGrade !== 19) p.push('36問で 合格=' + r.passed + '、級=' + r.progress.currentGrade);
    var r40 = GradeProgress.applyExamResult(progress0(), 40, 40, D0);
    if (!r40.passed || r40.progress.currentGrade !== 19) p.push('40問で合格にならない');
    var recs = {};
    answerIds(recs, gradeIds(20), 'fill', true, day(-5)); // 20級は学習ずみ
    var news = plan(recs, 'fill', day(1), r.progress.currentGrade).news;
    if (news.length !== 10 || !news.every(function (w) { return w.grade === 19; })) p.push('合格後の新しい単語：' + ids(news).slice(0, 3).join(', '));
    return p;
  })());

  check('【#9 完成の条件4】35問以下は不合格。同じ日は再挑戦できず、+1日で再挑戦できる', (function () {
    var p = [], recs = {};
    answerIds(recs, gradeIds(20), 'fill', true, D0);
    var r = GradeProgress.applyExamResult(progress0(), 35, 40, D0);
    if (r.passed || r.progress.currentGrade !== 20) p.push('35問で 合格=' + r.passed + '、級=' + r.progress.currentGrade);
    var same = exam(r.progress, recs, D0);
    if (same.canTake) p.push('同じ日に再挑戦できる');
    if (same.reason !== '再挑戦は明日から（合格テストは1日1回まで）') p.push('理由の表示：' + same.reason);
    if (!exam(r.progress, recs, day(1)).canTake) p.push('+1日しても再挑戦できない');
    var r0 = GradeProgress.applyExamResult(progress0(), 0, 40, D0);
    if (r0.passed) p.push('0問でも合格になった');
    return p;
  })());

  check('【#9 完成の条件5】19級に上がっても、20級の単語の復習は出る', (function () {
    var p = [], recs = {};
    answerIds(recs, ['20-01', '20-02'], 'fill', false, D0);
    answerIds(recs, gradeIds(20).slice(2), 'fill', true, D0); // 20級の残りは正解（3日後まで出ない）
    answerIds(recs, ['20-03'], 'en-ja', true, D0);
    var revFill = ids(plan(recs, 'fill', day(1), 19).reviews);
    if (revFill.indexOf('20-01') === -1 || revFill.indexOf('20-02') === -1) p.push('例文穴埋め：20級の復習が出ない（' + revFill.join(', ') + '）');
    var revEnJa = ids(plan(recs, 'en-ja', day(3), 19).reviews);
    if (revEnJa.indexOf('20-03') === -1) p.push('英→日：20級の復習が出ない');
    var q = ids(plan(recs, 'fill', day(1), 19).queue);
    if (q[0].slice(0, 2) !== '20' || q[2].slice(0, 2) !== '19') p.push('並び順が「20級の復習 → 19級の新しい単語」になっていない：' + q.slice(0, 4).join(', '));
    return p;
  })());

  check('新しい単語は「今の級まで（今の級と下の級）」から、級の低い順に出る（前の級の残りが先に出る）', (function () {
    var p = [];
    // 英→日で20級を10語だけ出したあと、19級に上がった場合
    var recs = {};
    answerIds(recs, gradeIds(20).slice(0, 10), 'en-ja', true, D0);
    var d = day(1), order = [];
    for (var i = 0; i < 8; i++) {
      var news = plan(recs, 'en-ja', d, 19).news;
      order = order.concat(ids(news));
      answerIds(recs, ids(news), 'en-ja', true, d);
      d = DateUtil.addDays(d, 1);
    }
    if (order.slice(0, 30).join() !== gradeIds(20).slice(10).join()) p.push('はじめに20級の残り30語（20-11〜20-40）が出ていない：' + order.slice(0, 3).join(', '));
    if (order.slice(30).join() !== gradeIds(19).join()) p.push('20級の残りのあとに 19級の40語が ID の順に出ていない');
    if (order.length !== 70) p.push('新しい単語が全部で ' + order.length + ' 語（期待：20級の残り30 + 19級40 = 70語）');
    if (order.some(function (id) { return id.slice(0, 2) === '18'; })) p.push('19級なのに18級の単語が出た');
    if (plan(recs, 'en-ja', d, 19).news.length !== 0) p.push('20級・19級を出し終えたのに、まだ新しい単語がある');
    // 18級まで上がったら、出していない単語は全部（20級から順に）出る
    var all = plan({}, 'ja-en', D0, 18).news;
    if (ids(all).join() !== gradeIds(20).slice(0, 10).join()) p.push('18級で何も学習していないとき、20級から出ない：' + ids(all).slice(0, 3).join(', '));
    // 20級のときは19級・18級は出ない
    var g20 = {};
    answerIds(g20, gradeIds(20), 'fill', true, D0);
    if (plan(g20, 'fill', day(1), 20).news.length !== 0) p.push('20級のとき、20級を出し終えたあとに次の級の単語が出た');
    return p;
  })());

  check('合格テストの答えも、通常の回答と同じように記録に反映される', (function () {
    var p = [];
    var rec = Schedule.applyAnswer(null, true, D0);
    var after = Schedule.applyAnswer(rec, false, day(1)); // 合格テストで間違えた
    if (after.wrong !== 1 || after.due !== day(2)) p.push('間違えたのに記録が変わらない');
    // app.js では合格テストの問題も format 'fill' で Records.save するので、例文穴埋めの記録になる
    if (Quiz.createExam(20)[0].format !== GradeProgress.EXAM_FORMAT || GradeProgress.EXAM_FORMAT !== 'fill') p.push('合格テストの形式が例文穴埋めになっていない');
    return p;
  })());

  check('18級に合格したら「デモ版で用意している級はここまで」になる', (function () {
    var p = [], recs = {};
    var prog = { currentGrade: 18, lastExamDate: null, allCleared: false };
    var r = GradeProgress.applyExamResult(prog, 38, 40, D0);
    if (!r.passed || !r.progress.allCleared) p.push('18級に合格しても終わりにならない');
    if (r.progress.currentGrade !== 18) p.push('級が ' + r.progress.currentGrade + ' になった');
    answerIds(recs, gradeIds(18), 'fill', true, D0);
    var s1 = exam(r.progress, recs, day(5));
    if (s1.canTake || s1.reason !== 'デモ版で用意している級はここまでです') p.push('合格後も合格テストが受けられる：' + s1.reason);
    if (GradeProgress.nextGrade(18) !== null || GradeProgress.nextGrade(20) !== 19 || GradeProgress.nextGrade(19) !== 18) p.push('次の級の計算がおかしい');
    return p;
  })());

  // ---------- 先生画面 ----------
  group('先生画面（js/teacher.js・js/auth.js）');

  check('【#4 完成の条件1】生徒が学習すると数字に反映され、覚えた単語数・今日の復習は生徒画面と同じ計算になる', (function () {
    var p = [], recs = {}, prog = progress0();
    var s0 = Teacher.summarize(W, recs, prog, D0);
    if (s0.lastStudied !== null || s0.accuracy !== null || s0.answered !== 0) p.push('学習前なのに数字がある');
    answerIds(recs, ['20-01', '20-02', '20-03'], 'en-ja', true, D0);
    answerIds(recs, ['20-04'], 'en-ja', false, D0);
    answerIds(recs, ['20-01'], 'fill', false, day(1));
    var s1 = Teacher.summarize(W, recs, prog, day(1));
    if (s1.lastStudied !== day(1)) p.push('最後に学習した日が ' + s1.lastStudied);
    if (s1.answered !== 5 || s1.accuracy !== 60) p.push('正答率が ' + s1.accuracy + '%（' + s1.answered + '回答）（期待：60%・5回答）');
    Quiz.FORMATS.forEach(function (f) {
      var pl = Schedule.planToday(W, recs, f, day(1), prog.currentGrade);
      if (s1.reviews[f] !== pl.reviews.length) p.push(f + '：今日の復習が生徒画面と違う');
      if (s1.mastered[f] !== pl.masteredCount) p.push(f + '：覚えた単語数が生徒画面と違う');
    });
    if (s1.reviews['en-ja'] !== 1) p.push('英→日の今日の復習が ' + s1.reviews['en-ja'] + '（間違えた1語のはず）');
    var s3 = Teacher.summarize(W, recs, prog, day(3));
    if (s3.reviews['en-ja'] !== 4) p.push('3日後の英→日の復習が ' + s3.reviews['en-ja'] + '（4語のはず）');
    var r = {};
    answerIds(r, ['20-05'], 'en-ja', true, D0);
    [3, 7, 14, 30].reduce(function (d, gap) { answerIds(r, ['20-05'], 'en-ja', true, d); return DateUtil.addDays(d, gap); }, day(3));
    if (Teacher.summarize(W, r, prog, day(400)).mastered['en-ja'] !== 1) p.push('覚えた単語数が増えない');
    if (Teacher.summarize(W, recs, { currentGrade: 19, lastExamDate: null, allCleared: false }, D0).currentGrade !== 19) p.push('今の級が反映されない');
    return p;
  })());

  check('【#4 完成の条件2】3日以上学習していない生徒・まだ学習していない生徒は強調表示の対象になる', (function () {
    var p = [], recs = {}, prog = progress0();
    if (!Teacher.summarize(W, recs, prog, D0).inactive) p.push('まだ学習していない生徒が対象にならない');
    answerIds(recs, ['20-01'], 'en-ja', true, D0);
    [[0, false], [1, false], [2, false], [3, true], [10, true]].forEach(function (c) {
      var s1 = Teacher.summarize(W, recs, prog, day(c[0]));
      if (s1.inactive !== c[1]) p.push(c[0] + '日後：' + (s1.inactive ? '強調される' : '強調されない'));
      if (s1.daysSince !== c[0]) p.push(c[0] + '日後：学習していない日数が ' + s1.daysSince);
    });
    return p;
  })());

  check('苦手な単語は不正解数の多い順で、3つの出題形式ごとに別々・全体ランキングは全生徒の合計', (function () {
    var p = [], a = {}, b = {};
    answerIds(a, ['20-03'], 'en-ja', false, D0);
    answerIds(a, ['20-03'], 'en-ja', false, day(1));
    answerIds(a, ['20-01'], 'en-ja', false, D0);
    answerIds(a, ['20-02'], 'en-ja', true, D0);
    answerIds(a, ['20-09'], 'fill', false, D0);
    answerIds(b, ['20-01'], 'en-ja', false, D0);
    answerIds(b, ['20-01'], 'en-ja', false, day(1));
    var wa = Teacher.weakWords(W, [a], 'en-ja');
    if (ids(wa.map(function (x) { return x.word; })).join() !== '20-03,20-01') p.push('生徒Aの英→日の苦手単語：' + ids(wa.map(function (x) { return x.word; })).join());
    if (wa[0].wrong !== 2) p.push('不正解数が ' + wa[0].wrong);
    if (Teacher.weakWords(W, [a], 'ja-en').length !== 0) p.push('日→英に英→日の間違いが出た');
    var wf = Teacher.weakWords(W, [a], 'fill');
    if (wf.length !== 1 || wf[0].word.id !== '20-09') p.push('例文穴埋めの苦手単語が別に出ない');
    var rk = Teacher.weakWords(W, [a, b], 'en-ja');
    if (rk[0].word.id !== '20-01' || rk[0].wrong !== 3 || rk[0].students !== 2) p.push('全体ランキングの1位が ' + rk[0].word.id + '（' + rk[0].wrong + '回・' + rk[0].students + '人）（期待：20-01・3回・2人）');
    var many = {};
    answerIds(many, gradeIds(20), 'ja-en', false, D0);
    if (Teacher.weakWords(W, [many], 'ja-en').length !== 10) p.push('上位10語に絞られていない');
    return p;
  })());

  // アカウントの操作は保存データを書きかえるので、終わったら元のデータに戻す
  function withSandbox(fn) {
    var saved = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf('eitango:') === 0) saved[k] = localStorage.getItem(k);
    }
    try {
      AppStorage.clearAll();
      Auth.resetDemoData();
      return fn();
    } catch (e) {
      return ['エラー：' + e.message];
    } finally {
      AppStorage.clearAll();
      Object.keys(saved).forEach(function (k) { localStorage.setItem(k, saved[k]); });
    }
  }

  function loginTeacher() {
    Auth.login('teacher', 'admin');
    Auth.changePassword('sensei', 'sensei');
  }

  check('【#4 完成の条件3】パスワードをリセットした生徒は、初期パスワード → 変更画面の流れになる', withSandbox(function () {
    var p = [];
    Auth.login('juku001', '1234');
    Auth.changePassword('neko99', 'neko99');
    Auth.logout();
    loginTeacher();
    var err = Auth.resetStudentPassword('juku001');
    if (err) p.push('リセットできない：' + err);
    Auth.logout();
    if (Auth.login('juku001', 'neko99')) p.push('リセット後も前のパスワードで入れる');
    var me = Auth.login('juku001', '1234');
    if (!me) p.push('初期パスワードで入れない');
    else if (!me.mustChangePassword) p.push('パスワードの変更画面にならない');
    return p;
  }));

  check('【#4 完成の条件4】生徒を追加すると juku006 が作られてログインできる。IDは連番で、削除したIDは使い回さない', withSandbox(function () {
    var p = [];
    loginTeacher();
    var r1 = Auth.addStudent();
    if (r1.id !== 'juku006') p.push('追加したIDが ' + (r1.id || r1.error));
    var r2 = Auth.addStudent();
    if (r2.id !== 'juku007') p.push('2人目のIDが ' + r2.id);
    if (Auth.listStudents().join() !== 'juku001,juku002,juku003,juku004,juku005,juku006,juku007') p.push('生徒一覧：' + Auth.listStudents().join());
    if (Teacher.deleteStudent('juku007')) p.push('削除できない');
    if (Auth.addStudent().id !== 'juku008') p.push('追加した生徒を削除したあと、そのIDを使い回した');
    if (Teacher.deleteStudent('juku008')) p.push('削除できない');
    if (Auth.addStudent().id !== 'juku009') p.push('一番大きい番号の生徒を削除したあと、そのIDを使い回した');
    Auth.logout();
    var me = Auth.login('juku006', '1234');
    if (!me || me.role !== 'student' || !me.mustChangePassword) p.push('juku006 / 1234 でログインして変更画面にならない');
    return p;
  }));

  check('最初からいる juku005 を削除してから追加しても、juku005 を使い回さない（juku006 になる）', withSandbox(function () {
    var p = [];
    loginTeacher();
    if (Teacher.deleteStudent('juku005')) p.push('削除できない');
    var r = Auth.addStudent();
    if (r.id !== 'juku006') p.push('追加したIDが ' + r.id);
    return p;
  }));

  check('生徒を削除すると、アカウントと学習記録・級の記録が消える', withSandbox(function () {
    var p = [];
    Records.save('juku003', '20-01', 'en-ja', true);
    GradeProgress.save('juku003', { currentGrade: 19, lastExamDate: null, allCleared: false });
    loginTeacher();
    var err = Teacher.deleteStudent('juku003');
    if (err) p.push('削除できない：' + err);
    if (Auth.listStudents().indexOf('juku003') !== -1) p.push('一覧に残っている');
    if (Object.keys(Records.getAll('juku003')).length) p.push('学習記録が残っている');
    if (GradeProgress.get('juku003').currentGrade !== 20) p.push('級の記録が残っている');
    Auth.logout();
    if (Auth.login('juku003', '1234')) p.push('削除した生徒でログインできる');
    return p;
  }));

  check('【#4 完成の条件5】生徒のIDでログインしても、先生の操作・データは使えない', withSandbox(function () {
    var p = [];
    Auth.login('juku001', '1234');
    Auth.changePassword('neko99', 'neko99');
    if (Auth.isTeacher()) p.push('生徒が先生として扱われる');
    if (Auth.listStudents().length) p.push('生徒一覧が見える');
    if (!Auth.addStudent().error) p.push('生徒を追加できる');
    if (!Auth.resetStudentPassword('juku002')) p.push('パスワードをリセットできる');
    if (!Teacher.deleteStudent('juku002')) p.push('生徒を削除できる');
    if (Teacher.studentReport('juku002') !== null || Teacher.ranking('en-ja').length) p.push('生徒の記録が見える');
    Auth.logout();
    // 先生でも、パスワードの変更が必要な状態（mustChangePassword）では使えない
    var users = AppStorage.get('users');
    users.teacher.mustChangePassword = true;
    AppStorage.set('users', users);
    Auth.login('teacher', 'admin');
    if (Auth.isTeacher()) p.push('先生がパスワード変更前に先生画面を使える');
    return p;
  }));

  // ---------- サンプルデータ ----------
  group('サンプルデータ（js/sample.js）');

  function sampleReports() {
    loginTeacher();
    var map = {};
    Teacher.allReports().forEach(function (r) { map[r.id] = r; });
    return map;
  }
  function sum(obj) { return Object.keys(obj).reduce(function (t, k) { return t + obj[k]; }, 0); }
  function wrongTotal(id, f) { return Teacher.studentWeakWords(id, f).length ? Teacher.weakWords(W, [Records.getAll(id)], f, 999).reduce(function (t, x) { return t + x.wrong; }, 0) : 0; }

  check('リセットすると juku001〜005 と先生がパスワード変更済みで、すぐログインできる（1234 / admin）', withSandbox(function () {
    var p = [];
    DemoData.reset();
    ['juku001', 'juku002', 'juku003', 'juku004', 'juku005'].forEach(function (id) {
      var me = Auth.login(id, '1234');
      if (!me) p.push(id + ' / 1234 でログインできない');
      else if (me.mustChangePassword) p.push(id + ' がパスワード変更画面になる');
    });
    var t = Auth.login('teacher', 'admin');
    if (!t || t.mustChangePassword) p.push('teacher / admin ですぐ先生画面に入れない');
    if (!Auth.isTeacher()) p.push('先生の操作ができない');
    var added = Auth.addStudent();
    Auth.logout();
    var me6 = Auth.login(added.id, '1234');
    if (!me6 || !me6.mustChangePassword) p.push('新しく追加した生徒は、今までどおり変更画面になるはず');
    return p;
  }));

  check('【#5 完成の条件1】リセット直後の先生画面で5人の違いがわかる（級・学習日・覚えた単語・得意不得意）', withSandbox(function () {
    var p = [];
    DemoData.reset();
    var r = sampleReports();
    var grades = ['juku001', 'juku002', 'juku003', 'juku004', 'juku005'].map(function (id) { return r[id].currentGrade; });
    if (grades.join() !== '18,20,19,19,20') p.push('今の級が ' + grades.join(',') + '（期待：18,20,19,19,20）');
    // juku001：約2か月毎日、18級、覚えた単語が多い
    if (r.juku001.daysSince !== 0 || r.juku001.inactive) p.push('juku001 が今日学習したことになっていない');
    if (sum(r.juku001.mastered) < 30) p.push('juku001 の覚えた単語が少ない（' + sum(r.juku001.mastered) + '）');
    ['juku002', 'juku003', 'juku004', 'juku005'].forEach(function (id) {
      if (sum(r[id].mastered) >= sum(r.juku001.mastered)) p.push(id + ' の覚えた単語が juku001 以上');
    });
    // juku002：最初だけやって1週間止まっている
    if (r.juku002.daysSince !== 7 || !r.juku002.inactive) p.push('juku002 が「7日学習なし」の強調になっていない（' + r.juku002.daysSince + '日）');
    ['juku001', 'juku003', 'juku004', 'juku005'].forEach(function (id) {
      if (r[id].inactive) p.push(id + ' が強調表示になっている');
    });
    // juku003：英→日は得意、日→英が苦手
    var e = wrongTotal('juku003', 'en-ja'), j = wrongTotal('juku003', 'ja-en');
    if (!(j >= e * 3)) p.push('juku003 の不正解：英→日 ' + e + '回、日→英 ' + j + '回（日→英が3倍以上のはず）');
    // juku004・005：平均的
    ['juku004', 'juku005'].forEach(function (id) {
      if (r[id].accuracy < 65 || r[id].accuracy > 85) p.push(id + ' の正答率が ' + r[id].accuracy + '%');
    });
    if (!(r.juku001.accuracy > r.juku004.accuracy && r.juku001.accuracy > r.juku005.accuracy)) p.push('juku001 の正答率が一番高くない');
    return p;
  }));

  check('記録の日付はリセットした日が基準（juku001 は約2か月前から、ほかは3週間前から今日まで）。固定の日付ではない', withSandbox(function () {
    var p = [];
    function range(build) {
      var min = null, max = null;
      Object.keys(build.records).forEach(function (k) {
        var r = build.records[k];
        [r.firstAnswered, r.lastAnswered].forEach(function (d) {
          if (!min || d < min) min = d;
          if (!max || d > max) max = d;
        });
      });
      return [min, max];
    }
    SampleData.PROFILES.forEach(function (prof) {
      var a = SampleData.build(prof, D0);
      var ra = range(a);
      var from = DateUtil.diffDays(D0, ra[0]), to = DateUtil.diffDays(D0, ra[1]);
      var expectFrom = prof.id === 'juku001' ? -59 : -21;
      if (from < expectFrom || from > expectFrom + 1) p.push(prof.id + '：一番古い記録が ' + from + '日（期待：' + expectFrom + '日）');
      if (to > 0) p.push(prof.id + '：未来の日付の記録がある');
      // 100日後にリセットしても、日付がそのままずれるだけで中身は同じ
      var later = DateUtil.addDays(D0, 100);
      var b = SampleData.build(prof, later);
      var shifted = JSON.stringify(a.records).replace(/\d{4}-\d{2}-\d{2}/g, function (d) { return DateUtil.addDays(d, 100); });
      if (shifted !== JSON.stringify(b.records)) p.push(prof.id + '：リセットした日によって記録の中身が変わる');
      if (a.progress.currentGrade !== b.progress.currentGrade) p.push(prof.id + '：リセットした日によって級が変わる');
    });
    return p;
  }));

  check('サンプルの記録は、実際に解いたときと同じ形（js/schedule.js の記録）で、つじつまが合っている', withSandbox(function () {
    var p = [];
    var keys = Object.keys(Schedule.applyAnswer(null, true, D0)).sort().join();
    SampleData.PROFILES.forEach(function (prof) {
      var recs = SampleData.build(prof, D0).records;
      Object.keys(recs).forEach(function (k) {
        var r = recs[k];
        var bad = [];
        if (Object.keys(r).sort().join() !== keys) bad.push('項目が違う');
        if (r.correct + r.wrong < 1) bad.push('回答数が0');
        if (r.stage < 0 || r.stage > Schedule.INTERVALS.length) bad.push('段階が ' + r.stage);
        if (r.mastered !== (r.due === null)) bad.push('覚えた と 次の出題日 が合わない');
        if (r.mastered && (r.stage !== Schedule.INTERVALS.length || r.correct < 5)) bad.push('覚えたのに段階・正解数が足りない');
        if (!r.mastered && r.lastResult === false && r.due !== DateUtil.addDays(r.lastAnswered, 1)) bad.push('最後に間違えたのに翌日に出ない');
        if (!r.mastered && r.lastResult === true && r.due !== DateUtil.addDays(r.lastAnswered, Schedule.INTERVALS[r.stage - 1])) bad.push('次の出題日が間隔のルールと合わない');
        if (r.firstAnswered > r.lastAnswered) bad.push('はじめて答えた日が最後に答えた日より後');
        if (bad.length && p.length < 5) p.push(prof.id + ' ' + k + '：' + bad.join('、'));
      });
    });
    return p;
  }));

  check('リセットすると、追加した生徒・変更したパスワード・デモ日付も最初の状態に戻る', withSandbox(function () {
    var p = [];
    DemoData.reset();
    loginTeacher(); // 先生のパスワードを sensei に変える
    Auth.addStudent();
    window.DemoDate.add(5);
    DemoData.reset();
    if (DemoDate.getOffset() !== 0) p.push('デモ日付が今日に戻らない');
    Auth.logout();
    if (!Auth.login('teacher', 'admin')) p.push('先生のパスワードが admin に戻らない');
    if (Auth.listStudents().join() !== 'juku001,juku002,juku003,juku004,juku005') p.push('生徒が5人に戻らない：' + Auth.listStudents().join());
    return p;
  }));

  check('初回起動時だけサンプルを入れ、2回目以降は保存されたデータを消さない', withSandbox(function () {
    var p = [];
    AppStorage.clearAll();
    DemoData.ensureInitialized();
    if (!Auth.hasAccounts() || !Object.keys(Records.getAll('juku001')).length) p.push('初回起動でサンプルが入らない');
    Records.save('juku002', '20-01', 'ja-en', true);
    DemoData.ensureInitialized();
    if (!Records.get('juku002', '20-01', 'ja-en')) p.push('2回目の起動でデータが消えた');
    return p;
  }));

  // ---------- 表示 ----------
  var total = 0, failed = 0;
  var resultsEl = document.getElementById('results');
  groups.forEach(function (g) {
    var box = document.createElement('div');
    box.className = 'test-group';
    var h = document.createElement('h3');
    h.textContent = g.title;
    box.appendChild(h);
    var ul = document.createElement('ul');
    ul.className = 'test-list';
    g.tests.forEach(function (t) {
      total++;
      var ok = t.problems.length === 0;
      if (!ok) failed++;
      var li = document.createElement('li');
      li.setAttribute('data-result', ok ? 'ok' : 'ng');
      li.textContent = (ok ? '✅ ' : '❌ ') + t.name;
      if (!ok) {
        var d = document.createElement('span');
        d.className = 'detail';
        d.textContent = t.problems.join('\n');
        li.appendChild(d);
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
    resultsEl.appendChild(box);
  });

  var summary = document.getElementById('summary');
  summary.textContent = failed === 0
    ? 'すべてOK（' + total + '項目）'
    : total + '項目中 ' + failed + '項目に問題があります';
  summary.className = 'summary ' + (failed === 0 ? 'ok' : 'ng');
})();
