// 画面の切り替え
(function () {
  'use strict';

  var screens = ['login', 'change-password', 'student-home', 'teacher-home'];

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
    $('login-form').reset();
    showMessage('login-error', '');
    showMessage('login-info', 'デモデータを初期状態に戻しました。');
    render();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-action="logout"]'), function (btn) {
    btn.addEventListener('click', logout);
  });

  render();
})();
