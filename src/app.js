'use strict';
// Onglets, recherche et filtres des bibliothèques, démarrage.

const App = (() => {
  const LIBS = {
    foods: { mod: Foods, items: () => DB.foods, filters: '#foodFilters', add: '+ Ajouter un aliment', search: 'Rechercher un aliment (Ctrl+F)' },
    dishes: { mod: Dishes, items: () => DB.dishes, filters: '#dishFilters', add: '+ Ajouter un plat', search: 'Rechercher un plat (Ctrl+F)' }
  };
  let page = 'hub';
  const query = { foods: '', dishes: '' };
  const wanted = { foods: [], dishes: [] };   // tags choisis dans le filtre, par bibliothèque

  function renderFilters(lib) {
    const tags = allTags(LIBS[lib].items());
    // Un tag qui n'existe plus sort du filtre
    wanted[lib] = wanted[lib].filter(w => tags.some(t => norm(t) === norm(w)));
    const on = t => wanted[lib].some(w => norm(w) === norm(t));
    $(LIBS[lib].filters).innerHTML = tags.length
      ? `<span class="mut small">Filtrer :</span>` +
        tags.map(t => `<button class="chip${on(t) ? ' on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('') +
        (wanted[lib].length ? `<button class="chip clear" data-clear>Tout afficher</button>` : '')
      : `<span class="mut small">Ajoute des tags dans les fiches pour pouvoir filtrer.</span>`;
  }

  function render() {
    for (const lib in LIBS) { renderFilters(lib); LIBS[lib].mod.render(query[lib], wanted[lib]); }
    Hub.render();
    if (page === 'stats') Stats.render();
    if (page === 'settings') Settings.render();
  }

  function go(p) {
    page = p;
    for (const b of document.querySelectorAll('#tabs button, #settingsBtn')) b.classList.toggle('on', b.dataset.page === p);
    for (const k of ['hub', 'stats', 'foods', 'dishes', 'settings']) $(`#page-${k}`).hidden = k !== p;
    const lib = LIBS[p];
    $('#libActions').hidden = !lib;
    if (lib) {
      $('#add').textContent = lib.add;
      $('#search').placeholder = lib.search;
      $('#search').value = query[p];
    }
    render();
  }

  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.page); });
  $('#settingsBtn').addEventListener('click', () => go('settings'));
  $('#add').addEventListener('click', () => LIBS[page].mod.open());
  $('#search').addEventListener('input', e => { query[page] = e.target.value; render(); });
  for (const lib in LIBS) {
    $(LIBS[lib].filters).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.clear != null) wanted[lib] = [];
      else {
        const t = b.dataset.tag, i = wanted[lib].findIndex(w => norm(w) === norm(t));
        if (i < 0) wanted[lib].push(t); else wanted[lib].splice(i, 1);
      }
      render();
    });
  }

  const openModal = () => [Foods.modal, Dishes.modal].find(m => m.isOpen);
  document.addEventListener('keydown', e => {
    const m = openModal(), key = e.key.toLowerCase();
    if (e.key === 'Escape' && m) m.close();
    if (m) return;
    if (e.ctrlKey && key === 'f') { e.preventDefault(); (LIBS[page] ? $('#search') : page === 'hub' ? $('#addSearch') : null)?.focus(); }
    if (e.ctrlKey && key === 'n' && LIBS[page]) { e.preventDefault(); LIBS[page].mod.open(); }
  });
  // Empêche d'ouvrir une image lâchée à côté d'une zone photo
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  (async () => {
    Object.assign(DB, await window.ttrack.load());
    go('hub');
    Cloud.start();
  })();

  return { render, go };
})();
