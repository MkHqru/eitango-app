// デモ用のログイン処理。
// ※デモ限定・本番では使わない：パスワードを localStorage に平文で保存している。
//   本番化するときは Firebase Authentication / Supabase Auth に置き換えること。
(function () {
  'use strict';

  var USERS_KEY = 'users';
  var SESSION_KEY = 'session';
  var LAST_NUMBER_KEY = 'lastStudentNumber'; // これまでに使った生徒IDの番号の最大（削除したIDを使い回さないため）
  var STUDENT_PREFIX = 'juku';
  var INITIAL_STUDENT_PASSWORD = '1234'; // デモ限定・本番では使わない

  // デモ用の初期アカウント（デモ限定・本番では使わない）
  // サンプル生徒（juku001〜005）と先生は、デモをすぐ始められるように「初回のパスワード変更を済ませた状態」にする。
  // パスワードは 1234 / admin のまま。先生が新しく追加した生徒や、パスワードをリセットした生徒は、次のログインで変更画面が出る
  function initialUsers() {
    var users = {};
    for (var i = 1; i <= 5; i++) {
      users[studentId(i)] = { role: 'student', password: INITIAL_STUDENT_PASSWORD, mustChangePassword: false };
    }
    users.teacher = { role: 'teacher', password: 'admin', mustChangePassword: false };
    return users;
  }

  // 生徒ID：juku + 3けたの番号（juku001、juku006 など）
  function studentId(n) {
    var s = String(n);
    while (s.length < 3) s = '0' + s;
    return STUDENT_PREFIX + s;
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

  // 全データを消して、アカウントだけを初期状態に戻す
  // （サンプルの学習記録も入れるときは js/sample.js の DemoData.reset() を使う）
  function resetDemoData() {
    AppStorage.clearAll();
    AppStorage.set(USERS_KEY, initialUsers());
  }

  // アカウントのデータがすでに保存されているか（初回起動の判定に使う）
  function hasAccounts() {
    return !!AppStorage.get(USERS_KEY);
  }

  // ---- 先生だけができる操作（先生でログインしていないときは何もしない）----
  function isTeacher() {
    var me = currentUser();
    return !!me && me.role === 'teacher' && !me.mustChangePassword;
  }

  var NOT_TEACHER = '先生のIDでログインしてください。';

  // 生徒のID一覧（ID順）
  function listStudents() {
    if (!isTeacher()) return [];
    var users = getUsers();
    return Object.keys(users).filter(function (id) { return users[id].role === 'student'; }).sort();
  }

  // 生徒IDの番号（juku006 → 6。生徒IDの形でなければ 0）
  function studentNumber(id) {
    var m = new RegExp('^' + STUDENT_PREFIX + '(\\d+)$').exec(id);
    return m ? Number(m[1]) : 0;
  }

  // 生徒を追加する。IDは自動で連番（今いる生徒と、これまでに使った番号の続き）
  // 結果：{ id: 'juku006' } または { error: 'メッセージ' }
  function addStudent() {
    if (!isTeacher()) return { error: NOT_TEACHER };
    var users = getUsers();
    var max = AppStorage.get(LAST_NUMBER_KEY) || 0;
    Object.keys(users).forEach(function (id) {
      max = Math.max(max, studentNumber(id));
    });
    var id = studentId(max + 1);
    users[id] = { role: 'student', password: INITIAL_STUDENT_PASSWORD, mustChangePassword: true };
    AppStorage.set(USERS_KEY, users);
    AppStorage.set(LAST_NUMBER_KEY, max + 1);
    return { id: id };
  }

  // パスワードを初期パスワードに戻し、次回ログイン時に変更させる。問題があればメッセージ、成功したら null
  function resetStudentPassword(id) {
    if (!isTeacher()) return NOT_TEACHER;
    var users = getUsers();
    if (!users[id] || users[id].role !== 'student') return id + ' という生徒はいません。';
    users[id].password = INITIAL_STUDENT_PASSWORD;
    users[id].mustChangePassword = true;
    AppStorage.set(USERS_KEY, users);
    return null;
  }

  // 生徒のアカウントを削除する（学習記録などの削除は js/teacher.js で行う）。問題があればメッセージ、成功したら null
  function deleteStudent(id) {
    if (!isTeacher()) return NOT_TEACHER;
    var users = getUsers();
    if (!users[id] || users[id].role !== 'student') return id + ' という生徒はいません。';
    // 削除したIDの番号を覚えておき、次に追加するときに使い回さない
    AppStorage.set(LAST_NUMBER_KEY, Math.max(AppStorage.get(LAST_NUMBER_KEY) || 0, studentNumber(id)));
    delete users[id];
    AppStorage.set(USERS_KEY, users);
    return null;
  }

  window.Auth = {
    login: login,
    logout: logout,
    currentUser: currentUser,
    changePassword: changePassword,
    resetDemoData: resetDemoData,
    hasAccounts: hasAccounts,
    INITIAL_STUDENT_PASSWORD: INITIAL_STUDENT_PASSWORD,
    isTeacher: isTeacher,
    listStudents: listStudents,
    addStudent: addStudent,
    resetStudentPassword: resetStudentPassword,
    deleteStudent: deleteStudent
  };
})();
