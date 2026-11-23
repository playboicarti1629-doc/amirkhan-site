/* Interactive states for the comic neo-brutalist study pages */
(() => {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');
  const sidebarClose = document.getElementById('sidebarClose');
  const searchInput = document.getElementById('searchInput');
  const sections = [...document.querySelectorAll('.section[id]')];
  const navLinks = [...document.querySelectorAll('.nav-link')];

  // The supplied HTML pages do not require a sidebar; this remains compatible
  // with layouts that include one.
  let overlay = null;
  if (sidebar) {
    overlay = document.querySelector('.sidebar-overlay') || document.createElement('div');
    overlay.className = 'sidebar-overlay';
    if (!overlay.isConnected) document.body.appendChild(overlay);

    const openSidebar = () => {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
      menuBtn?.setAttribute('aria-expanded', 'true');
    };
    const closeSidebar = () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
      menuBtn?.setAttribute('aria-expanded', 'false');
    };
    menuBtn?.addEventListener('click', openSidebar);
    sidebarClose?.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);
    navLinks.forEach(link => link.addEventListener('click', closeSidebar));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeSidebar();
    });
  }

  // Scroll-aware navigation state.
  function updateActiveLink() {
    if (!sections.length) return;
    const marker = window.scrollY + 130;
    let activeId = sections[0].id;
    sections.forEach(section => {
      if (marker >= section.offsetTop) activeId = section.id;
    });
    navLinks.forEach(link => {
      const active = link.getAttribute('href') === `#${activeId}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', updateActiveLink, { passive: true });
  window.addEventListener('resize', updateActiveLink);
  updateActiveLink();

  // Search is optional. When present, it filters date sections and highlights matches.
  let searchTimeout;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => performSearch(searchInput.value.trim().toLowerCase()), 180);
  });

  function clearHighlights() {
    document.querySelectorAll('.highlight').forEach(mark => {
      mark.replaceWith(document.createTextNode(mark.textContent));
      mark.parentNode?.normalize();
    });
  }
  function performSearch(query) {
    clearHighlights();
    sections.forEach(section => {
      const matches = !query || query.length < 2 || section.textContent.toLowerCase().includes(query);
      section.hidden = !matches;
      if (matches && query.length >= 2) highlightText(section, query);
    });
  }
  function highlightText(root, query) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const candidates = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('script, style, .section-num, .highlight')) {
        const index = node.textContent.toLowerCase().indexOf(query);
        if (index >= 0) candidates.push({ node, index });
      }
    }
    candidates.forEach(({ node, index }) => {
      const value = node.textContent;
      const mark = document.createElement('span');
      mark.className = 'highlight';
      mark.textContent = value.slice(index, index + query.length);
      const fragment = document.createDocumentFragment();
      if (index) fragment.append(document.createTextNode(value.slice(0, index)));
      fragment.append(mark);
      if (index + query.length < value.length) fragment.append(document.createTextNode(value.slice(index + query.length)));
      node.replaceWith(fragment);
    });
  }

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && searchInput === document.activeElement) {
      searchInput.blur();
      if (searchInput.value) {
        searchInput.value = '';
        performSearch('');
      }
    }
  });

  // Make keyboard focus and pressed states consistent for in-page navigation.
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = document.querySelector(link.getAttribute('href'));
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    });
  });
})();