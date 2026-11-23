// チェック用テストページ（tests.html）の中身。
// 単語データの抜けや、判定のしくみが仕様どおりかを確認する。アプリ本体からは読み込まない。
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

  // ---------- 出題 ----------
  group('出題（それぞれ 200 回作って確認）');

  Quiz.GRADES.forEach(function (g) {
    var problems = [];
    Quiz.FORMATS.forEach(function (f) {
      for (var i = 0; i < 200; i++) {
        var qs = Quiz.createQuestions(f, g);
        if (qs.length !== Quiz.QUESTION_COUNT) { problems.push(f + '：問題数が ' + qs.length); break; }
        var other = qs.filter(function (q) { return q.word.grade !== g; });
        if (other.length) { problems.push(f + '：' + other[0].word.id + ' が出た'); break; }
        var ids = {};
        qs.forEach(function (q) { ids[q.word.id] = true; });
        if (Object.keys(ids).length !== qs.length) { problems.push(f + '：同じ単語が2回出た'); break; }
      }
    });
    check(g + '級を選ぶと、' + g + '級の単語だけが10問（重複なし）出る', problems);
  });

  check('英→日の4択：選択肢が4つで重複がなく、正解が必ず入っている', (function () {
    var problems = [];
    Quiz.GRADES.forEach(function (g) {
      for (var i = 0; i < 200; i++) {
        Quiz.createQuestions('en-ja', g).forEach(function (q) {
          var c = q.choices;
          var uniq = c.filter(function (x, k) { return c.indexOf(x) === k; });
          if (c.length !== 4 || uniq.length !== 4 || c.indexOf(q.word.ja) === -1) {
            problems.push(q.word.id + '：' + c.join(' / '));
          }
        });
        if (problems.length) break;
      }
    });
    return problems.slice(0, 5);
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
