// 単語テストの問題づくりと判定
// 出題形式：'en-ja'（英→日・4択） / 'ja-en'（日→英・入力） / 'fill'（例文穴埋め・入力）
(function () {
  'use strict';

  var QUESTION_COUNT = 10;
  var CHOICE_COUNT = 4;
  var BLANK = '____';
  var FORMATS = ['en-ja', 'ja-en', 'fill'];
  var GRADES = [20, 19, 18];

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function wordsOfGrade(grade, words) {
    return (words || window.WORDS).filter(function (w) { return w.grade === grade; });
  }

  // 英→日の選択肢（日本語訳4つ）。不正解はできるだけ同じ品詞から選ぶ
  function makeChoices(word, candidates) {
    var used = {};
    used[word.ja] = true;
    var wrong = [];
    var samePos = shuffle(candidates.filter(function (w) { return w.pos === word.pos; }));
    var otherPos = shuffle(candidates.filter(function (w) { return w.pos !== word.pos; }));
    samePos.concat(otherPos).forEach(function (w) {
      if (wrong.length >= CHOICE_COUNT - 1 || used[w.ja]) return;
      used[w.ja] = true;
      wrong.push(w.ja);
    });
    return shuffle([word.ja].concat(wrong));
  }

  // 今日の出題予定（js/schedule.js）から、1回分（最大10問）の問題を作る
  //   順番は ①出題日を過ぎた復習の単語 → ②まだ出していない新しい単語（級の低い順）
  //   4択の不正解の選択肢は、その単語と同じ級の単語から選ぶ
  function createSession(format, records, todayStr, words) {
    words = words || window.WORDS;
    var plan = Schedule.planToday(words, records, format, todayStr);
    return plan.queue.slice(0, QUESTION_COUNT).map(function (word, i) {
      var q = { word: word, format: format, isReview: i < plan.reviews.length };
      if (format === 'en-ja') q.choices = makeChoices(word, wordsOfGrade(word.grade, words));
      return q;
    });
  }

  // 入力の判定用に整える：
  // 大文字・小文字、前後の空白、語と語の間の空白の数、アポストロフィーの種類（' と ’）の違いを無視する
  function normalize(text) {
    return String(text || '')
      .replace(/[‘’ʼ`´]/g, "'")
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function isCorrect(question, answer) {
    var word = question.word;
    if (question.format === 'en-ja') return answer === word.ja;
    var a = normalize(answer);
    return word.answers.some(function (ans) { return normalize(ans) === a; });
  }

  // 例文の空所を text で埋める
  function fillBlank(sentence, text) {
    return sentence.replace(BLANK, text);
  }

  window.Quiz = {
    QUESTION_COUNT: QUESTION_COUNT,
    BLANK: BLANK,
    FORMATS: FORMATS,
    GRADES: GRADES,
    wordsOfGrade: wordsOfGrade,
    createSession: createSession,
    makeChoices: makeChoices,
    normalize: normalize,
    isCorrect: isCorrect,
    fillBlank: fillBlank
  };
})();
