// デモ用のログイン処理。
// ※デモ限定・本番では使わない：パスワードを localStorage に平文で保存している。
//   本番化するときは Firebase Authentication / Supabase Auth に置き換えること。
(function () {
  'use strict';

  var USERS_KEY = 'users';
  var SESSION_KEY = 'session';

  // デモ用の初期アカウント（デモ限定・本番では使わない）
  function initialUsers() {
    var users = {};
    for (var i = 1; i <= 5; i++) {
      users['juku00' + i] = { role: 'student', password: '1234', mustChangePassword: true };
    }
    users.teacher = { role: 'teacher', password: 'admin', mustChangePassword: true };
    return users;
  }

  function getUsers() {
    var users = AppStorage.get(USERS_KEY);
    if (!users) {
      users = initialUsers();
      AppStorage.set(USERS_KEY, users);
    }
    return users;
  }

  // ログイン。成功したらユーザー情報、失敗したら null を返す
  function login(id, password) {
    var users = getUsers();
    var user = users[id];
    if (!user || user.password !== password) return null;
    AppStorage.set(SESSION_KEY, { id: id });
    return currentUser();
  }

  function logout() {
    AppStorage.remove(SESSION_KEY);
  }

  // ログイン中のユーザー（いなければ null）
  function currentUser() {
    var session = AppStorage.get(SESSION_KEY);
    if (!session) return null;
    var user = getUsers()[session.id];
    if (!user) {
      logout();
      return null;
    }
    return { id: session.id, role: user.role, mustChangePassword: user.mustChangePassword };
  }

  // パスワード変更。問題があればエラーメッセージ、成功したら null を返す
  function changePassword(newPassword, confirmPassword) {
    var me = currentUser();
    if (!me) return 'ログインしてください。';
    if (!newPassword) return '新しいパスワードを入力してください。';
    if (newPassword.length < 4) return 'パスワードは4文字以上にしてください。';
    if (newPassword !== confirmPassword) return '確認用のパスワードが一致しません。';
    var users = getUsers();
    if (users[me.id].password === newPassword) return '今と違うパスワードにしてください。';
    users[me.id].password = newPassword;
    users[me.id].mustChangePassword = false;
    AppStorage.set(USERS_KEY, users);
    return null;
  }

  // 全データを初期状態に戻す
  function resetDemoData() {
    AppStorage.clearAll();
    AppStorage.set(USERS_KEY, initialUsers());
  }

  window.Auth = {
    login: login,
    logout: logout,
    currentUser: currentUser,
    changePassword: changePassword,
    resetDemoData: resetDemoData
  };
})();
