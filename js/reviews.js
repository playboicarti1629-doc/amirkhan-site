/* Страница отзывов: форма (проверка → сохранение в базу) и вывод данных из базы с обработкой. */
(function () {
  'use strict';

  var form = document.getElementById('reviewForm');
  var listEl = document.getElementById('reviewList');
  if (!form || !listEl) return;

  var statusEl = document.getElementById('listStatus');
  var statsEl = document.getElementById('stats');
  var filterCategory = document.getElementById('filterCategory');
  var sortBy = document.getElementById('sortBy');
  var searchReviews = document.getElementById('searchReviews');
  var reloadBtn = document.getElementById('reloadBtn');
  var submitBtn = form.querySelector('button[type="submit"]');

  var allReviews = [];

  // ---------- Счётчики символов ----------
  form.querySelectorAll('textarea[maxlength]').forEach(function (area) {
    var out = form.querySelector('[data-counter-for="' + area.name + '"]');
    function update() { if (out) out.textContent = area.value.length + ' / ' + area.maxLength; }
    area.addEventListener('input', update);
    update();
  });

  // ---------- Отправка формы ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      category: form.elements.category.value,
      rating: (form.querySelector('input[name="rating"]:checked') || {}).value,
      message: form.elements.message.value,
      suggestion: form.elements.suggestion.value
    };
    var result = window.validateReview(data);
    window.showFieldErrors(form, result.errors);
    if (!result.ok) {
      window.showToast('Проверьте поля формы: есть ошибки.', true);
      return;
    }
    if (!window.DB.client) {
      window.showToast(window.DB.problem, true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляю…';
    window.DB.client.from('reviews').insert([result.clean]).then(function (res) {
      if (res.error) throw res.error;
      window.showToast('Спасибо! Отзыв сохранён.', false);
      form.reset();
      window.showFieldErrors(form, {});
      form.querySelectorAll('textarea[maxlength]').forEach(function (a) { a.dispatchEvent(new Event('input')); });
      return loadReviews();
    }).catch(function (err) {
      window.showToast('Не удалось сохранить отзыв: ' + (err && err.message ? err.message : 'ошибка сети'), true);
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить отзыв';
    });
  });

  // ---------- Получение данных из базы ----------
  function loadReviews() {
    setStatus('Загружаю отзывы…');
    if (!window.DB.client) {
      allReviews = [];
      render();
      setStatus(window.DB.problem, true);
      return Promise.resolve();
    }
    return window.DB.client
      .from('reviews_public')
      .select('id, created_at, name, category, rating, message')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        allReviews = res.data || [];
        setStatus('');
        render();
      })
      .catch(function (err) {
        allReviews = [];
        render();
        setStatus('Не удалось получить отзывы: ' + (err && err.message ? err.message : 'ошибка сети') + '. Нажмите «Обновить».', true);
      });
  }

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.hidden = !text;
    statusEl.className = 'empty-message';
    if (isError) statusEl.style.background = 'var(--coral)'; else statusEl.style.background = '';
    if (isError) statusEl.style.color = '#111'; else statusEl.style.color = '';
  }

  // ---------- Обработка данных (6 функций) ----------
  function filterByCategory(items, category) {
    return category ? items.filter(function (r) { return r.category === category; }) : items;
  }
  function searchByText(items, query) {
    var q = query.trim().toLowerCase();
    if (q.length < 2) return items;
    return items.filter(function (r) {
      return (r.name + ' ' + r.message).toLowerCase().indexOf(q) >= 0;
    });
  }
  function sortItems(items, mode) {
    var copy = items.slice();
    copy.sort(function (a, b) {
      if (mode === 'old') return new Date(a.created_at) - new Date(b.created_at);
      if (mode === 'high') return b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at);
      if (mode === 'low') return a.rating - b.rating || new Date(b.created_at) - new Date(a.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return copy;
  }
  function averageRating(items) {
    if (!items.length) return 0;
    return items.reduce(function (sum, r) { return sum + r.rating; }, 0) / items.length;
  }
  function countByCategory(items) {
    var map = {};
    items.forEach(function (r) { map[r.category] = (map[r.category] || 0) + 1; });
    return map;
  }
  function topCategory(items) {
    var map = countByCategory(items), best = '', max = 0;
    Object.keys(map).forEach(function (k) { if (map[k] > max) { max = map[k]; best = k; } });
    return best ? best + ' (' + max + ')' : '—';
  }

  // ---------- Вывод на страницу ----------
  function statBlock(value, label) {
    var box = document.createElement('div');
    box.className = 'stat';
    var strong = document.createElement('strong');
    strong.textContent = value;
    var span = document.createElement('span');
    span.textContent = label;
    box.append(strong, span);
    return box;
  }

  function render() {
    var items = filterByCategory(allReviews, filterCategory.value);
    items = searchByText(items, searchReviews.value);
    items = sortItems(items, sortBy.value);

    statsEl.replaceChildren(
      statBlock(String(items.length), 'отзывов показано (всего ' + allReviews.length + ')'),
      statBlock(items.length ? averageRating(items).toFixed(1) + ' / 5' : '—', 'средняя оценка'),
      statBlock(topCategory(allReviews), 'самая частая тема')
    );

    listEl.replaceChildren();
    if (!items.length) {
      if (!statusEl.textContent) {
        setStatus(allReviews.length ? 'По вашему запросу отзывов нет.' : 'Пока нет ни одного отзыва. Оставьте первый!');
      }
      return;
    }
    if (statusEl.className && !statusEl.style.background) setStatus('');

    items.forEach(function (r) {
      var card = document.createElement('article');
      card.className = 'review';

      var head = document.createElement('header');
      var who = document.createElement('strong');
      who.textContent = r.name;
      var st = document.createElement('span');
      st.className = 'stars';
      st.textContent = window.stars(r.rating);
      st.setAttribute('aria-label', 'Оценка ' + r.rating + ' из 5');
      head.append(who, st);

      var cat = document.createElement('span');
      cat.className = 'cat';
      cat.textContent = r.category;

      var text = document.createElement('p');
      text.textContent = r.message;

      var meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = window.formatDate(r.created_at);

      card.append(head, cat, text, meta);
      listEl.appendChild(card);
    });
  }

  [filterCategory, sortBy].forEach(function (el) {
    el.addEventListener('change', function () { setStatus(''); render(); });
  });
  searchReviews.addEventListener('input', function () { setStatus(''); render(); });
  reloadBtn.addEventListener('click', function () { loadReviews(); });

  loadReviews();
})();
