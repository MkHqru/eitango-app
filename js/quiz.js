// 単語テストの問題づくりと判定
// 出題方向：'en-ja'（英→日・4択） / 'ja-en'（日→英・入力式）
(function () {
  'use strict';

  var QUESTION_COUNT = 10;
  var CHOICE_COUNT = 4;

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 英→日の選択肢（日本語訳4つ）。不正解はできるだけ同じ品詞から選ぶ
  function makeChoices(word, words) {
    var used = {};
    used[word.ja] = true;
    var wrong = [];
    var samePos = shuffle(words.filter(function (w) { return w.pos === word.pos; }));
    var otherPos = shuffle(words.filter(function (w) { return w.pos !== word.pos; }));
    samePos.concat(otherPos).forEach(function (w) {
      if (wrong.length >= CHOICE_COUNT - 1 || used[w.ja]) return;
      used[w.ja] = true;
      wrong.push(w.ja);
    });
    return shuffle([word.ja].concat(wrong));
  }

  // 1回分（10問）の問題を作る。このIssueでは出題順はランダム
  function createQuestions(direction, words) {
    words = words || window.WORDS;
    return shuffle(words).slice(0, QUESTION_COUNT).map(function (word) {
      var q = { word: word, direction: direction };
      if (direction === 'en-ja') q.choices = makeChoices(word, words);
      return q;
    });
  }

  // 日→英の判定：大文字・小文字の違いと前後の空白は無視する
  function normalize(text) {
    return String(text || '').trim().toLowerCase();
  }

  function isCorrect(question, answer) {
    if (question.direction === 'en-ja') return answer === question.word.ja;
    return normalize(answer) === normalize(question.word.en);
  }

  window.Quiz = {
    QUESTION_COUNT: QUESTION_COUNT,
    createQuestions: createQuestions,
    isCorrect: isCorrect
  };
})();
