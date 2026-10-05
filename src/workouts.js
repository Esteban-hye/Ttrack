'use strict';
// Séances : séances favorites, planning de la semaine par glisser-déposer, carnet et matériel.
//
// Séance favorite { id, name, exercises: [{ name, sets, reps, weight, rest }] }   reps : texte, ex. « 8-12 »
// Au planning     { id, date, template, name, done, exercises: [{ name, sets, reps, weight, rest, log: [{ reps, weight }] }] }
//   Une séance posée sur un jour est une copie de la favorite : modifier ou supprimer la favorite ne change pas le carnet.
// Matériel        [{ id: 'equipment', bars, barKg, plates: [{ kg, count }] }]   haltères à disques

const Workouts = (() => {
  const mondayOf = s => addDays(s, -((new Date(s + 'T12:00:00').getDay() + 6) % 7));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const kgText = n => n == null ? 'poids du corps' : `${fmt(n)} kg`;
  const sessionById = id => DB.sessions.find(s => s.id === id);
  let week = mondayOf(today());
  let openId = null;     // séance ouverte dans le carnet
  let dragKind = null;   // 'tpl' ou 'sess' pendant un glisser-déposer

  // ---- Matériel ----
  const equip = () => DB.equipment[0] || null;
  // Charges possibles par haltère : barre + les mêmes disques de chaque côté.
  // pair : deux haltères chargés pareil (un disque doit exister en 4 exemplaires), sinon un seul (2 exemplaires).
  function loads(pair) {
    const e = equip();
    if (!e || e.barKg == null || !(e.bars >= (pair ? 2 : 1))) return [];
    let sums = new Map([[0, []]]);   // somme d'un côté en centièmes de kg → disques de ce côté
    for (const p of e.plates) {
      const max = Math.floor(p.count / (pair ? 4 : 2)), w = Math.round(p.kg * 100), next = new Map(sums);
      for (const [s, side] of sums) {
        for (let n = 1; n <= max; n++) {
          const t = s + n * w, cand = [...side, ...Array(n).fill(p.kg)];
          if (!next.has(t) || next.get(t).length > cand.length) next.set(t, cand);
        }
      }
      sums = next;
    }
    return [...sums].map(([s, side]) => ({ kg: (Math.round(e.barKg * 100) + 2 * s) / 100, side: side.sort((a, b) => b - a) })).sort((a, b) => a.kg - b.kg);
  }
  // Comment monter un haltère à ce poids
  function mountText(kg) {
    if (kg == null || !equip()) return '';
    const l = loads(false).find(x => Math.abs(x.kg - kg) < 0.001);
    if (!l) return 'pas faisable avec ton matériel';
    return l.side.length ? `barre + ${l.side.map(fmt).join(' + ')} kg de chaque côté` : 'barre seule';
  }

  let plates = [];   // disques en cours de saisie : { kg, count } en texte
  const barCount = $('#barCount'), barKg = $('#barKg');
  function renderEquip() {
    const e = equip();
    if (!$('#equipBox').contains(document.activeElement)) {
      barCount.value = e?.bars ?? '';
      barKg.value = inputVal(e?.barKg ?? null);
      plates = (e?.plates || []).map(p => ({ kg: inputVal(p.kg), count: String(p.count) }));
      renderPlates();
    }
    renderLoads();
  }
  function renderPlates() {
    $('#plateRows').innerHTML = plates.map((p, i) => `
      <div class="plate-row" data-i="${i}">
        <span class="ref"><input data-f="kg" inputmode="decimal" value="${esc(p.kg)}" placeholder="1,25"><b>kg</b></span>
        <span class="mut">×</span>
        <span class="ref"><input data-f="count" inputmode="numeric" value="${esc(p.count)}" placeholder="4"><b>disques</b></span>
        <button type="button" class="icon-btn" data-del title="Retirer">✕</button>
      </div>`).join('') || '<div class="mut small">Aucun disque.</div>';
  }
  function renderLoads() {
    const pair = loads(true), one = loads(false), e = equip();
    $('#loads').innerHTML = !one.length ? '<span class="mut small">Renseigne tes barres et tes disques pour voir les charges possibles.</span>'
      : (pair.length ? `<div><b>2 haltères identiques</b> <span class="mut small">${pair.length} charges, jusqu'à ${fmt(pair.at(-1).kg)} kg chacun</span><div class="load-list">${pair.map(l => `<span>${fmt(l.kg)}</span>`).join('')}</div></div>` : '')
      + `<div><b>1 seul haltère</b> <span class="mut small">jusqu'à ${fmt(one.at(-1).kg)} kg</span></div>`
      + (e.plates.length ? '' : '<div class="mut small">Sans disque, seule la barre est possible.</div>');
    // Charges proposées dans les champs de poids
    $('#loadList').innerHTML = (pair.length ? pair : one).map(l => `<option value="${inputVal(l.kg)}">`).join('');
  }
  // Enregistre le matériel quand tout est valide
  function saveEquip() {
    const err = $('#equipErr');
    const bars = barCount.value.trim() === '' ? null : Number(barCount.value);
    const bk = parseNum(barKg.value);
    if (bars != null && !(Number.isInteger(bars) && bars >= 0 && bars <= 20)) return err.textContent = 'Nombre de barres invalide.';
    if (Number.isNaN(bk) || (bk != null && (bk < 0 || bk > 50))) return err.textContent = 'Poids de barre invalide (en kg, ex. 2).';
    const list = [];
    for (const p of plates) {
      const kg = parseNum(p.kg), count = p.count.trim() === '' ? null : Number(p.count);
      if (kg == null && count == null) continue;
      if (!(kg > 0 && kg <= 50)) return err.textContent = 'Poids de disque invalide (en kg, ex. 1,25).';
      if (!(Number.isInteger(count) && count >= 1 && count <= 100)) return err.textContent = 'Nombre de disques invalide.';
      const same = list.find(x => x.kg === kg);
      if (same) same.count += count; else list.push({ kg, count });
    }
    err.textContent = '';
    const data = { id: 'equipment', bars, barKg: bk, plates: list.sort((a, b) => a.kg - b.kg) };
    if (JSON.stringify(DB.equipment[0] || null) === JSON.stringify(data)) return renderLoads();
    DB.equipment = [data];
    save(); renderLoads();
  }
  barCount.addEventListener('change', saveEquip);
  barKg.addEventListener('change', saveEquip);
  $('#plateRows').addEventListener('input', e => {
    const row = e.target.closest('.plate-row');
    if (row) plates[+row.dataset.i][e.target.dataset.f] = e.target.value;
  });
  $('#plateRows').addEventListener('change', saveEquip);
  $('#plateRows').addEventListener('click', e => {
    if (!e.target.closest('[data-del]')) return;
    plates.splice(+e.target.closest('.plate-row').dataset.i, 1);
    renderPlates(); saveEquip();
  });
  $('#addPlate').addEventListener('click', () => {
    plates.push({ kg: '', count: '' });
    renderPlates();
    $('#plateRows .plate-row:last-child input').focus();
  });

  // ---- Carnet : ce qui a été fait ----
  // « 6 kg × 15 / 15 / 13 », ou « 12 × 6 kg, 10 × 8 kg » si le poids change
  function logText(ex) {
    const sets = ex.log.filter(l => l.reps != null);
    if (!sets.length) return '';
    if (new Set(sets.map(l => l.weight)).size === 1) return `${kgText(sets[0].weight)} × ${sets.map(l => l.reps).join(' / ')}`;
    return sets.map(l => `${l.reps} × ${kgText(l.weight)}`).join(', ');
  }
  // Dernière fois que cet exercice a été noté avant cette date
  function lastTime(name, date, exceptId) {
    const n = norm(name);
    const before = DB.sessions.filter(s => s.id !== exceptId && s.date < date).sort((a, b) => b.date.localeCompare(a.date));
    for (const s of before) {
      const ex = s.exercises.find(x => norm(x.name) === n && x.log.some(l => l.reps != null));
      if (ex) return { date: s.date, ex };
    }
    return null;
  }
  // Durée estimée : 5 min d'échauffement, ~40 s par série plus le repos
  const minutes = exs => Math.max(5, Math.round((5 + exs.reduce((t, x) => t + x.sets * (40 + (x.rest ?? 60)) / 60, 0)) / 5) * 5);

  // ---- Planning ----
  function plan(tpl, date) {
    const s = {
      id: crypto.randomUUID(), date, template: tpl.id, name: tpl.name, done: false, created: new Date().toISOString(),
      exercises: tpl.exercises.map(x => {
        // Poids de départ : celui de la dernière fois, sinon celui prévu dans la séance
        const last = lastTime(x.name, addDays(date, 1));
        const weight = last ? last.ex.log.find(l => l.reps != null).weight : x.weight;
        return { ...x, log: Array.from({ length: x.sets }, () => ({ reps: null, weight })) };
      })
    };
    DB.sessions.push(s);
    openId = s.id;
    save(); App.render();
  }

  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    $('#weekLabel').textContent = `Semaine du ${dateLabel(week, { day: 'numeric', month: 'long' })} au ${dateLabel(days[6], { day: 'numeric', month: 'long', year: 'numeric' })}`;
    $('#thisWeek').hidden = week === mondayOf(today());
    $('#week').innerHTML = days.map(d => {
      const list = DB.sessions.filter(s => s.date === d).sort((a, b) => (a.created || '').localeCompare(b.created || ''));
      return `<div class="day-col${d === today() ? ' today' : ''}" data-date="${d}">
        <div class="day-head">${dateLabel(d, { weekday: 'short' })} <b>${Number(d.slice(8))}</b></div>
        ${list.map(s => `<div class="sess${s.done ? ' done' : ''}${s.id === openId ? ' open' : ''}" draggable="true" data-id="${s.id}" title="Cliquer pour ouvrir · glisser pour changer de jour">
          <b>${esc(s.name)}</b><span>${s.done ? '✓ faite' : 'prévue'}</span></div>`).join('')}
      </div>`;
    }).join('');
  }

  function renderTemplates() {
    const list = [...DB.workouts].sort(byName);
    $('#tplList').innerHTML = list.length ? list.map(t => `
      <div class="tpl" draggable="true" data-id="${t.id}" title="Glisser sur un jour du planning · cliquer pour modifier">
        <span class="grip">⋮⋮</span>
        <div><b>${esc(t.name)}</b><span class="mut small">${t.exercises.length} exercice${t.exercises.length > 1 ? 's' : ''} · ~${minutes(t.exercises)} min</span></div>
      </div>`).join('') : '<div class="mut small">Aucune séance favorite. Crée ta première séance.</div>';
    // Noms d'exercices déjà utilisés, proposés dans la fiche
    const names = new Map();
    for (const x of [...DB.workouts, ...DB.sessions].flatMap(w => w.exercises)) if (!names.has(norm(x.name))) names.set(norm(x.name), x.name);
    $('#exList').innerHTML = [...names.values()].sort((a, b) => a.localeCompare(b, 'fr')).map(n => `<option value="${esc(n)}">`).join('');
  }

  // ---- Séance ouverte ----
  function renderSession(force) {
    const box = $('#sessionBox'), s = sessionById(openId);
    if (!s) { openId = null; box.hidden = true; return; }
    box.hidden = false;
    if (!force && box.contains(document.activeElement)) return;   // pas pendant la saisie
    box.innerHTML = `
      <div class="sess-top">
        <div><h3>${esc(s.name)}</h3><span class="mut small">${cap(dateLabel(s.date))}</span></div>
        <span class="grow"></span>
        <button type="button" class="btn${s.done ? '' : ' pri'}" data-done>${s.done ? '✓ Faite · annuler' : 'Marquer comme faite'}</button>
        <button type="button" class="btn danger" data-remove>Retirer du planning</button>
        <button type="button" class="icon-btn" data-close title="Fermer">✕</button>
      </div>
      <div class="err" id="sessErr"></div>
      ${s.exercises.map((x, i) => {
        const last = lastTime(x.name, s.date, s.id);
        return `<div class="ex" data-i="${i}">
          <div class="ex-top"><b>${esc(x.name)}</b><span class="mut small">objectif ${x.sets} × ${esc(x.reps)}${x.weight != null ? ` · ${fmt(x.weight)} kg` : ''}${x.rest != null ? ` · repos ${x.rest} s` : ''}</span></div>
          ${last ? `<div class="mut small last">Dernière fois (${dateLabel(last.date, { weekday: 'short', day: 'numeric', month: 'short' })}) : ${esc(logText(last.ex))}</div>` : ''}
          <div class="sets">${x.log.map((l, j) => `
            <div class="set" data-j="${j}">
              <span class="mut small">Série ${j + 1}</span>
              <span class="ref"><input data-f="reps" inputmode="numeric" value="${l.reps ?? ''}" placeholder="${esc(x.reps)}"><b>rép.</b></span>
              <span class="ref"><input data-f="weight" inputmode="decimal" list="loadList" value="${inputVal(l.weight)}" placeholder="aucun"><b>kg</b></span>
              <span class="mut small mount">${esc(mountText(l.weight))}</span>
              <button type="button" class="icon-btn" data-del-set title="Retirer la série">✕</button>
            </div>`).join('')}</div>
          <button type="button" class="btn sm" data-add-set>+ Série</button>
        </div>`;
      }).join('')}`;
  }

  // Saisie d'une série : mise à jour pendant la frappe, enregistrement à la sortie du champ
  function readSet(input) {
    const s = sessionById(openId), x = s.exercises[+input.closest('.ex').dataset.i], l = x.log[+input.closest('.set').dataset.j];
    const raw = input.value.trim();
    let v, ok;
    if (input.dataset.f === 'reps') { v = raw === '' ? null : Number(raw); ok = v == null || (/^\d+$/.test(raw) && v <= 999); }
    else { v = parseNum(raw); ok = !Number.isNaN(v) && (v == null || v <= 500); }
    input.classList.toggle('bad', !ok);
    if (ok) l[input.dataset.f] = v;
    if (input.dataset.f === 'weight') input.closest('.set').querySelector('.mount').textContent = ok ? mountText(v) : 'poids invalide';
    return ok;
  }
  const sessionBox = $('#sessionBox');
  sessionBox.addEventListener('input', e => { if (e.target.dataset.f) readSet(e.target); });
  sessionBox.addEventListener('change', e => { if (e.target.dataset.f && readSet(e.target)) { save(); renderWeekAndHistory(); } });
  sessionBox.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.dataset.f) return;
    // Entrée : champ suivant
    e.preventDefault();
    const inputs = [...sessionBox.querySelectorAll('input')], i = inputs.indexOf(e.target);
    (inputs[i + 1] || e.target).focus();
    inputs[i + 1]?.select();
  });
  sessionBox.addEventListener('click', e => {
    const s = sessionById(openId);
    if (!s) return;
    const b = e.target.closest('button');
    if (!b) return;
    const err = $('#sessErr');
    if (b.dataset.close != null) { openId = null; App.render(); return; }
    if (b.dataset.done != null) {
      if (!s.done && !s.exercises.some(x => x.log.some(l => l.reps != null))) return err.textContent = 'Note au moins une série avant de marquer la séance comme faite.';
      s.done = !s.done;
      save(); renderAll(true); return;
    }
    if (b.dataset.remove != null) {
      if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Confirmer'; return; }
      DB.sessions = DB.sessions.filter(x => x !== s);
      openId = null;
      save(); App.render(); return;
    }
    const exEl = b.closest('.ex');
    if (!exEl) return;
    const x = s.exercises[+exEl.dataset.i];
    if (b.dataset.addSet != null) x.log.push({ reps: null, weight: x.log.at(-1)?.weight ?? x.weight });
    else if (b.dataset.delSet != null) x.log.splice(+b.closest('.set').dataset.j, 1);
    else return;
    const add = b.dataset.addSet != null, i = exEl.dataset.i;
    save(); renderSession(true);
    if (add) sessionBox.querySelector(`.ex[data-i="${i}"] .set:last-child input`)?.focus();
  });

  function renderHistory() {
    const done = DB.sessions.filter(s => s.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    $('#history').innerHTML = done.length ? done.map(s => `
      <div class="hist" data-id="${s.id}">
        <div class="hist-top"><b>${esc(s.name)}</b><span class="mut small">${cap(dateLabel(s.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</span></div>
        ${s.exercises.filter(logText).map(x => `<div class="small"><span class="mut">${esc(x.name)} :</span> ${esc(logText(x))}</div>`).join('')}
      </div>`).join('') : '<div class="mut small">Rien pour l\'instant : les séances marquées « faites » arrivent ici.</div>';
  }
  $('#history').addEventListener('click', e => {
    const h = e.target.closest('.hist');
    if (!h) return;
    const s = sessionById(h.dataset.id);
    openId = s.id; week = mondayOf(s.date);
    renderAll(true);
    sessionBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const renderWeekAndHistory = () => { renderWeek(); renderHistory(); };
  function renderAll(force) { renderWeek(); renderTemplates(); renderSession(force); renderHistory(); renderEquip(); }

  // ---- Glisser-déposer : une favorite sur un jour, ou une séance d'un jour à l'autre ----
  const page = $('#page-workout');
  page.addEventListener('dragstart', e => {
    const t = e.target.closest('.tpl, .sess');
    if (!t) return;
    dragKind = t.classList.contains('tpl') ? 'tpl' : 'sess';
    e.dataTransfer.setData('text/plain', dragKind + ':' + t.dataset.id);
    e.dataTransfer.effectAllowed = dragKind === 'tpl' ? 'copy' : 'move';
    t.classList.add('dragging');
  });
  page.addEventListener('dragend', () => {
    dragKind = null;
    for (const el of page.querySelectorAll('.dragging, .drop')) el.classList.remove('dragging', 'drop');
  });
  page.addEventListener('dragover', e => {
    const col = e.target.closest('.day-col');
    if (!col || !dragKind) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragKind === 'tpl' ? 'copy' : 'move';
    for (const c of page.querySelectorAll('.day-col.drop')) if (c !== col) c.classList.remove('drop');
    col.classList.add('drop');
  });
  page.addEventListener('dragleave', e => {
    const col = e.target.closest('.day-col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drop');
  });
  page.addEventListener('drop', e => {
    const col = e.target.closest('.day-col');
    if (!col) return;
    e.preventDefault();
    const [kind, id] = e.dataTransfer.getData('text/plain').split(':');
    if (kind === 'tpl') { const t = DB.workouts.find(w => w.id === id); if (t) plan(t, col.dataset.date); }
    else if (kind === 'sess') {
      const s = sessionById(id);
      if (s && s.date !== col.dataset.date) { s.date = col.dataset.date; openId = s.id; save(); App.render(); }
    }
  });
  $('#week').addEventListener('click', e => {
    const s = e.target.closest('.sess');
    if (!s) return;
    openId = s.dataset.id;
    renderAll(true);
    sessionBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#tplList').addEventListener('click', e => { const t = e.target.closest('.tpl'); if (t) open(DB.workouts.find(w => w.id === t.dataset.id)); });
  $('#prevWeek').addEventListener('click', () => { week = addDays(week, -7); renderWeek(); });
  $('#nextWeek').addEventListener('click', () => { week = addDays(week, 7); renderWeek(); });
  $('#thisWeek').addEventListener('click', () => { week = mondayOf(today()); renderWeek(); });
  $('#newWorkout').addEventListener('click', () => open());

  // ---- Fiche d'une séance favorite ----
  let editing = null;
  let rows = [];   // exercices en cours d'édition, en texte : { name, sets, reps, weight, rest }
  const blank = () => ({ name: '', sets: '3', reps: '8-12', weight: '', rest: '60' });
  function renderRows() {
    $('#exRows').innerHTML = rows.length ? `
      <div class="exr head mut small"><span></span><span>Exercice</span><span>Séries</span><span>Répétitions</span><span>Poids</span><span>Repos</span><span></span></div>` +
      rows.map((r, i) => `
      <div class="exr" data-i="${i}">
        <span class="mut">${i + 1}</span>
        <input data-f="name" list="exList" value="${esc(r.name)}" placeholder="ex. Curl biceps">
        <input data-f="sets" inputmode="numeric" value="${esc(r.sets)}">
        <input data-f="reps" value="${esc(r.reps)}" placeholder="8-12">
        <span class="ref"><input data-f="weight" inputmode="decimal" list="loadList" value="${esc(r.weight)}" placeholder="aucun"><b>kg</b></span>
        <span class="ref"><input data-f="rest" inputmode="numeric" value="${esc(r.rest)}" placeholder="60"><b>s</b></span>
        <span class="exr-btns">
          <button type="button" class="icon-btn" data-move="-1" title="Monter"${i ? '' : ' disabled'}>↑</button>
          <button type="button" class="icon-btn" data-move="1" title="Descendre"${i < rows.length - 1 ? '' : ' disabled'}>↓</button>
          <button type="button" class="icon-btn" data-remove title="Retirer">✕</button>
        </span>
      </div>`).join('') : '<div class="mut small">Aucun exercice. Ajoute ton premier exercice.</div>';
    renderSummary();
  }
  function renderSummary() {
    const ok = rows.map(r => ({ sets: Number(r.sets), rest: r.rest.trim() === '' ? null : Number(r.rest) })).filter(r => r.sets > 0);
    $('#wkSummary').textContent = rows.length ? `${rows.length} exercice${rows.length > 1 ? 's' : ''} · ${ok.reduce((t, r) => t + r.sets, 0)} séries · environ ${minutes(ok)} min` : '';
  }
  $('#exRows').addEventListener('input', e => {
    const row = e.target.closest('.exr');
    if (row && e.target.dataset.f) { rows[+row.dataset.i][e.target.dataset.f] = e.target.value; renderSummary(); }
  });
  $('#exRows').addEventListener('click', e => {
    const b = e.target.closest('button'), row = e.target.closest('.exr');
    if (!b || !row) return;
    const i = +row.dataset.i;
    if (b.dataset.remove != null) rows.splice(i, 1);
    else if (b.dataset.move) { const j = i + Number(b.dataset.move); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    renderRows();
  });
  $('#addExercise').addEventListener('click', () => {
    rows.push(blank());
    renderRows();
    $('#exRows .exr:last-child input').focus();
  });

  const m = modal('workoutOverlay', {
    onSubmit() {
      const name = m.form.elements.name.value.trim().replace(/\s+/g, ' ');
      if (!name) return m.error('Le nom est obligatoire.');
      if (DB.workouts.some(w => w !== editing && norm(w.name) === norm(name))) return m.error(`« ${name} » existe déjà dans tes séances.`);
      const filled = rows.filter(r => r.name.trim() || r.weight.trim());
      if (!filled.length) return m.error('Ajoute au moins un exercice.');
      const exercises = [];
      for (const r of filled) {
        const ex = r.name.trim().replace(/\s+/g, ' ');
        if (!ex) return m.error('Chaque exercice doit avoir un nom.');
        const sets = Number(r.sets), reps = r.reps.replace(/\s/g, ''), weight = parseNum(r.weight), rest = r.rest.trim() === '' ? null : Number(r.rest);
        if (!(Number.isInteger(sets) && sets >= 1 && sets <= 20)) return m.error(`« ${ex} » : nombre de séries invalide (1 à 20).`);
        if (!/^(\d{1,3}(-\d{1,3})?|max)$/i.test(reps)) return m.error(`« ${ex} » : répétitions invalides (ex. 12, 8-12 ou max).`);
        if (Number.isNaN(weight) || (weight != null && weight > 500)) return m.error(`« ${ex} » : poids invalide (en kg, ex. 6).`);
        if (rest != null && !(Number.isInteger(rest) && rest >= 0 && rest <= 900)) return m.error(`« ${ex} » : repos invalide (en secondes, ex. 60).`);
        exercises.push({ name: ex, sets, reps: reps.toLowerCase(), weight, rest });
      }
      const now = new Date().toISOString();
      if (editing) Object.assign(editing, { name, exercises, updated: now });
      else DB.workouts.push({ id: crypto.randomUUID(), name, exercises, created: now, updated: now });
      save(); m.close(); App.render();
    },
    onDelete() {
      DB.workouts = DB.workouts.filter(w => w !== editing);
      save(); m.close(); App.render();
    }
  });
  function open(tpl) {
    editing = tpl || null;
    m.form.reset();
    m.form.elements.name.value = tpl?.name || '';
    rows = tpl ? tpl.exercises.map(x => ({ name: x.name, sets: String(x.sets), reps: x.reps, weight: inputVal(x.weight), rest: x.rest == null ? '' : String(x.rest) })) : [blank()];
    renderRows();
    m.open(tpl ? 'Modifier la séance' : 'Nouvelle séance', !!tpl);
  }

  return { render: () => renderAll(false), open, modal: m, loads, mountText };
})();
