/* Подключение к базе данных Supabase и общие вспомогательные функции для форм. */
(function () {
  'use strict';

  var cfg = window.SITE_CONFIG || {};
  var client = null;
  var problem = '';

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    problem = 'База данных ещё не подключена: заполните js/config.js (см. SETUP.md).';
  } else if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    problem = 'Не удалось загрузить библиотеку Supabase. Проверьте подключение к интернету.';
  } else {
    try {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } catch (e) {
      problem = 'Ошибка подключения к базе данных: ' + e.message;
    }
  }

  window.DB = {
    client: client,
    problem: problem,
    categories: ['Работы по информатике', 'Blender', 'Figma', 'Дизайн сайта', 'Другое']
  };

  // Правила проверки полей — те же ограничения заданы и в самой базе (supabase/setup.sql).
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  window.validateReview = function (data) {
    var errors = {};
    var name = (data.name || '').trim();
    var email = (data.email || '').trim();
    var message = (data.message || '').trim();
    var suggestion = (data.suggestion || '').trim();
    var rating = Number(data.rating);

    if (name.length < 2) errors.name = 'Введите имя (не короче 2 символов).';
    else if (name.length > 50) errors.name = 'Имя не должно быть длиннее 50 символов.';

    if (!email) errors.email = 'Введите адрес электронной почты.';
    else if (!EMAIL_RE.test(email) || email.length > 100) errors.email = 'Адрес почты выглядит неверно, например name@mail.com.';

    if (window.DB.categories.indexOf(data.category) < 0) errors.category = 'Выберите тему отзыва.';

    if (!(rating >= 1 && rating <= 5)) errors.rating = 'Поставьте оценку от 1 до 5.';

    if (message.length < 10) errors.message = 'Напишите отзыв не короче 10 символов.';
    else if (message.length > 500) errors.message = 'Отзыв не должен быть длиннее 500 символов.';

    if (suggestion.length > 300) errors.suggestion = 'Предложение не должно быть длиннее 300 символов.';

    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      clean: {
        name: name,
        email: email,
        category: data.category,
        rating: rating,
        message: message,
        suggestion: suggestion || null
      }
    };
  };

  // Показ ошибок под полями формы.
  window.showFieldErrors = function (form, errors) {
    form.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
    Object.keys(errors).forEach(function (field) {
      var err = form.querySelector('[data-error-for="' + field + '"]');
      if (err) err.textContent = errors[field];
      var input = form.elements[field];
      if (input && input.classList) input.classList.add('invalid');
    });
    var first = Object.keys(errors)[0];
    if (first && form.elements[first] && form.elements[first].focus) form.elements[first].focus();
  };

  window.formatDate = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  window.stars = function (n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  };
})();
