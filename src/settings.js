'use strict';
// Paramètres : objectifs avec date d'effet, mises à jour.

const Settings = (() => {
  // ---- Objectifs ----
  let editing = null;   // objectif en cours de modification
  const form = $('#goalForm');

  $('#goalInputs').innerHTML = NUTRIENTS.map(n => `
    <label class="f ${n.parent ? 'sub' : ''}">${n.label}
      <span class="ref"><input name="${n.k}" inputmode="decimal" placeholder="aucun"><b>${n.unit}</b></span>
    </label>`).join('');

  const summary = g => NUTRIENTS.filter(n => g[n.k] != null).map(n => `${n.label.replace('dont acides gras saturés', 'saturés').replace('dont sucres', 'sucres')} <b>${fmt(g[n.k])} ${n.unit}</b>`).join(' · ');

  function renderGoals() {
    const current = goalFor(today());
    const list = [...DB.goals].sort((a, b) => b.from.localeCompare(a.from));
    $('#goalList').innerHTML = list.length ? list.map(g => `
      <div class="goal-row${g === editing ? ' editing' : ''}" data-id="${g.id}">
        <div>
          <div><b>À partir du ${dateLabel(g.from)}</b>${g === current ? ' <span class="tag">en cours</span>' : g.from > today() ? ' <span class="tag future">à venir</span>' : ''}</div>
          <div class="small">${summary(g)}</div>
        </div>
        <button type="button" class="btn sm" data-edit>Modifier</button>
        <button type="button" class="btn sm danger" data-del>Supprimer</button>
      </div>`).join('')
      : '<div class="mut small">Aucun objectif pour l\'instant.</div>';
  }

  function fill(g) {
    editing = g;
    form.elements.from.value = g?.from || today();
    for (const n of NUTRIENTS) form.elements[n.k].value = inputVal(g?.[n.k]);
    $('#goalErr').textContent = '';
    $('#goalCancel').hidden = !g;
    $('#goalSave').textContent = g ? 'Enregistrer la modification' : 'Enregistrer l\'objectif';
    renderGoals();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#goalErr'), from = form.elements.from.value;
    if (!from) return err.textContent = 'Choisis la date à partir de laquelle l\'objectif s\'applique.';
    const values = {};
    for (const n of NUTRIENTS) {
      const v = parseNum(form.elements[n.k].value);
      if (Number.isNaN(v)) return err.textContent = `${n.label} : nombre invalide (ex. 2000 ou 12,5).`;
      values[n.k] = v;
    }
    if (NUTRIENTS.every(n => values[n.k] == null)) return err.textContent = 'Renseigne au moins une valeur.';
    // Un seul objectif par date : celui du même jour est remplacé
    DB.goals = DB.goals.filter(g => g === editing || g.from !== from);
    const now = new Date().toISOString();
    if (editing) Object.assign(editing, { from, ...values, updated: now });
    else DB.goals.push({ id: crypto.randomUUID(), from, ...values, created: now, updated: now });
    save(); fill(null); App.render();
  });
  $('#goalCancel').addEventListener('click', () => fill(null));
  $('#goalList').addEventListener('click', e => {
    const row = e.target.closest('.goal-row');
    if (!row) return;
    const g = DB.goals.find(x => x.id === row.dataset.id);
    if (e.target.closest('[data-edit]')) { fill(g); form.elements.from.focus(); return; }
    const del = e.target.closest('[data-del]');
    if (!del) return;
    // Suppression en deux clics
    if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Confirmer'; return; }
    DB.goals = DB.goals.filter(x => x !== g);
    if (editing === g) editing = null;
    save(); fill(editing); App.render();
  });

  // ---- Mises à jour ----
  let upd = {};
  function renderUpdate() {
    $('#updVersion').textContent = upd.installed || '–';
    $('#updAuto').checked = !!upd.auto;
    const state = !upd.configured ? 'Disponible seulement dans l\'appli installée (pas en mode développement).'
      : { idle: 'Pas encore recherché', checking: 'Recherche en cours…', none: 'Tu as la dernière version.',
          available: `Version ${upd.version || ''} disponible.`, downloading: `Téléchargement de la version ${upd.version || ''}… ${upd.percent || 0} %`,
          downloaded: `Version ${upd.version || ''} téléchargée.`, error: `Erreur : ${upd.message || 'inconnue'}` }[upd.status] || '–';
    $('#updState').textContent = state;
    $('#updCheck').disabled = !upd.configured || upd.status === 'checking' || upd.status === 'downloading';
    $('#updDownloadRow').hidden = upd.status !== 'available';
    $('#updAvail').textContent = upd.status === 'available' ? `Version ${upd.version}` : '';
    $('#updInstallRow').hidden = upd.status !== 'downloaded';
  }
  window.ttrack.update.onStatus(s => { upd = { ...upd, ...s, version: s.version || upd.version }; renderUpdate(); });
  $('#updCheck').addEventListener('click', () => window.ttrack.update.check());
  $('#updDownload').addEventListener('click', () => window.ttrack.update.download());
  $('#updInstall').addEventListener('click', () => window.ttrack.update.install());
  $('#updAuto').addEventListener('change', async e => { await window.ttrack.update.setAuto(e.target.checked); upd.auto = e.target.checked; });

  (async () => {
    upd = await window.ttrack.update.info();
    renderUpdate();
  })();

  function render() { if (!editing) fill(null); else renderGoals(); Body.renderHeight(); }
  return { render };
})();
