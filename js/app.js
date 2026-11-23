// 画面の切り替え
(function () {
  'use strict';

  var screens = ['login', 'change-password', 'student-home', 'quiz', 'result', 'teacher-home'];

  function $(id) { return document.getElementById(id); }

  function show(name) {
    screens.forEach(function (s) {
      $('screen-' + s).hidden = (s !== name);
    });
  }

  function showMessage(id, text) {
    var el = $(id);
    el.textContent = text || '';
    el.hidden = !text;
  }

  // ログイン状態に合わせて画面を決める
  function render() {
    var me = Auth.currentUser();
    if (!me) {
      show('login');
      return;
    }
    if (me.mustChangePassword) {
      $('change-user-id').textContent = me.id;
      $('change-form').reset();
      showMessage('change-error', '');
      show('change-password');
      return;
    }
    if (me.role === 'teacher') {
      $('teacher-user-id').textContent = me.id;
      show('teacher-home');
    } else {
      $('student-user-id').textContent = me.id;
      renderStudentHome(me.id);
      show('student-home');
    }
  }

  function logout() {
    Auth.logout();
    showMessage('login-error', '');
    showMessage('login-info', '');
    $('login-form').reset();
    render();
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('login-id').value.trim();
    var password = $('login-password').value;
    showMessage('login-info', '');
    if (!Auth.login(id, password)) {
      showMessage('login-error', 'ID またはパスワードが違います。');
      return;
    }
    showMessage('login-error', '');
    $('login-form').reset();
    render();
  });

  $('change-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var error = Auth.changePassword($('new-password').value, $('confirm-password').value);
    if (error) {
      showMessage('change-error', error);
      return;
    }
    render();
  });

  $('reset-button').addEventListener('click', function () {
    if (!confirm('デモデータをすべて初期状態に戻します。よろしいですか？')) return;
    Auth.resetDemoData();
    quiz = null;
    updateDemoDate();
    $('login-form').reset();
    showMessage('login-error', '');
    showMessage('login-info', 'デモデータを初期状態に戻しました。');
    render();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-action="logout"]'), function (btn) {
    btn.addEventListener('click', logout);
  });

  // ---- 単語テスト ----
  var FORMAT_LABELS = { 'en-ja': '英語 → 日本語', 'ja-en': '日本語 → 英語', 'fill': '例文穴埋め' };
  var quiz = null; // { format, questions, index, correctCount, wrongWords, answered }

  // 出題形式ごとの今日の予定（復習・新しい単語・覚えた単語）
  function planToday(userId, format) {
    return Schedule.planToday(window.WORDS, Records.getAll(userId), format, DateUtil.todayString());
  }

  // 生徒ホーム：出題形式ごとに、今日の復習数・新しい単語数・覚えた単語数を表示
  function renderStudentHome(userId) {
    Quiz.FORMATS.forEach(function (format) {
      var plan = planToday(userId, format);
      var card = document.querySelector('[data-format-card="' + format + '"]');
      card.querySelector('[data-stat="reviews"]').textContent = plan.reviews.length;
      card.querySelector('[data-stat="news"]').textContent = plan.news.length;
      card.querySelector('[data-stat="mastered"]').textContent = plan.masteredCount;
      var done = plan.queue.length === 0;
      card.querySelector('[data-format]').hidden = done;
      card.querySelector('.done-message').hidden = !done;
    });
  }

  function startQuiz(format) {
    var me = Auth.currentUser();
    var questions = Quiz.createSession(format, Records.getAll(me.id), DateUtil.todayString());
    if (questions.length === 0) {
      render();
      return;
    }
    quiz = {
      format: format,
      questions: questions,
      index: 0,
      correctCount: 0,
      wrongWords: [],
      answered: false
    };
    show('quiz');
    showQuestion();
  }

  // 文の空所（____）の位置に、text を cls 付きの span で入れて表示する
  // cls が 'mark' のとき（日本語の例文）は、空所の前後のスペースを取って <mark> で囲む
  function renderSentence(el, sentence, text, cls) {
    var parts = sentence.split(Quiz.BLANK);
    if (cls === 'mark') {
      parts = parts.map(function (part, i) {
        if (i > 0) part = part.replace(/^ +/, '');
        if (i < parts.length - 1) part = part.replace(/ +$/, '');
        return part;
      });
    }
    el.textContent = '';
    parts.forEach(function (part, i) {
      el.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        var span = document.createElement(cls === 'mark' ? 'mark' : 'span');
        if (cls !== 'mark') span.className = cls;
        span.textContent = text;
        el.appendChild(span);
      }
    });
  }

  function showQuestion() {
    var q = quiz.questions[quiz.index];
    quiz.answered = false;
    $('quiz-label').textContent = FORMAT_LABELS[q.format] + '・' + q.word.grade + '級・' + (q.isReview ? '復習' : '新しい単語');
    $('quiz-progress').textContent = (quiz.index + 1) + ' / ' + quiz.questions.length;
    $('quiz-feedback').hidden = true;

    var isFill = q.format === 'fill';
    $('quiz-word-area').hidden = isFill;
    $('quiz-sentence-area').hidden = !isFill;
    if (isFill) {
      // 日本語の例文は空所を埋めて表示（答えの部分に色をつける）、英文は空所のまま
      renderSentence($('quiz-sentence-ja'), q.word.example.ja, q.word.example.jaAnswer, 'mark');
      renderSentence($('quiz-sentence-en'), q.word.example.en, '\u00a0', 'blank');
    } else {
      $('quiz-pos').textContent = '（' + q.word.pos + '）';
      $('quiz-prompt').textContent = q.format === 'en-ja' ? q.word.en : q.word.ja;
    }

    var choicesEl = $('quiz-choices');
    var formEl = $('quiz-input-form');
    choicesEl.textContent = '';
    if (q.format === 'en-ja') {
      formEl.hidden = true;
      choicesEl.hidden = false;
      q.choices.forEach(function (choice) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = choice;
        btn.addEventListener('click', function () { answer(choice); });
        choicesEl.appendChild(btn);
      });
    } else {
      choicesEl.hidden = true;
      formEl.hidden = false;
      formEl.reset();
      $('quiz-input-label').textContent = isFill ? '空所に入る英語を入力' : '英語で入力';
      $('quiz-input').disabled = false;
      formEl.querySelector('button').disabled = false;
      $('quiz-input').focus();
    }
  }

  function answer(value) {
    if (quiz.answered) return;
    var q = quiz.questions[quiz.index];
    var ok = Quiz.isCorrect(q, value);
    quiz.answered = true;
    if (ok) quiz.correctCount++; else quiz.wrongWords.push(q.word);
    Records.save(Auth.currentUser().id, q.word.id, q.format, ok);

    // 4択はボタンに色をつけて押せなくする／入力式は入力欄を止める
    Array.prototype.forEach.call($('quiz-choices').children, function (btn) {
      btn.disabled = true;
      if (btn.textContent === q.word.ja) btn.classList.add('is-correct');
      else if (btn.textContent === value) btn.classList.add('is-wrong');
    });
    $('quiz-input').disabled = true;
    $('quiz-input-form').querySelector('button').disabled = true;

    // 例文穴埋めは、英文の空所に正解を入れて見せる
    if (q.format === 'fill') {
      renderSentence($('quiz-sentence-en'), q.word.example.en, q.word.answers[0], 'blank filled');
    }

    var resultEl = $('quiz-feedback-result');
    resultEl.textContent = ok ? '⭕ 正解！' : '❌ 不正解';
    resultEl.className = 'feedback-result ' + (ok ? 'correct' : 'wrong');
    var others = q.word.answers.slice(1);
    $('quiz-feedback-answer').textContent = '正解：' + q.word.en +
      (others.length ? '（' + others.join(' / ') + ' でも正解）' : '') + ' ＝ ' + q.word.ja;
    var isLast = quiz.index === quiz.questions.length - 1;
    $('quiz-next').textContent = isLast ? '結果を見る' : '次へ';
    $('quiz-feedback').hidden = false;
    $('quiz-next').focus();
  }

  function showResult() {
    $('result-score').textContent = quiz.questions.length + '問中 ' + quiz.correctCount + '問 正解';
    var list = $('result-wrong-list');
    list.textContent = '';
    quiz.wrongWords.forEach(function (w) {
      var li = document.createElement('li');
      var en = document.createElement('span');
      en.className = 'en';
      en.textContent = w.en;
      var pos = document.createElement('span');
      pos.className = 'pos';
      pos.textContent = '（' + w.pos + '）';
      li.appendChild(en);
      li.appendChild(document.createTextNode(' ' + w.ja + ' '));
      li.appendChild(pos);
      list.appendChild(li);
    });
    $('result-wrong-area').hidden = quiz.wrongWords.length === 0;
    $('result-perfect').hidden = quiz.wrongWords.length !== 0;
    var left = planToday(Auth.currentUser().id, quiz.format).queue.length;
    $('result-done').hidden = left !== 0;
    $('result-remaining').hidden = left === 0;
    $('result-remaining').textContent = 'この形式の今日の問題は、あと ' + left + ' 問あります。ホームから続けられます。';
    show('result');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-format]'), function (btn) {
    btn.addEventListener('click', function () { startQuiz(btn.getAttribute('data-format')); });
  });

  $('quiz-input-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var value = $('quiz-input').value;
    if (!value.trim()) return; // 空のままでは答えにしない
    answer(value);
  });

  $('quiz-next').addEventListener('click', function () {
    if (quiz.index < quiz.questions.length - 1) {
      quiz.index++;
      showQuestion();
    } else {
      showResult();
    }
  });

  $('result-home').addEventListener('click', function () {
    quiz = null;
    render();
  });

  // ---- デモ用の日付操作 ----
  function updateDemoDate() {
    $('demo-date').textContent = DateUtil.displayDate(DateUtil.todayString());
    var offset = DemoDate.getOffset();
    $('demo-offset').textContent = offset ? '（' + (offset > 0 ? '+' : '') + offset + '日）' : '';
  }

  // 日付を変えたら、テストの途中でもホームに戻して出題を作り直す
  function onDemoDateChanged() {
    quiz = null;
    updateDemoDate();
    render();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-add-days]'), function (btn) {
    btn.addEventListener('click', function () {
      DemoDate.add(Number(btn.getAttribute('data-add-days')));
      onDemoDateChanged();
    });
  });

  $('demo-date-reset').addEventListener('click', function () {
    DemoDate.reset();
    onDemoDateChanged();
  });

  updateDemoDate();
  render();
})();
