/* Общие функции сайта: тема, меню, поиск работ, сворачивание карточек, увеличение картинок, галерея, 3D-цвета */
(function () {
  'use strict';

  // ---------- Безопасная работа с localStorage ----------
  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* хранилище недоступно — не страшно */ }
  }

  // ---------- 1. Переключение светлой и тёмной темы ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀ Светлая тема' : '☾ Тёмная тема';
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }
  var saved = storageGet('theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  document.addEventListener('DOMContentLoaded', function () {
    var themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
      themeBtn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        storageSet('theme', next);
      });
    }

    initMenu();
    initSearch();
    initCollapse();
    initLightbox();
    initGalleries();
    initModelColors();
    initDemoToast();
  });

  // ---------- Меню на телефоне ----------
  function initMenu() {
    var btn = document.getElementById('menuToggle');
    var nav = document.getElementById('siteNav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '✕ Закрыть меню' : '☰ Меню';
    });
  }

  // ---------- 2. Поиск работ по названию и тексту + счётчик ----------
  function clearHighlights(root) {
    root.querySelectorAll('.highlight').forEach(function (mark) {
      mark.replaceWith(document.createTextNode(mark.textContent));
    });
    root.normalize();
  }
  function highlight(root, query) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) {
      var n = walker.currentNode;
      if (n.parentElement && !n.parentElement.closest('script, style, button, .highlight') &&
          n.textContent.toLowerCase().indexOf(query) >= 0) nodes.push(n);
    }
    nodes.forEach(function (node) {
      var text = node.textContent;
      var idx = text.toLowerCase().indexOf(query);
      var mark = document.createElement('span');
      mark.className = 'highlight';
      mark.textContent = text.slice(idx, idx + query.length);
      var frag = document.createDocumentFragment();
      if (idx) frag.append(document.createTextNode(text.slice(0, idx)));
      frag.append(mark);
      if (idx + query.length < text.length) frag.append(document.createTextNode(text.slice(idx + query.length)));
      node.replaceWith(frag);
    });
  }
  function initSearch() {
    var input = document.getElementById('workSearch');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.entry-card[data-work]'));
    if (!input || !cards.length) return;
    var counter = document.getElementById('resultCount');
    var empty = document.getElementById('emptyMessage');
    var timer;

    function run() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        clearHighlights(card);
        var match = q.length < 2 || card.textContent.toLowerCase().indexOf(q) >= 0;
        card.hidden = !match;
        if (match) {
          shown++;
          if (q.length >= 2) {
            card.classList.remove('collapsed');
            highlight(card, q);
          }
        }
      });
      if (counter) counter.textContent = 'Найдено работ: ' + shown + ' из ' + cards.length;
      if (empty) empty.hidden = shown !== 0;
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
    run();
  }

  // ---------- 3. Кнопки показа и скрытия содержимого карточек ----------
  function setCollapsed(card, collapsed) {
    card.classList.toggle('collapsed', collapsed);
    var btn = card.querySelector('.toggle-btn');
    if (btn) {
      btn.textContent = collapsed ? '+' : '−';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  }
  function initCollapse() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.entry-card[data-work]'));
    cards.forEach(function (card) {
      var btn = card.querySelector('.toggle-btn');
      if (btn) btn.addEventListener('click', function () {
        setCollapsed(card, !card.classList.contains('collapsed'));
      });
    });
    var collapseAll = document.getElementById('collapseAll');
    var expandAll = document.getElementById('expandAll');
    if (collapseAll) collapseAll.addEventListener('click', function () {
      cards.forEach(function (c) { setCollapsed(c, true); });
    });
    if (expandAll) expandAll.addEventListener('click', function () {
      cards.forEach(function (c) { setCollapsed(c, false); });
    });
  }

  // ---------- 4. Модальное окно с увеличенным изображением ----------
  function initLightbox() {
    var dlg = document.getElementById('lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    var img = dlg.querySelector('img');
    var cap = dlg.querySelector('p');
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.matches('.schema img, .gallery-main')) return;
      img.src = target.src;
      img.alt = target.alt;
      cap.textContent = target.alt;
      dlg.showModal();
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.matches('[data-close]')) dlg.close();
    });
  }

  // ---------- 5. Галерея с переключением изображений (Blender) ----------
  function initGalleries() {
    document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
      var main = gallery.querySelector('.gallery-main');
      var caption = gallery.querySelector('.gallery-caption');
      var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('.gallery-thumbs button'));
      function show(btn) {
        var src = btn.getAttribute('data-src');
        main.src = src;
        main.alt = btn.getAttribute('data-alt');
        if (caption) caption.textContent = btn.getAttribute('data-alt');
        thumbs.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      thumbs.forEach(function (btn) { btn.addEventListener('click', function () { show(btn); }); });
      gallery.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var i = thumbs.findIndex(function (b) { return b.classList.contains('active'); });
        i = (i + (e.key === 'ArrowRight' ? 1 : -1) + thumbs.length) % thumbs.length;
        show(thumbs[i]);
        thumbs[i].focus();
      });
    });
  }

  // ---------- 3D-просмотр: цвета материалов яблока ----------
  // В файле яблока материалы названы «Apple Red» и «Stem Brown», но цвет сохранён серым,
  // поэтому в просмотрщике задаём цвета по названию материала.
  function initModelColors() {
    var colors = {
      'Apple Red': [0.78, 0.08, 0.08, 1],
      'Stem Brown': [0.36, 0.2, 0.09, 1]
    };
    document.querySelectorAll('model-viewer[data-recolor]').forEach(function (viewer) {
      viewer.addEventListener('load', function () {
        if (!viewer.model) return;
        viewer.model.materials.forEach(function (mat) {
          if (colors[mat.name]) mat.pbrMetallicRoughness.setBaseColorFactor(colors[mat.name]);
        });
      });
    });
  }

  // ---------- Демонстрация уведомления на странице UX/UI ----------
  function initDemoToast() {
    document.querySelectorAll('[data-demo-toast]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.showToast('Так выглядит уведомление об успешном действии.', false);
      });
    });
  }

  // ---------- Уведомления (используются формами) ----------
  window.showToast = function (text, isError) {
    var area = document.getElementById('toastArea');
    if (!area) return;
    var toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.setAttribute('role', isError ? 'alert' : 'status');
    toast.textContent = text;
    area.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 5000);
  };
})();
