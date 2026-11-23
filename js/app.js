// 画面の切り替え
(function () {
  'use strict';

  var screens = ['login', 'change-password', 'student-home', 'quiz', 'result', 'teacher-home', 'teacher-student'];

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
    // 先生用の画面は、先生IDでログインしているときだけ表示する
    if (me.role === 'teacher') {
      if (teacherView.studentId) {
        renderTeacherStudent();
      } else {
        $('teacher-user-id').textContent = me.id;
        renderTeacherHome();
        show('teacher-home');
      }
    } else {
      teacherView.studentId = null;
      $('student-user-id').textContent = me.id;
      renderStudentHome(me.id);
      show('student-home');
    }
  }

  function logout() {
    Auth.logout();
    teacherView.studentId = null;
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
    teacherView.studentId = null;
    updateDemoDate();
    $('login-form').reset();
    showMessage('login-error', '');
    showMessage('login-info', 'デモデータを初期状態に戻しました。');
    render();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-action="logout"]'), function (btn) {
    btn.addEventListener('click', logout);
  });

  // ---- 先生画面 ----
  // 数字は js/teacher.js 経由で、生徒画面と同じ計算（js/schedule.js・js/grade.js）を使う
  var teacherView = { studentId: null, rankingFormat: 'en-ja', detailFormat: 'en-ja' };
  var SHORT_FORMAT = { 'en-ja': '英→日', 'ja-en': '日→英', 'fill': '穴埋め' };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // 形式ごとの数（英→日 3・日→英 0・穴埋め 1）。形式ごとに折り返す
  function perFormat(counts) {
    var frag = document.createDocumentFragment();
    Quiz.FORMATS.forEach(function (f, i) {
      frag.appendChild(el('span', 'pf', SHORT_FORMAT[f] + ' ' + counts[f] + (i < Quiz.FORMATS.length - 1 ? '・' : '')));
    });
    return frag;
  }

  function gradeText(r) {
    return r.allCleared ? r.currentGrade + '級 合格（デモ版の最後）' : '今の級 ' + r.currentGrade + '級';
  }

  function lastStudiedText(r) {
    if (!r.lastStudied) return 'まだ学習していません';
    var ago = r.daysSince === 0 ? '今日' : r.daysSince > 0 ? r.daysSince + '日前' : '';
    return DateUtil.displayDate(r.lastStudied) + (ago ? '（' + ago + '）' : '');
  }

  function summaryGrid(r) {
    var dl = el('dl', 'summary-grid');
    [
      ['最後に学習', lastStudiedText(r), r.inactive],
      ['正答率', r.accuracy === null ? '—' : r.accuracy + '%（' + r.answered + '回答）'],
      ['覚えた単語', perFormat(r.mastered)],
      ['今日の復習の残り', perFormat(r.reviews)]
    ].forEach(function (row) {
      dl.appendChild(el('dt', '', row[0]));
      var dd = el('dd', row[2] ? 'inactive-text' : '');
      if (typeof row[1] === 'string') dd.textContent = row[1];
      else dd.appendChild(row[1]);
      dl.appendChild(dd);
    });
    return dl;
  }

  function inactiveBadge(r) {
    return el('span', 'badge warn', r.lastStudied ? r.daysSince + '日学習なし' : '未学習');
  }

  function renderWeakList(listId, emptyId, items, showStudents) {
    var list = $(listId);
    list.textContent = '';
    items.forEach(function (it) {
      var li = el('li');
      li.appendChild(el('span', 'en', it.word.en));
      li.appendChild(document.createTextNode(' ' + it.word.ja + '（' + it.word.grade + '級）'));
      li.appendChild(el('span', 'meta', '不正解 ' + it.wrong + '回' +
        (showStudents ? '（' + it.students + '人）' : '・正解 ' + it.correct + '回')));
      list.appendChild(li);
    });
    $(emptyId).hidden = items.length !== 0;
  }

  function updateTabs(name, format) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tabs="' + name + '"] button'), function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab-format') === format));
    });
  }

  function renderTeacherHome() {
    var list = $('student-list');
    list.textContent = '';
    Teacher.allReports().forEach(function (r) {
      var li = el('li');
      var btn = el('button', 'student-item' + (r.inactive ? ' inactive' : ''));
      btn.type = 'button';
      btn.setAttribute('data-student', r.id);
      var head = el('div', 'head');
      head.appendChild(el('span', 'sid', r.id));
      head.appendChild(el('span', 'badge', gradeText(r)));
      if (r.inactive) head.appendChild(inactiveBadge(r));
      btn.appendChild(head);
      btn.appendChild(summaryGrid(r));
      btn.addEventListener('click', function () { openStudent(r.id); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    updateTabs('ranking', teacherView.rankingFormat);
    renderWeakList('ranking-list', 'ranking-empty', Teacher.ranking(teacherView.rankingFormat), true);
  }

  function openStudent(id) {
    teacherView.studentId = id;
    $('delete-confirm').hidden = true;
    showMessage('detail-message', '');
    showMessage('teacher-message', '');
    render();
    window.scrollTo(0, 0);
  }

  function renderTeacherStudent() {
    var r = Teacher.studentReport(teacherView.studentId);
    if (!r || Auth.listStudents().indexOf(teacherView.studentId) === -1) {
      teacherView.studentId = null;
      render();
      return;
    }
    $('detail-id').textContent = r.id;
    var box = $('detail-summary');
    box.textContent = '';
    var head = el('div', 'head');
    head.appendChild(el('span', 'badge', gradeText(r)));
    if (r.inactive) head.appendChild(inactiveBadge(r));
    box.appendChild(head);
    box.appendChild(summaryGrid(r));
    updateTabs('detail', teacherView.detailFormat);
    renderWeakList('detail-weak-list', 'detail-weak-empty', Teacher.studentWeakWords(r.id, teacherView.detailFormat), false);
    $('delete-confirm-id').textContent = r.id;
    show('teacher-student');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'), function (group) {
    var name = group.getAttribute('data-tabs');
    Array.prototype.forEach.call(group.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        teacherView[name + 'Format'] = b.getAttribute('data-tab-format');
        render();
      });
    });
  });

  $('add-student').addEventListener('click', function () {
    var result = Auth.addStudent();
    showMessage('teacher-message', result.error ||
      result.id + ' を追加しました。初期パスワードは ' + Auth.INITIAL_STUDENT_PASSWORD + ' です（はじめてのログインで変更します）。');
    render();
  });

  $('back-to-list').addEventListener('click', function () {
    teacherView.studentId = null;
    render();
  });

  $('reset-student-password').addEventListener('click', function () {
    var id = teacherView.studentId;
    var error = Auth.resetStudentPassword(id);
    showMessage('detail-message', error ||
      id + ' のパスワードを初期パスワード（' + Auth.INITIAL_STUDENT_PASSWORD + '）に戻しました。次にログインしたとき、パスワードの変更画面が出ます。');
  });

  // 削除は画面の中で確認する（ブラウザの confirm() は使わない）
  $('delete-student').addEventListener('click', function () {
    $('delete-confirm').hidden = false;
  });

  $('delete-confirm-no').addEventListener('click', function () {
    $('delete-confirm').hidden = true;
  });

  $('delete-confirm-yes').addEventListener('click', function () {
    var id = teacherView.studentId;
    var error = Teacher.deleteStudent(id);
    $('delete-confirm').hidden = true;
    if (error) {
      showMessage('detail-message', error);
      return;
    }
    teacherView.studentId = null;
    showMessage('teacher-message', id + ' を削除しました。');
    render();
  });

  // ---- 単語テスト ----
  var FORMAT_LABELS = { 'en-ja': '英語 → 日本語', 'ja-en': '日本語 → 英語', 'fill': '例文穴埋め' };
  var quiz = null; // { format, isExam, grade, questions, index, correctCount, wrongWords, answered }

  // 出題形式ごとの今日の予定（復習はすべての級、新しい単語は今の級まで＝今の級と下の級から）
  function planToday(userId, format) {
    var grade = GradeProgress.get(userId).currentGrade;
    return Schedule.planToday(window.WORDS, Records.getAll(userId), format, DateUtil.todayString(), grade);
  }

  function examStatus(userId) {
    return GradeProgress.examStatus(GradeProgress.get(userId), window.WORDS, Records.getAll(userId), DateUtil.todayString());
  }

  // 生徒ホーム：今の級と合格テスト、出題形式ごとの今日の予定を表示
  function renderStudentHome(userId) {
    var progress = GradeProgress.get(userId);
    var status = examStatus(userId);
    $('current-grade').textContent = progress.currentGrade + '級';
    $('grade-learned').textContent = status.learned + ' / ' + status.total;
    $('grade-progress-bar').style.width = (status.total ? status.learned / status.total * 100 : 0) + '%';
    $('exam-button').textContent = progress.currentGrade + '級の合格テストを受ける（' + status.total + '問）';
    $('exam-button').disabled = !status.canTake;
    $('exam-button').hidden = progress.allCleared;
    $('exam-reason').textContent = status.reason;
    $('exam-reason').hidden = progress.allCleared || status.canTake;
    $('all-cleared').hidden = !progress.allCleared;

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

  function beginQuiz(q) {
    quiz = q;
    quiz.index = 0;
    quiz.correctCount = 0;
    quiz.wrongWords = [];
    quiz.answered = false;
    show('quiz');
    showQuestion();
  }

  function startQuiz(format) {
    var me = Auth.currentUser();
    var grade = GradeProgress.get(me.id).currentGrade;
    var questions = Quiz.createSession(format, Records.getAll(me.id), DateUtil.todayString(), grade);
    if (questions.length === 0) {
      render();
      return;
    }
    beginQuiz({ format: format, isExam: false, questions: questions });
  }

  // 合格テスト：今の級の40語すべての例文穴埋め（順番はランダム）
  function startExam() {
    var me = Auth.currentUser();
    if (!examStatus(me.id).canTake) {
      render();
      return;
    }
    var grade = GradeProgress.get(me.id).currentGrade;
    beginQuiz({ format: GradeProgress.EXAM_FORMAT, isExam: true, grade: grade, questions: Quiz.createExam(grade) });
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
    $('quiz-label').textContent = quiz.isExam
      ? quiz.grade + '級 合格テスト'
      : FORMAT_LABELS[q.format] + '・' + q.word.grade + '級・' + (q.isReview ? '復習' : '新しい単語');
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
    if (quiz.isExam) {
      showExamResult();
    } else {
      $('result-title').textContent = '結果';
      $('result-exam').hidden = true;
      $('result-exam-note').hidden = true;
      var left = planToday(Auth.currentUser().id, quiz.format).queue.length;
      $('result-done').hidden = left !== 0;
      $('result-remaining').hidden = left === 0;
      $('result-remaining').textContent = 'この形式の今日の問題は、あと ' + left + ' 問あります。ホームから続けられます。';
    }
    show('result');
  }

  // 合格テストの結果：合格なら次の級へ。不合格なら再挑戦は翌日から
  function showExamResult() {
    var userId = Auth.currentUser().id;
    var total = quiz.questions.length;
    var outcome = GradeProgress.applyExamResult(GradeProgress.get(userId), quiz.correctCount, total, DateUtil.todayString());
    GradeProgress.save(userId, outcome.progress);

    $('result-title').textContent = quiz.grade + '級 合格テストの結果';
    $('result-done').hidden = true;
    $('result-remaining').hidden = true;
    var msg = $('result-exam');
    var note = $('result-exam-note');
    msg.hidden = false;
    note.hidden = false;
    msg.className = 'exam-result ' + (outcome.passed ? 'pass' : 'fail');
    if (!outcome.passed) {
      msg.textContent = '不合格';
      note.textContent = '合格は ' + GradeProgress.passCount(total) + '問以上です。下の単語を復習して、明日もう一度挑戦しよう。';
    } else if (outcome.progress.allCleared) {
      msg.textContent = '🎉 合格！';
      note.textContent = 'デモ版で用意している級はここまでです。';
    } else {
      msg.textContent = '🎉 合格！' + outcome.progress.currentGrade + '級に上がりました';
      note.textContent = 'これから新しい単語は ' + outcome.progress.currentGrade + '級の単語も出ます（' + quiz.grade + '級でまだ出していない単語が先に出ます）。' + quiz.grade + '級の単語の復習も続けて出ます。';
    }
  }

  $('exam-button').addEventListener('click', startExam);

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
