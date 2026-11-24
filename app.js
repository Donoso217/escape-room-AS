/* El baúl de la Puebla — escape room del taller "Detrás de la máscara" */
(() => {
const $app = document.getElementById('app');
const $status = document.getElementById('status');
const CFG = window.ESCAPE_CONFIG || {};
const db = (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
$status.textContent = db ? 'En línea' : 'Modo local';

const PEN_HINT = 30, PEN_ERR = 15;           // segundos de penalización
const FRAGS = ['MA', 'NT', 'U', 'DO'];
const FINAL = 'MANTUDO';
const LOCK_NAMES = ['El candado del tiempo', '¿Quién está detrás de la máscara?', 'El taller del mascarero', 'La combinación final'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
const fmt = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const score = t => {
  const end = t.finished_at ? new Date(t.finished_at) : new Date();
  return (end - new Date(t.started_at)) / 1000 + PEN_HINT * (t.hints || 0) + PEN_ERR * (t.errors || 0);
};

/* ---------------- Contenido ---------------- */
const TIMELINE = [
  { y: 1824, t: 'Nace Rafael "Lito" Valerín en el barrio de Los Ángeles, en Cartago.' },
  { y: 1877, t: 'Se organiza en Cartago la primera mascarada, para las fiestas de agosto.' },
  { y: 1912, t: 'Tras el terremoto de 1910, las máscaras salen en el carnaval de Cartago.' },
  { y: 1930, t: 'Jesús Valerín vende los moldes de la familia a los hermanos Freer.' },
  { y: 1996, t: 'Un decreto declara el 31 de octubre Día de la Mascarada Tradicional Costarricense.' },
  { y: 2022, t: 'La mascarada tradicional es declarada símbolo nacional de Costa Rica.' }
];
const WHO = [
  { mask: 'giganta', ans: 'La Giganta', opts: ['La Giganta', 'La Llorona', 'La Bruja', 'La Cegua'],
    fact: 'Según la leyenda, Lito Valerín encontró unas cabezas españolas en un baúl de la iglesia de Los Ángeles y montó una sobre una armazón de madera: así nació la primera Giganta.' },
  { mask: 'diablo', ans: 'El Diablo', opts: ['El Policía', 'El Diablo', 'El Gigante', 'El Viejillo'],
    fact: 'El Diablo es uno de los personajes que Lito Valerín introdujo y que hasta hoy no falta en ninguna mascarada.' },
  { mask: 'calavera', ans: 'La Muerte o Calavera', opts: ['La Giganta', 'El Diablo', 'La Muerte o Calavera', 'La Cegua'],
    fact: 'La Muerte o Calavera también viene de los primeros personajes de Valerín, en el siglo XIX.' },
  { mask: 'cegua', ans: 'La Cegua', opts: ['La Llorona', 'La Cegua', 'La Bruja', 'La Muerte o Calavera'],
    fact: 'La Cegua viene de la leyenda de la mujer que se aparece de noche a los hombres trasnochadores y cambia su rostro por el de una yegua.' }
];
const MATERIALS = [
  { t: 'Molde de barro', a: 'antes' },
  { t: 'Arcilla traída de El Tejar de El Guarco', a: 'antes' },
  { t: 'Papel pegado con engrudo de almidón', a: 'antes' },
  { t: 'Yeso y alambre', a: 'antes' },
  { t: 'Fibra de vidrio', a: 'ahora' },
  { t: 'Resinas', a: 'ahora' },
  { t: 'Espuma y cartón', a: 'ahora' }
];

/* ---------------- Estado del equipo ---------------- */
let team = null;            // {id?, game_code, name, members, lock, hints, errors, started_at, finished_at}
let timer = null;

async function saveTeam(fields) {
  Object.assign(team, fields);
  store.set('escape_team', team);
  if (db && team.id) {
    const { error } = await db.from('teams').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', team.id);
    if (error) console.warn(error);
  }
}
const addHint = () => saveTeam({ hints: (team.hints || 0) + 1 });
const addError = () => saveTeam({ errors: (team.errors || 0) + 1 });

function header() {
  const pills = LOCK_NAMES.map((n, i) => {
    const cls = i < team.lock ? 'done' : i === team.lock ? 'cur' : '';
    const label = i < team.lock ? `🔓 ${FRAGS[i]}` : `🔒 ${i + 1}`;
    return `<span class="lock ${cls}" title="${esc(n)}">${label}</span>`;
  }).join('');
  return `<div class="row" style="justify-content:space-between;margin-bottom:8px">
      <span class="badge">${esc(team.name)}</span>
      <span class="small">Tiempo: <b id="clock">0:00</b> · Pistas: ${team.hints || 0} · Errores: ${team.errors || 0}</span>
    </div><div class="locks">${pills}</div>`;
}
function startClock() {
  clearInterval(timer);
  timer = setInterval(() => { const c = document.getElementById('clock'); if (c && team) c.textContent = fmt((Date.now() - new Date(team.started_at)) / 1000); }, 500);
}

/* ---------------- Vistas ---------------- */
function viewHome() {
  $app.innerHTML = `
  <section class="hero">
    <div class="eyebrow">Escape room · Detrás de la máscara</div>
    <h1>El baúl de la Puebla</h1>
    <p>En 1824 nació en el barrio de Los Ángeles de Cartago, la Puebla de los Pardos, un artesano llamado Rafael "Lito" Valerín. Cuenta la leyenda que un día encontró en la iglesia un baúl viejo lleno de cabezas de máscaras.</p>
    <p>El baúl tiene <b>cuatro candados</b>. Cada uno guarda un pedazo de una palabra secreta. Abran los cuatro antes que los demás equipos.</p>
  </section>
  <div class="grid2">
    <div class="card"><h3>Soy un equipo</h3><p class="small">Una persona del equipo comparte pantalla y todos ayudan a resolver.</p><a class="btn" href="#/equipo">Entrar al juego</a></div>
    <div class="card"><h3>Soy el anfitrión</h3><p class="small">Arma los equipos, da el código de la partida y muestra el ranking en vivo.</p>
      ${db ? '<a class="btn sec" href="#/anfitrion">Abrir panel</a>' : '<p class="msg info">El panel necesita Supabase configurado en <code>config.js</code>.</p>'}</div>
  </div>`;
}

/* ---- Anfitrión ---- */
function makeTeams(names, size) {
  const list = shuffle(names);
  const n = Math.max(1, Math.round(list.length / size));
  const teams = Array.from({ length: n }, () => []);
  list.forEach((p, i) => teams[i % n].push(p));
  return teams;
}
function viewHostSetup() {
  let size = 4;
  $app.innerHTML = `
  <div class="card">
    <h2>Crear partida</h2>
    <label>Tamaño de los equipos</label>
    <div class="seg" id="seg">${[3, 4, 5].map(n => `<button class="btn sec ${n === 4 ? 'on' : ''}" data-n="${n}">Equipos de ${n}</button>`).join('')}</div>
    <label for="names">Participantes (uno por línea, opcional)</label>
    <textarea id="names" placeholder="Si se dejan los nombres, el juego arma los equipos al azar.&#10;Si no, solo se indica cuántos equipos habrá."></textarea>
    <label for="nteams">Si no ponen nombres: ¿cuántas personas hay?</label>
    <input id="npeople" type="number" min="2" max="40" value="12">
    <p class="small" id="preview"></p>
    <button class="btn" id="create">Crear partida</button>
    <div id="err"></div>
  </div>`;
  const preview = () => {
    const names = document.getElementById('names').value.split('\n').map(s => s.trim()).filter(Boolean);
    const people = names.length || Number(document.getElementById('npeople').value) || 0;
    const n = Math.max(1, Math.round(people / size));
    document.getElementById('preview').textContent = `${people} personas en equipos de ${size} → ${n} equipo${n > 1 ? 's' : ''}.`;
  };
  document.getElementById('seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; size = +b.dataset.n; document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('on', x === b)); preview(); };
  document.getElementById('names').oninput = preview; document.getElementById('npeople').oninput = preview; preview();
  document.getElementById('create').onclick = async () => {
    const names = document.getElementById('names').value.split('\n').map(s => s.trim()).filter(Boolean);
    const people = names.length || Number(document.getElementById('npeople').value) || 4;
    const groups = names.length ? makeTeams(names, size) : Array.from({ length: Math.max(1, Math.round(people / size)) }, () => []);
    const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
    const { error } = await db.from('games').insert({ code, team_size: size, groups });
    if (error) { document.getElementById('err').innerHTML = `<p class="msg bad">No se pudo crear la partida: ${esc(error.message)}</p>`; return; }
    store.set('escape_host', code); location.hash = '#/anfitrion/' + code;
  };
}
let poll = null;
async function viewHost(code) {
  const { data: game, error } = await db.from('games').select('*').eq('code', code).single();
  if (error || !game) { $app.innerHTML = `<p class="msg bad">No existe la partida ${esc(code)}.</p><a class="btn" href="#/anfitrion">Crear otra</a>`; return; }
  const groups = game.groups || [];
  $app.innerHTML = `
  <section class="hero center">
    <div class="eyebrow">Código de la partida</div><div class="code">${esc(code)}</div>
    <p>Entren a esta página, toquen «Entrar al juego» y escriban el código.</p>
  </section>
  ${groups.some(g => g.length) ? `<div class="card"><h3>Equipos</h3><div class="teams">${groups.map((g, i) => `<div class="team"><b>Equipo ${i + 1}</b><div class="small">${g.map(esc).join(', ')}</div></div>`).join('')}</div></div><div class="spacer"></div>` : ''}
  <div class="card"><div class="row" style="justify-content:space-between"><h3>Ranking en vivo</h3><span class="small">Puntaje = tiempo + ${PEN_HINT} s por pista + ${PEN_ERR} s por error</span></div>
  <table class="table"><thead><tr><th>#</th><th>Equipo</th><th>Candados</th><th>Pistas</th><th>Errores</th><th>Tiempo</th></tr></thead><tbody id="rank"><tr><td colspan="6" class="small">Esperando equipos…</td></tr></tbody></table></div>`;
  const draw = async () => {
    const { data } = await db.from('teams').select('*').eq('game_code', code);
    if (!data) return;
    const rows = data;
    const done = rows.filter(r => r.finished_at).sort((a, b) => score(a) - score(b));
    const order = done.concat(rows.filter(r => !r.finished_at).sort((a, b) => b.lock - a.lock));
    document.getElementById('rank').innerHTML = order.length ? order.map((t, i) => `<tr>
      <td><b>${t.finished_at ? i + 1 : '–'}</b></td><td><b>${esc(t.name)}</b><div class="small">${esc(t.members || '')}</div></td>
      <td><div class="bar"><span style="width:${(t.lock / 4) * 100}%"></span></div><span class="small">${t.finished_at ? '¡Baúl abierto!' : `${t.lock} de 4`}</span></td>
      <td>${t.hints}</td><td>${t.errors}</td><td>${fmt(score(t))}${t.finished_at ? ' ✓' : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="small">Esperando equipos…</td></tr>';
  };
  clearInterval(poll); draw(); poll = setInterval(draw, 2500);
}

/* ---- Equipo: entrar ---- */
async function viewJoin() {
  const saved = store.get('escape_team');
  if (saved && !saved.finished_at && saved.lock !== undefined) {
    $app.innerHTML = `<div class="card"><h2>¿Continuar?</h2><p>Hay una partida guardada de <b>${esc(saved.name)}</b> (${saved.lock} de 4 candados).</p>
      <div class="row"><button class="btn" id="cont">Continuar</button><button class="btn ghost" id="new">Empezar de nuevo</button></div></div>`;
    document.getElementById('cont').onclick = () => { team = saved; route(true); };
    document.getElementById('new').onclick = () => { store.del('escape_team'); viewJoin(); };
    return;
  }
  $app.innerHTML = `<div class="card">
    <h2>Entrar al juego</h2>
    ${db ? `<label for="code">Código de la partida</label><input id="code" maxlength="4" style="text-transform:uppercase" placeholder="Ej.: KMTR">
    <div id="pick"></div>` : '<p class="msg info">Modo local: el juego funciona, pero sin ranking compartido.</p>'}
    <label for="tname">Nombre del equipo</label><input id="tname" placeholder="Ej.: Los Mantudos">
    <label for="members">Integrantes</label><input id="members" placeholder="Nombres separados por coma">
    <div class="spacer"></div><button class="btn" id="go">Abrir el baúl</button><div id="err"></div></div>`;
  let groups = [];
  if (db) {
    document.getElementById('code').oninput = async e => {
      const code = e.target.value.trim().toUpperCase();
      if (code.length !== 4) return;
      const { data } = await db.from('games').select('groups').eq('code', code).maybeSingle();
      groups = data?.groups || [];
      document.getElementById('pick').innerHTML = !data ? '<p class="msg bad">Ese código no existe.</p>'
        : groups.some(g => g.length) ? `<label>¿Cuál es su equipo?</label><select id="gsel"><option value="">Elegir…</option>${groups.map((g, i) => `<option value="${i}">Equipo ${i + 1}: ${esc(g.join(', '))}</option>`).join('')}</select>` : '<p class="msg ok">Partida encontrada.</p>';
      const sel = document.getElementById('gsel');
      if (sel) sel.onchange = () => { const g = groups[+sel.value]; if (g) { document.getElementById('members').value = g.join(', '); if (!document.getElementById('tname').value) document.getElementById('tname').value = `Equipo ${+sel.value + 1}`; } };
    };
  }
  document.getElementById('go').onclick = async () => {
    const name = document.getElementById('tname').value.trim() || 'Equipo sin nombre';
    const members = document.getElementById('members').value.trim();
    team = { name, members, lock: 0, hints: 0, errors: 0, started_at: new Date().toISOString(), finished_at: null };
    if (db) {
      const code = document.getElementById('code').value.trim().toUpperCase();
      const { data: g } = await db.from('games').select('code').eq('code', code).maybeSingle();
      if (!g) { document.getElementById('err').innerHTML = '<p class="msg bad">Revisen el código de la partida.</p>'; return; }
      const { data, error } = await db.from('teams').insert({ game_code: code, name, members, lock: 0, hints: 0, errors: 0 }).select().single();
      if (error) { document.getElementById('err').innerHTML = `<p class="msg bad">${esc(error.message)}</p>`; return; }
      team = data;
    }
    store.set('escape_team', team); route(true);
  };
}

/* ---- Candado 1: orden cronológico ---- */
function lock1() {
  let order = store.get('escape_l1') || shuffle(TIMELINE.map((_, i) => i));
  store.set('escape_l1', order);
  let revealed = store.get('escape_l1r') || [];
  const draw = (feedback) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 1 · ${LOCK_NAMES[0]}</h2>
      <p>La historia del baúl se desordenó. Ordenen los hechos del más antiguo al más reciente con las flechas.</p>
      <ul class="list">${order.map((idx, pos) => `<li class="item ${feedback ? (feedback[pos] ? 'okb' : 'badb') : ''}">
        <span class="badge">${revealed.includes(idx) ? TIMELINE[idx].y : '¿?'}</span><span class="txt">${esc(TIMELINE[idx].t)}</span>
        <span class="arrows"><button class="btn sec" data-up="${pos}" ${pos === 0 ? 'disabled' : ''}>↑</button><button class="btn sec" data-dn="${pos}" ${pos === order.length - 1 ? 'disabled' : ''}>↓</button></span></li>`).join('')}</ul>
      <div id="msg"></div>
      <div class="row"><button class="btn" id="check">Probar el candado</button><button class="btn ghost" id="hint">Pista: revelar un año (+${PEN_HINT} s)</button></div></div>`;
    startClock();
    $app.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const p = +b.dataset.up; [order[p - 1], order[p]] = [order[p], order[p - 1]]; store.set('escape_l1', order); draw(); });
    $app.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { const p = +b.dataset.dn; [order[p + 1], order[p]] = [order[p], order[p + 1]]; store.set('escape_l1', order); draw(); });
    document.getElementById('hint').onclick = async () => {
      const left = TIMELINE.map((_, i) => i).filter(i => !revealed.includes(i));
      if (!left.length) return;
      revealed.push(left[Math.floor(Math.random() * left.length)]); store.set('escape_l1r', revealed); await addHint(); draw();
    };
    document.getElementById('check').onclick = async () => {
      const fb = order.map((idx, pos) => idx === pos);
      const ok = fb.filter(Boolean).length;
      if (ok === order.length) return unlocked(0, 'Esa es la historia: la mascarada nació en un barrio de Cartago y en menos de dos siglos se volvió símbolo nacional.');
      await addError(); draw(fb);
      document.getElementById('msg').innerHTML = `<p class="msg bad">${ok} de ${order.length} están en su lugar. Los verdes ya están bien.</p>`;
    };
  };
  draw();
}

/* ---- Candado 2: ¿Quién está detrás de la máscara? ---- */
function lock2() {
  let st = store.get('escape_l2') || { round: 0, open: [], rounds: shuffle(WHO.map((_, i) => i)).slice(0, 3) };
  const draw = (msg) => {
    const w = WHO[st.rounds[st.round]];
    const tiles = Array.from({ length: 9 }, (_, i) => `<div class="tile ${st.open.includes(i) ? 'off' : ''}"></div>`).join('');
    $app.innerHTML = header() + `<div class="card"><h2>Candado 2 · ${LOCK_NAMES[1]}</h2>
      <p>Dentro del baúl hay máscaras tapadas. Descubran quién está detrás de cada una. Máscara <b>${st.round + 1} de 3</b>.</p>
      <div class="maskbox">${window.MASKS[w.mask]}<div class="tiles">${tiles}</div></div>
      <div class="center" style="margin-bottom:14px"><button class="btn ghost" id="peek" ${st.open.length >= 9 ? 'disabled' : ''}>Destapar una pieza${st.open.length >= 2 ? ` (+${PEN_HINT} s)` : ' (gratis)'}</button>
      <div class="small">Las dos primeras piezas son gratis.</div></div>
      <div class="opts">${shuffle(w.opts).map(o => `<button class="btn sec" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="msg">${msg || ''}</div></div>`;
    startClock();
    document.getElementById('peek').onclick = async () => {
      const closed = Array.from({ length: 9 }, (_, i) => i).filter(i => !st.open.includes(i));
      if (!closed.length) return;
      if (st.open.length >= 2) await addHint();
      st.open.push(closed[Math.floor(Math.random() * closed.length)]); store.set('escape_l2', st); draw();
    };
    $app.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => {
      if (b.dataset.o !== w.ans) { await addError(); draw('<p class="msg bad">No es ese personaje. Destapen otra pieza o intenten de nuevo.</p>'); return; }
      st.open = Array.from({ length: 9 }, (_, i) => i); store.set('escape_l2', st);
      const last = st.round === 2;
      draw(`<div class="fact"><b>¡Es ${esc(w.ans)}!</b> ${esc(w.fact)}</div><button class="btn" id="next">${last ? 'Abrir el candado' : 'Siguiente máscara'}</button>`);
      $app.querySelectorAll('[data-o]').forEach(x => x.disabled = true);
      document.getElementById('next').onclick = () => {
        if (last) return unlocked(1, 'Muchos personajes de la mascarada vienen de leyendas populares y de los primeros diseños de Lito Valerín.');
        st.round++; st.open = []; store.set('escape_l2', st); draw();
      };
    });
  };
  draw();
}

/* ---- Candado 3: antes o ahora ---- */
function lock3() {
  const deck = store.get('escape_l3o') || shuffle(MATERIALS.map((_, i) => i));
  store.set('escape_l3o', deck);
  const pick = {};
  const draw = (fb, msg) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 3 · ${LOCK_NAMES[2]}</h2>
      <p>En el taller se mezclaron materiales de distintas épocas. Marquen cuáles usaban los Valerín en el siglo XIX y comienzos del XX (<b>antes</b>) y cuáles se usan hoy, como don Pocho (<b>ahora</b>).</p>
      <div class="cards">${deck.map(i => `<div class="mcard ${fb ? (fb[i] ? 'okb' : 'badb') : ''}"><div style="font-weight:600;margin-bottom:10px">${esc(MATERIALS[i].t)}</div>
        <div class="row"><button class="btn ${pick[i] === 'antes' ? '' : 'sec'}" data-i="${i}" data-v="antes">Antes</button><button class="btn ${pick[i] === 'ahora' ? '' : 'sec'}" data-i="${i}" data-v="ahora">Ahora</button></div></div>`).join('')}</div>
      <div id="msg">${msg || ''}</div><div class="spacer"></div><button class="btn" id="check">Probar el candado</button></div>`;
    startClock();
    $app.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { pick[b.dataset.i] = b.dataset.v; draw(); });
    document.getElementById('check').onclick = async () => {
      if (Object.keys(pick).length < MATERIALS.length) { draw(null, '<p class="msg info">Falta clasificar alguna tarjeta.</p>'); return; }
      const res = {}; let ok = 0; MATERIALS.forEach((m, i) => { res[i] = pick[i] === m.a; if (res[i]) ok++; });
      if (ok === MATERIALS.length) return unlocked(2, 'La técnica tradicional era cubrir con papel un molde de barro. Hoy muchos mascareros usan fibra de vidrio y resinas, que hacen las máscaras más livianas y duraderas.');
      await addError(); draw(res, `<p class="msg bad">${ok} de ${MATERIALS.length} correctas. Las rojas están mal.</p>`);
    };
  };
  draw();
}

/* ---- Candado 4: combinación ---- */
function lock4() {
  let hintShown = store.get('escape_l4h') || false;
  const draw = (msg) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 4 · ${LOCK_NAMES[3]}</h2>
      <p>El último candado tiene cuatro números. Una nota pegada en el baúl dice:</p>
      <div class="fact"><i>«El Decreto Ejecutivo 25724-C, de 1996, eligió el día en que todo el país celebra la mascarada. Escriban el día y el mes: DD MM.»</i></div>
      ${hintShown ? '<p class="msg info">Pista: es el mismo día que Halloween.</p>' : ''}
      <div class="dial">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" maxlength="1" data-d="${i}" aria-label="Dígito ${i + 1}">`).join('')}</div>
      <div id="msg">${msg || ''}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="check">Probar la combinación</button>${hintShown ? '' : `<button class="btn ghost" id="hint">Pista (+${PEN_HINT} s)</button>`}</div></div>`;
    startClock();
    const ins = [...$app.querySelectorAll('[data-d]')];
    ins.forEach((el, i) => el.oninput = () => { el.value = el.value.replace(/\D/g, ''); if (el.value && ins[i + 1]) ins[i + 1].focus(); });
    ins[0].focus();
    const h = document.getElementById('hint'); if (h) h.onclick = async () => { hintShown = true; store.set('escape_l4h', true); await addHint(); draw(); };
    document.getElementById('check').onclick = async () => {
      const v = ins.map(x => x.value).join('');
      if (v === '3110') return unlocked(3, 'Desde 1996, el 31 de octubre es el Día de la Mascarada Tradicional Costarricense, y desde 2022 la mascarada es símbolo nacional.');
      await addError(); draw('<p class="msg bad">El candado no abre. Revisen la nota.</p>');
    };
  };
  draw();
}

/* ---- Final: formar la palabra ---- */
function finalWord() {
  const chips = shuffle(FRAGS.map((f, i) => ({ f, i })));
  let built = [];
  const draw = (msg) => {
    $app.innerHTML = header() + `<div class="card center"><h2>El baúl está abierto</h2>
      <p>Ordenen los cuatro pedazos para formar el nombre de la persona que carga y baila la mascarada.</p>
      <div class="answer">${built.map(i => FRAGS[i]).join('') || '&nbsp;'}</div>
      <div class="chips">${chips.map(c => `<button class="chip ${built.includes(c.i) ? 'used' : ''}" data-c="${c.i}" ${built.includes(c.i) ? 'disabled' : ''}>${c.f}</button>`).join('')}</div>
      <div id="msg">${msg || ''}</div>
      <div class="row" style="justify-content:center"><button class="btn ghost" id="clear">Borrar</button><button class="btn" id="check">Confirmar palabra</button></div></div>`;
    startClock();
    $app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { built.push(+b.dataset.c); draw(); });
    document.getElementById('clear').onclick = () => { built = []; draw(); };
    document.getElementById('check').onclick = async () => {
      if (built.map(i => FRAGS[i]).join('') === FINAL) { await saveTeam({ lock: 4, finished_at: new Date().toISOString() }); return viewWin(); }
      await addError(); built = []; draw('<p class="msg bad">Esa no es la palabra. Piensen en quien va debajo de la Giganta.</p>');
    };
  };
  draw();
}

function unlocked(i, fact) {
  $app.innerHTML = header() + `<div class="card center"><div class="eyebrow" style="color:var(--terra)">Candado ${i + 1} abierto</div>
    <h2>🔓 Encontraron el pedazo <span class="frag">«${FRAGS[i]}»</span></h2><div class="fact" style="text-align:left">${esc(fact)}</div>
    <button class="btn" id="next">${i === 3 ? 'Abrir el baúl' : 'Siguiente candado'}</button></div>`;
  startClock();
  document.getElementById('next').onclick = async () => { if (i < 3) await saveTeam({ lock: i + 1 }); else store.set('escape_team', team); i < 3 ? route(true) : finalWord(); };
}

function viewWin() {
  clearInterval(timer);
  const t = score(team);
  $app.innerHTML = `<section class="hero center"><div class="eyebrow">¡Lo lograron!</div><h1>MANTUDO</h1>
    <p>El mantudo es la persona que carga la mascarada y la hace bailar al ritmo de la cimarrona.</p>
    <p><b>${esc(team.name)}</b> · Puntaje final: <b>${fmt(t)}</b> (tiempo + pistas + errores)</p></section>
    <div class="card center"><p>Esperen a que el anfitrión muestre el ranking.</p><button class="btn ghost" id="reset">Salir</button></div>`;
  document.getElementById('reset').onclick = () => { ['escape_team', 'escape_l1', 'escape_l1r', 'escape_l2', 'escape_l3o', 'escape_l4h'].forEach(store.del); location.hash = '#/'; };
}

/* ---------------- Router ---------------- */
function route(fromGame) {
  clearInterval(poll);
  const h = location.hash.replace(/^#\/?/, '');
  if (fromGame || h.startsWith('equipo')) {
    if (!team) team = store.get('escape_team');
    if (!team || team.lock === undefined) { if (!fromGame) return viewJoin(); }
    if (team.finished_at) return viewWin();
    if (!h.startsWith('equipo')) history.replaceState(null, '', '#/equipo');
    if (fromGame || store.get('escape_team')) {
      return [lock1, lock2, lock3, lock4, finalWord][team.lock]();
    }
    return viewJoin();
  }
  clearInterval(timer);
  if (h.startsWith('anfitrion')) {
    if (!db) return viewHome();
    const code = h.split('/')[1];
    return code ? viewHost(code.toUpperCase()) : viewHostSetup();
  }
  viewHome();
}
window.addEventListener('hashchange', () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('equipo')) { team = null; return viewJoin(); }
  route(false);
});
// Al cargar, "#/equipo" muestra la pantalla de entrar/continuar.
(location.hash.replace(/^#\/?/, '').startsWith('equipo') ? viewJoin : () => route(false))();
})();
