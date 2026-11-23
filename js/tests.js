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
  function plan(recs, format, d) { return Schedule.planToday(W, recs, format, d); }
  function answerIds(recs, list, format, ok, d) {
    list.forEach(function (id) {
      var k = Schedule.recordKey(id, format);
      recs[k] = Schedule.applyAnswer(recs[k] || null, ok, d);
    });
  }
  function reviewHas(recs, id, d) { return ids(plan(recs, 'en-ja', d).reviews).indexOf(id) !== -1; }

  check('【完成の条件1】間違える → その日は出ない → +1日で復習に出る', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01'], 'en-ja', false, D0);
    if (reviewHas(recs, '20-01', D0)) p.push('同じ日に復習に出た');
    if (!reviewHas(recs, '20-01', day(1))) p.push('+1日で復習に出ない');
    return p;
  })());

  check('【完成の条件2】正解する → +1日・+2日では出ない → +3日（合計）で出る', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01'], 'en-ja', true, D0);
    if (reviewHas(recs, '20-01', day(1))) p.push('+1日で出た');
    if (reviewHas(recs, '20-01', day(2))) p.push('+2日で出た');
    if (!reviewHas(recs, '20-01', day(3))) p.push('+3日で出ない');
    if (!reviewHas(recs, '20-01', day(5))) p.push('出題日を過ぎても（+5日）出ない');
    return p;
  })());

  check('【完成の条件3】続けて正解すると 7日・14日・30日と間隔が延び、覚えたら出なくなる', (function () {
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

  check('【完成の条件4】途中で間違えると、翌日に出る状態に戻る', (function () {
    var recs = {}, p = [];
    answerIds(recs, ['20-01'], 'en-ja', true, D0);         // → 3日後
    answerIds(recs, ['20-01'], 'en-ja', true, day(3));     // → 10日目
    answerIds(recs, ['20-01'], 'en-ja', false, day(10));   // 間違えた
    if (reviewHas(recs, '20-01', day(10))) p.push('間違えた日にもう一度出た');
    if (!reviewHas(recs, '20-01', day(11))) p.push('翌日に出ない');
    return p;
  })());

  check('【完成の条件5】新しい単語は1日10語まで。次の日はまた10語', (function () {
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

  check('新しい単語は級の低い順（20級 → 19級 → 18級）に出る', (function () {
    var recs = {}, p = [], d = D0, order = [];
    for (var i = 0; i < 12; i++) {
      var news = plan(recs, 'en-ja', d).news;
      order = order.concat(ids(news));
      answerIds(recs, ids(news), 'en-ja', true, d);
      d = DateUtil.addDays(d, 1);
    }
    var grades = order.map(function (id) { return Number(id.slice(0, 2)); });
    for (var k = 1; k < grades.length; k++) {
      if (grades[k] > grades[k - 1]) { p.push(order[k - 1] + ' のあとに ' + order[k] + ' が出た'); break; }
    }
    if (order.slice(0, 10).join() !== ['20-01','20-02','20-03','20-04','20-05','20-06','20-07','20-08','20-09','20-10'].join()) p.push('はじめの10語が 20-01〜20-10 になっていない');
    if (order[40] !== '19-01') p.push('20級の40語のあとが ' + order[40]);
    if (order[80] !== '18-01') p.push('19級の40語のあとが ' + order[80]);
    if (order.length !== 120) p.push('新しい単語が全部で ' + order.length + ' 語');
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
      var qs = Quiz.createSession('en-ja', recs, D0);
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
