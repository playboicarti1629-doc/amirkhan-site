/* Панель владельца: вход, просмотр, добавление, редактирование и удаление отзывов.
   Права доступа проверяет сама база (RLS в supabase/setup.sql), а не этот скрипт. */
(function () {
  'use strict';

  var loginBox = document.getElementById('loginBox');
  var panel = document.getElementById('adminPanel');
  if (!loginBox || !panel) return;

  var loginForm = document.getElementById('loginForm');
  var loginStatus = document.getElementById('loginStatus');
  var logoutBtn = document.getElementById('logoutBtn');
  var addBtn = document.getElementById('addBtn');
  var tbody = document.getElementById('adminRows');
  var adminStatus = document.getElementById('adminStatus');
  var editDialog = document.getElementById('editDialog');
  var editForm = document.getElementById('editForm');
  var editTitle = document.getElementById('editTitle');
  var confirmDialog = document.getElementById('confirmDialog');
  var confirmText = document.getElementById('confirmText');
  var confirmYes = document.getElementById('confirmYes');

  var client = window.DB.client;
  var rows = [];
  var editingId = null;
  var deletingId = null;

  function showLogin(message) {
    loginBox.hidden = false;
    panel.hidden = true;
    loginStatus.textContent = message || '';
  }
  function showPanel() {
    loginBox.hidden = true;
    panel.hidden = false;
    loadRows();
  }

  if (!client) {
    showLogin(window.DB.problem);
    loginForm.querySelector('button').disabled = true;
    return;
  }

  // ---------- Вход и выход ----------
  client.auth.getSession().then(function (res) {
    if (res.data && res.data.session) showPanel(); else showLogin('');
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = loginForm.elements.email.value.trim();
    var password = loginForm.elements.password.value;
    if (!email || !password) {
      loginStatus.textContent = 'Введите почту и пароль.';
      return;
    }
    loginStatus.textContent = 'Проверяю…';
    client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) {
        loginStatus.textContent = 'Не удалось войти: неверная почта или пароль.';
        return;
      }
      loginForm.reset();
      showPanel();
    }).catch(function () {
      loginStatus.textContent = 'Ошибка сети. Попробуйте ещё раз.';
    });
  });

  logoutBtn.addEventListener('click', function () {
    client.auth.signOut().then(function () {
      rows = [];
      showLogin('Вы вышли из панели.');
    });
  });

  // ---------- Просмотр записей ----------
  function loadRows() {
    adminStatus.hidden = false;
    adminStatus.textContent = 'Загружаю записи…';
    return client.from('reviews').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) throw res.error;
      rows = res.data || [];
      renderRows();
      adminStatus.hidden = rows.length > 0;
      if (!rows.length) adminStatus.textContent = 'Записей нет. Если они должны быть, проверьте, что вы вошли с почтой владельца (см. SETUP.md).';
    }).catch(function (err) {
      rows = [];
      renderRows();
      adminStatus.hidden = false;
      adminStatus.textContent = 'Не удалось получить записи: ' + (err && err.message ? err.message : 'ошибка сети');
    });
  }

  function cell(text) {
    var td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function renderRows() {
    tbody.replaceChildren();
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.append(
        cell(String(r.id)),
        cell(window.formatDate(r.created_at)),
        cell(r.name),
        cell(r.email),
        cell(r.category),
        cell(r.rating + ' / 5'),
        cell(r.message)
      );
      var actions = document.createElement('td');
      var box = document.createElement('div');
      box.className = 'row-actions';
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn secondary';
      edit.textContent = 'Изменить';
      edit.addEventListener('click', function () { openEdit(r); });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn danger';
      del.textContent = 'Удалить';
      del.addEventListener('click', function () { askDelete(r); });
      box.append(edit, del);
      actions.appendChild(box);
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
  }

  // ---------- Добавление и редактирование ----------
  function fillForm(r) {
    editForm.elements.name.value = r ? r.name : '';
    editForm.elements.email.value = r ? r.email : '';
    editForm.elements.category.value = r ? r.category : '';
    editForm.querySelectorAll('input[name="rating"]').forEach(function (radio) {
      radio.checked = !!r && radio.value === String(r.rating);
    });
    editForm.elements.message.value = r ? r.message : '';
    editForm.elements.suggestion.value = r && r.suggestion ? r.suggestion : '';
    window.showFieldErrors(editForm, {});
  }
  function openEdit(r) {
    editingId = r.id;
    editTitle.textContent = 'Изменить запись № ' + r.id;
    fillForm(r);
    editDialog.showModal();
  }
  addBtn.addEventListener('click', function () {
    editingId = null;
    editTitle.textContent = 'Новая запись';
    fillForm(null);
    editDialog.showModal();
  });
  editDialog.querySelector('[data-cancel]').addEventListener('click', function () { editDialog.close(); });

  editForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var result = window.validateReview({
      name: editForm.elements.name.value,
      email: editForm.elements.email.value,
      category: editForm.elements.category.value,
      rating: editForm.elements.rating.value,
      message: editForm.elements.message.value,
      suggestion: editForm.elements.suggestion.value
    });
    window.showFieldErrors(editForm, result.errors);
    if (!result.ok) return;

    var request = editingId === null
      ? client.from('reviews').insert([result.clean])
      : client.from('reviews').update(result.clean).eq('id', editingId).select();

    request.then(function (res) {
      if (res.error) throw res.error;
      if (editingId !== null && (!res.data || !res.data.length)) {
        throw new Error('нет прав на изменение (войдите с почтой владельца)');
      }
      editDialog.close();
      window.showToast(editingId === null ? 'Запись добавлена.' : 'Запись обновлена.', false);
      return loadRows();
    }).catch(function (err) {
      window.showToast('Ошибка сохранения: ' + (err && err.message ? err.message : 'ошибка сети'), true);
    });
  });

  // ---------- Удаление ----------
  function askDelete(r) {
    deletingId = r.id;
    confirmText.textContent = 'Удалить отзыв «' + r.name + '» (№ ' + r.id + ')? Действие нельзя отменить.';
    confirmDialog.showModal();
  }
  confirmDialog.querySelector('[data-cancel]').addEventListener('click', function () { confirmDialog.close(); });
  confirmYes.addEventListener('click', function () {
    var id = deletingId;
    client.from('reviews').delete().eq('id', id).select().then(function (res) {
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('нет прав на удаление');
      confirmDialog.close();
      window.showToast('Запись удалена.', false);
      return loadRows();
    }).catch(function (err) {
      confirmDialog.close();
      window.showToast('Ошибка удаления: ' + (err && err.message ? err.message : 'ошибка сети'), true);
    });
  });
})();
