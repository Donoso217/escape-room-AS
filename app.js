/* El baúl de la Puebla — escape room del taller "Detrás de la máscara" */
(() => {
const $app = document.getElementById('app');
const $status = document.getElementById('status');
const CFG = window.ESCAPE_CONFIG || {};
const db = (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
$status.textContent = db ? 'En línea' : 'Modo local';

const PEN_HINT = 30, PEN_ERR = 15;           // segundos de penalización
const FINAL = 'MANTUDO';
const LOCK_NAMES = ['El candado del tiempo', '¿Quién está detrás de la máscara?', 'La carta cifrada', 'El taller del mascarero', 'La máscara rota', 'El diccionario del mascarero', 'La combinación final'];
const NL = LOCK_NAMES.length;
const CIPHER_PLAIN = 'EL DIA DE LA MASCARADA ES EL TREINTA Y UNO DE OCTUBRE';

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
  { y: 1910, t: 'Un terremoto destruye gran parte de la ciudad de Cartago.' },
  { y: 1912, t: 'Las máscaras salen en el carnaval de Cartago.' },
  { y: 1930, t: 'Jesús Valerín vende los moldes de la familia a los hermanos Freer.' },
  { y: 1931, t: 'Pedro Arias empieza a hacer máscaras.' },
  { y: 1996, t: 'Un decreto crea el Día de la Mascarada Tradicional Costarricense.' },
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
const DICT = [
  { w: 'Cimarrona', d: 'Banda de música popular que acompaña a la mascarada por las calles.' },
  { w: 'Molde', d: 'Base de barro sobre la que se le da forma a la máscara.' },
  { w: 'Engrudo', d: 'Pegamento casero hecho con almidón y agua.' },
  { w: 'Giganta', d: 'Uno de los primeros personajes, montado sobre una armazón de madera.' },
  { w: 'Puebla de los Pardos', d: 'Antiguo barrio de Cartago donde nació Lito Valerín.' },
  { w: 'Símbolo nacional', d: 'Declaración que recibió la mascarada tradicional en 2022.' }
];

/* ---------------- Estado del equipo ---------------- */
// Cada equipo recibe su propia partida al azar: orden de las letras, cuántas
// y cuáles máscaras (eso cambia la clave de la carta) y la máscara del rompecabezas.
const STATE_V = 3;
const MASK_KEYS = ['giganta', 'diablo', 'calavera', 'cegua'];
let CFGT = null;
function newCfg() {
  let letters; do { letters = shuffle([...FINAL]); } while (letters.join('') === FINAL);
  const n = 2 + Math.floor(Math.random() * 3);           // entre 2 y 4 máscaras
  return { v: STATE_V, letters, rounds: shuffle(WHO.map((_, i) => i)).slice(0, n), puzzle: MASK_KEYS[Math.floor(Math.random() * MASK_KEYS.length)] };
}
function cfg() {
  if (!CFGT) { CFGT = store.get('escape_cfg'); if (!CFGT || CFGT.v !== STATE_V) { CFGT = newCfg(); store.set('escape_cfg', CFGT); } }
  return CFGT;
}
function resetLocal() {
  try { Object.keys(localStorage).filter(k => k.startsWith('escape_')).forEach(k => localStorage.removeItem(k)); } catch {}
  CFGT = null;
}
// Si quedó guardada una partida de una versión anterior del juego, se borra.
{ const old = store.get('escape_cfg'); if ((old && old.v !== STATE_V) || (!old && store.get('escape_team'))) resetLocal(); }
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
    const label = i < team.lock ? `🔓 ${cfg().letters[i]}` : `🔒 ${i + 1}`;
    return `<span class="lock ${cls}" title="${esc(n)}">${label}</span>`;
  }).join('');
  return `<div class="row" style="justify-content:space-between;margin-bottom:8px">
      <span class="badge">${esc(team.name)}</span>
      <span class="small">Tiempo: <b id="clock">${fmt((Date.now() - new Date(team.started_at)) / 1000)}</b> · Pistas: ${team.hints || 0} · Errores: <span id="errn">${team.errors || 0}</span></span>
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
    <p>El baúl tiene <b>siete candados</b>. Cada uno guarda una letra de una palabra secreta. Abran los siete y resuelvan el crucigrama final antes que los demás equipos.</p>
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
      <td><div class="bar"><span style="width:${Math.min(t.lock, NL) / NL * 100}%"></span></div><span class="small">${t.finished_at ? '¡Baúl abierto!' : (t.lock >= NL ? 'En el crucigrama final' : `${t.lock} de ${NL}`)}</span></td>
      <td>${t.hints}</td><td>${t.errors}</td><td>${fmt(score(t))}${t.finished_at ? ' ✓' : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="small">Esperando equipos…</td></tr>';
  };
  clearInterval(poll); draw(); poll = setInterval(draw, 2500);
}

/* ---- Equipo: entrar ---- */
function viewJoin() {
  const saved = store.get('escape_team');
  if (saved && !saved.finished_at && saved.lock !== undefined) {
    $app.innerHTML = `<div class="card"><h2>¿Continuar?</h2><p>Hay una partida guardada de <b id="savedName"></b> (${Math.min(Number(saved.lock) || 0, NL)} de ${NL} candados).</p>
      <div class="row"><button class="btn" id="cont">Continuar</button><button class="btn ghost" id="new">Empezar de nuevo</button></div></div>`;
    document.getElementById('savedName').textContent = String(saved.name ?? '');
    document.getElementById('cont').onclick = () => { team = saved; route(true); };
    document.getElementById('new').onclick = () => { resetLocal(); viewJoin(); };
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
    resetLocal(); cfg();
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
  let order = store.get('escape_l1');
  if (!order) do { order = shuffle(TIMELINE.map((_, i) => i)); } while (order.filter((x, i) => x === i).length > 2);
  store.set('escape_l1', order);
  let revealed = store.get('escape_l1r') || [];
  const draw = (msg) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 1 · ${LOCK_NAMES[0]}</h2>
      <p>La historia del baúl se desordenó. Ordenen los hechos del más antiguo al más reciente con las flechas. El candado solo dice cuántos están bien, no cuáles.</p>
      <ul class="list">${order.map((idx, pos) => `<li class="item">
        <span class="badge">${revealed.includes(idx) ? TIMELINE[idx].y : '¿?'}</span><span class="txt">${esc(TIMELINE[idx].t)}</span>
        <span class="arrows"><button class="btn sec" data-up="${pos}" ${pos === 0 ? 'disabled' : ''}>↑</button><button class="btn sec" data-dn="${pos}" ${pos === order.length - 1 ? 'disabled' : ''}>↓</button></span></li>`).join('')}</ul>
      <div id="msg">${msg || ''}</div>
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
      const ok = order.filter((idx, pos) => idx === pos).length;
      if (ok === order.length) return unlocked(0, 'Esa es la historia: la mascarada nació en un barrio de Cartago y en menos de dos siglos se volvió símbolo nacional.');
      await addError(); draw(`<p class="msg bad">${ok} de ${order.length} están en su lugar.</p>`);
    };
  };
  draw();
}

/* ---- Candado 2: ¿Quién está detrás de la máscara? ---- */
function lock2() {
  let st = store.get('escape_l2') || { round: 0, open: [], rounds: cfg().rounds.slice() };
  const total = st.rounds.length;
  const draw = (msg) => {
    const w = WHO[st.rounds[st.round]];
    const tiles = Array.from({ length: 9 }, (_, i) => `<div class="tile ${st.open.includes(i) ? 'off' : ''}"></div>`).join('');
    $app.innerHTML = header() + `<div class="card"><h2>Candado 2 · ${LOCK_NAMES[1]}</h2>
      <p>Dentro del baúl hay máscaras tapadas. Descubran quién está detrás de cada una. Máscara <b>${st.round + 1} de ${total}</b>.</p>
      <div class="maskbox">${window.MASKS[w.mask]}<div class="tiles">${tiles}</div></div>
      <div class="center" style="margin-bottom:14px"><button class="btn ghost" id="peek" ${st.open.length >= 9 ? 'disabled' : ''}>Destapar una pieza${st.open.length >= 1 ? ` (+${PEN_HINT} s)` : ' (gratis)'}</button>
      <div class="small">La primera pieza de cada máscara es gratis.</div></div>
      <div class="opts">${shuffle(w.opts).map(o => `<button class="btn sec" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="msg">${msg || ''}</div></div>`;
    startClock();
    document.getElementById('peek').onclick = async () => {
      const closed = Array.from({ length: 9 }, (_, i) => i).filter(i => !st.open.includes(i));
      if (!closed.length) return;
      if (st.open.length >= 1) await addHint();
      st.open.push(closed[Math.floor(Math.random() * closed.length)]); store.set('escape_l2', st); draw();
    };
    $app.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => {
      if (b.dataset.o !== w.ans) { await addError(); draw('<p class="msg bad">No es ese personaje. Destapen otra pieza o intenten de nuevo.</p>'); return; }
      st.open = Array.from({ length: 9 }, (_, i) => i); store.set('escape_l2', st);
      const last = st.round === total - 1;
      draw(`<div class="fact"><b>¡Es ${esc(w.ans)}!</b> ${esc(w.fact)}</div><button class="btn" id="next">${last ? 'Abrir el candado' : 'Siguiente máscara'}</button>`);
      $app.querySelectorAll('[data-o]').forEach(x => x.disabled = true);
      document.getElementById('peek').disabled = true;
      document.getElementById('next').onclick = () => {
        if (last) return unlocked(1, `Descubrieron ${total} máscaras. No olviden ese número: lo van a necesitar en el próximo candado.`);
        st.round++; st.open = []; store.set('escape_l2', st); draw();
      };
    });
  };
  draw();
}

/* ---- Candado 3: carta cifrada (César) ---- */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const caesar = (s, k) => s.replace(/[A-Z]/g, c => ABC[(ABC.indexOf(c) + k + 26) % 26]);
function lock3() {
  let hint = store.get('escape_l3h') || false;
  let shift = 0;
  const secret = caesar(CIPHER_PLAIN, cfg().rounds.length);
  const draw = (msg) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 3 · ${LOCK_NAMES[2]}</h2>
      <p>Pegada en la tapa del baúl hay una carta de Lito Valerín, escrita en clave. Cada letra se corrió hacia adelante en el alfabeto <b>tantos lugares como máscaras descubrieron en el candado anterior</b>.</p>
      <div class="cipher">${esc(secret)}</div>
      <p class="small">Usen la rueda para ver qué letra corresponde a cada una. Arriba está la letra de la carta y abajo la letra real.</p>
      <div class="wheel"><div class="wrow">${ABC.split('').map((c, i) => `<span>${ABC[(i + shift) % 26]}</span>`).join('')}</div>
        <div class="wrow real">${ABC.split('').map(c => `<span>${c}</span>`).join('')}</div></div>
      <div class="row" style="justify-content:center;margin:10px 0"><button class="btn sec" id="minus">◀</button><b id="shiftlbl">Corrimiento: ${shift}</b><button class="btn sec" id="plus">▶</button></div>
      ${hint ? `<p class="msg info">Pista: el corrimiento es ${cfg().rounds.length}.</p>` : ''}
      <label for="ans">Según la carta, ¿en qué mes se celebra la mascarada?</label>
      <input id="ans" placeholder="Escriban el mes" autocomplete="off">
      <div id="msg">${msg || ''}</div>
      <div class="row"><button class="btn" id="check">Probar el candado</button>${hint ? '' : `<button class="btn ghost" id="hint">Pista (+${PEN_HINT} s)</button>`}</div></div>`;
    startClock();
    const redrawWheel = () => {
      $app.querySelector('.wrow').innerHTML = ABC.split('').map((c, i) => `<span>${ABC[(i + shift) % 26]}</span>`).join('');
      document.getElementById('shiftlbl').textContent = `Corrimiento: ${shift}`;
    };
    document.getElementById('minus').onclick = () => { shift = (shift + 25) % 26; redrawWheel(); };
    document.getElementById('plus').onclick = () => { shift = (shift + 1) % 26; redrawWheel(); };
    const h = document.getElementById('hint');
    if (h) h.onclick = async () => { hint = true; store.set('escape_l3h', true); const v = document.getElementById('ans').value; await addHint(); draw(); document.getElementById('ans').value = v; };
    document.getElementById('check').onclick = async () => {
      const v = document.getElementById('ans').value.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (v === 'OCTUBRE') return unlocked(2, `La carta decía: «${CIPHER_PLAIN}». Guarden bien ese dato.`);
      await addError(); draw('<p class="msg bad">Ese no es el mes. Revisen el corrimiento.</p>');
    };
  };
  draw();
}

/* ---- Candado 4: antes o ahora ---- */
function lock4() {
  const deck = store.get('escape_l4o') || shuffle(MATERIALS.map((_, i) => i));
  store.set('escape_l4o', deck);
  const pick = {};
  const draw = (msg) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 4 · ${LOCK_NAMES[3]}</h2>
      <p>En el taller se mezclaron materiales de distintas épocas. Marquen cuáles usaban los Valerín en el siglo XIX y comienzos del XX (<b>antes</b>) y cuáles se usan hoy (<b>ahora</b>). El candado solo dice cuántas están bien.</p>
      <div class="cards">${deck.map(i => `<div class="mcard"><div style="font-weight:600;margin-bottom:10px">${esc(MATERIALS[i].t)}</div>
        <div class="row"><button class="btn ${pick[i] === 'antes' ? '' : 'sec'}" data-i="${i}" data-v="antes">Antes</button><button class="btn ${pick[i] === 'ahora' ? '' : 'sec'}" data-i="${i}" data-v="ahora">Ahora</button></div></div>`).join('')}</div>
      <div id="msg">${msg || ''}</div><div class="spacer"></div><button class="btn" id="check">Probar el candado</button></div>`;
    startClock();
    $app.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      pick[b.dataset.i] = b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('sec', x !== b));
    });
    document.getElementById('check').onclick = async () => {
      if (Object.keys(pick).length < MATERIALS.length) { document.getElementById('msg').innerHTML = '<p class="msg info">Falta clasificar alguna tarjeta.</p>'; return; }
      const ok = MATERIALS.filter((m, i) => pick[i] === m.a).length;
      if (ok === MATERIALS.length) return unlocked(3, 'La técnica tradicional era cubrir con papel un molde de barro. Hoy muchos mascareros usan fibra de vidrio y resinas, que hacen las máscaras más livianas y duraderas.');
      await addError(); document.getElementById('msg').innerHTML = `<p class="msg bad">${ok} de ${MATERIALS.length} correctas.</p>`;
      const n = document.getElementById('errn'); if (n) n.textContent = team.errors;
    };
  };
  draw();
}

/* ---- Candado 5: la máscara rota (rompecabezas) ---- */
function lock5() {
  const N = 4, T = N * N;
  let perm = store.get('escape_l5');
  if (!perm) { do { perm = shuffle([...Array(T).keys()]); } while (perm.some((p, i) => p === i) && perm.filter((p, i) => p === i).length > 2); store.set('escape_l5', perm); }
  let sel = null, nums = store.get('escape_l5h') || false;
  const img = `url('data:image/svg+xml;utf8,${encodeURIComponent(window.MASKS[cfg().puzzle])}')`;
  const draw = () => {
    $app.innerHTML = header() + `<div class="card center"><h2>Candado 5 · ${LOCK_NAMES[4]}</h2>
      <p>Al sacar una máscara del baúl se quebró en ${T} pedazos. Toquen dos piezas para cambiarlas de lugar hasta armarla.</p>
      <div class="puzzle" style="grid-template-columns:repeat(${N},1fr)">${perm.map((p, i) => `<button class="pz ${sel === i ? 'sel' : ''}" data-i="${i}" style="background-image:${img};background-size:${N * 100}% ${N * 100}%;background-position:${(p % N) * 100 / (N - 1)}% ${Math.floor(p / N) * 100 / (N - 1)}%" aria-label="Pieza">${nums ? `<span>${p + 1}</span>` : ''}</button>`).join('')}</div>
      ${nums ? '' : `<button class="btn ghost" id="hint">Pista: numerar las piezas (+${PEN_HINT} s)</button>`}</div>`;
    startClock();
    $app.querySelectorAll('.pz').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (sel === null) { sel = i; draw(); return; }
      if (sel !== i) { [perm[sel], perm[i]] = [perm[i], perm[sel]]; store.set('escape_l5', perm); }
      sel = null; draw();
      if (perm.every((p, k) => p === k)) setTimeout(() => unlocked(4, 'La máscara quedó entera. Antes, una máscara quebrada se reparaba con papel y engrudo sobre el mismo molde.'), 500);
    });
    const h = document.getElementById('hint'); if (h) h.onclick = async () => { nums = true; store.set('escape_l5h', true); await addHint(); draw(); };
  };
  draw();
}

/* ---- Candado 6: el diccionario del mascarero ---- */
function lock6() {
  const defs = store.get('escape_l6o') || shuffle(DICT.map((_, i) => i));
  store.set('escape_l6o', defs);
  const pick = {};
  $app.innerHTML = header() + `<div class="card"><h2>Candado 6 · ${LOCK_NAMES[5]}</h2>
    <p>En el fondo del baúl hay un cuaderno con palabras del oficio, pero las definiciones se despegaron. Unan cada palabra con su definición.</p>
    <div class="dict">${DICT.map((d, i) => `<div class="drow"><b>${esc(d.w)}</b><select data-w="${i}"><option value="">Elegir definición…</option>${defs.map(j => `<option value="${j}">${esc(DICT[j].d)}</option>`).join('')}</select></div>`).join('')}</div>
    <div id="msg"></div><div class="spacer"></div><button class="btn" id="check">Probar el candado</button></div>`;
  startClock();
  $app.querySelectorAll('select').forEach(s => s.onchange = () => { pick[s.dataset.w] = s.value; });
  document.getElementById('check').onclick = async () => {
    const msg = document.getElementById('msg');
    if (DICT.some((_, i) => !pick[i])) { msg.innerHTML = '<p class="msg info">Falta unir alguna palabra.</p>'; return; }
    const ok = DICT.filter((_, i) => +pick[i] === i).length;
    if (ok === DICT.length) return unlocked(5, 'Ya conocen el vocabulario del mascarero. Solo falta el último candado.');
    await addError(); msg.innerHTML = `<p class="msg bad">${ok} de ${DICT.length} están bien unidas.</p>`;
    const n = document.getElementById('errn'); if (n) n.textContent = team.errors;
  };
}

/* ---- Candado 7: combinación ---- */
function lock7() {
  let hintShown = store.get('escape_l7h') || false;
  const draw = (msg) => {
    $app.innerHTML = header() + `<div class="card"><h2>Candado 7 · ${LOCK_NAMES[6]}</h2>
      <p>El último candado tiene cuatro números. Una nota pegada en el baúl dice:</p>
      <div class="fact"><i>«La combinación es el día y el mes en que todo el país celebra la mascarada, según el decreto de 1996. Escríbanla así: DD MM. La carta de la tapa les puede ayudar.»</i></div>
      ${hintShown ? `<p class="msg info">Pista: la carta decía «${CIPHER_PLAIN}».</p>` : ''}
      <div class="dial">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" maxlength="1" data-d="${i}" aria-label="Dígito ${i + 1}">`).join('')}</div>
      <div id="msg">${msg || ''}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="check">Probar la combinación</button>${hintShown ? '' : `<button class="btn ghost" id="hint">Pista (+${PEN_HINT} s)</button>`}</div></div>`;
    startClock();
    const ins = [...$app.querySelectorAll('[data-d]')];
    ins.forEach((el, i) => el.oninput = () => { el.value = el.value.replace(/\D/g, ''); if (el.value && ins[i + 1]) ins[i + 1].focus(); });
    ins[0].focus();
    const h = document.getElementById('hint'); if (h) h.onclick = async () => { hintShown = true; store.set('escape_l7h', true); await addHint(); draw(); };
    document.getElementById('check').onclick = async () => {
      if (ins.map(x => x.value).join('') === '3110') return unlocked(6, 'Desde 1996, el 31 de octubre es el Día de la Mascarada Tradicional Costarricense, y desde 2022 la mascarada es símbolo nacional.');
      await addError(); draw('<p class="msg bad">El candado no abre. Revisen la nota.</p>');
    };
  };
  draw();
}

/* ---- Final: crucigrama ---- */
// Columna clave (vertical) = MANTUDO. Las horizontales la cruzan en las filas 0, 2, 4 y 6.
const XW = (() => {
  const K = 2;  // columna de la palabra clave dentro de la cuadrícula
  const words = [
    { n: 1, w: 'CIMARRONA', r: 0, c: K - 2, dir: 'h', clue: 'Banda que pone la música mientras bailan las máscaras.' },
    { n: 2, w: 'ENGRUDO', r: 2, c: K - 1, dir: 'h', clue: 'Pegamento de almidón y agua con que se pegaba el papel de las máscaras.' },
    { n: 3, w: 'CEGUA', r: 4, c: K - 3, dir: 'h', clue: 'Personaje de leyenda que se aparece de noche con cara de yegua.' },
    { n: 4, w: 'MOLDE', r: 6, c: K - 1, dir: 'h', clue: 'Base de barro donde se le da forma a la máscara.' },
    { n: 5, w: 'MANTUDO', r: 0, c: K, dir: 'v', clue: 'Persona que se mete debajo de la mascarada y la hace bailar. Las letras de los candados van aquí.', key: true }
  ];
  const minC = Math.min(...words.map(x => x.c));
  words.forEach(x => x.c -= minC);
  const cols = Math.max(...words.map(x => x.dir === 'h' ? x.c + x.w.length : x.c + 1));
  const rows = Math.max(...words.map(x => x.dir === 'v' ? x.r + x.w.length : x.r + 1));
  const cells = {};
  words.forEach(x => [...x.w].forEach((ch, i) => {
    const r = x.r + (x.dir === 'v' ? i : 0), c = x.c + (x.dir === 'h' ? i : 0), k = `${r},${c}`;
    cells[k] = cells[k] || { ch, words: [] }; cells[k].words.push(x.n);
    if (x.key) cells[k].key = true;
    if (i === 0) cells[k].num = x.n;
  }));
  return { words, cols, rows, cells };
})();

function finalWord() {
  const fill = store.get('escape_xw') || {};
  const revealed = store.get('escape_xwr') || [];
  let dir = 'h';
  const cellsOf = x => [...x.w].map((_, i) => `${x.r + (x.dir === 'v' ? i : 0)},${x.c + (x.dir === 'h' ? i : 0)}`);
  const draw = (msg) => {
    let grid = '';
    for (let r = 0; r < XW.rows; r++) for (let c = 0; c < XW.cols; c++) {
      const k = `${r},${c}`, cell = XW.cells[k];
      grid += cell ? `<div class="xc ${cell.key ? 'key' : ''}">${cell.num ? `<i>${cell.num}</i>` : ''}<input maxlength="1" data-k="${k}" value="${esc(fill[k] || '')}" aria-label="Casilla"></div>` : '<div class="xc empty"></div>';
    }
    $app.innerHTML = header() + `<div class="card"><h2 class="center">El baúl está abierto</h2>
      <p class="center">Dentro del baúl hay un último reto: un crucigrama. Las siete letras que encontraron van en la columna resaltada, pero en otro orden.</p>
      <div class="xwrap"><div class="xgrid" style="grid-template-columns:repeat(${XW.cols},1fr)">${grid}</div>
      <ol class="clues">${XW.words.map(x => `<li value="${x.n}"><b>${x.dir === 'h' ? 'Horizontal' : 'Vertical'}.</b> ${esc(x.clue)} <span class="small">(${x.w.length})</span></li>`).join('')}</ol></div>
      <p class="small center">Letras de los candados: <b>${cfg().letters.join(' ')}</b></p>
      <div id="msg">${msg || ''}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="check">Revisar crucigrama</button><button class="btn ghost" id="hint">Pista: revelar una palabra (+${PEN_HINT} s)</button></div></div>`;
    startClock();
    const inputs = [...$app.querySelectorAll('.xc input')];
    const byK = Object.fromEntries(inputs.map(el => [el.dataset.k, el]));
    inputs.forEach(el => {
      el.onfocus = () => { const ws = XW.cells[el.dataset.k].words; if (ws.length === 1) dir = XW.words.find(x => x.n === ws[0]).dir; };
      el.oninput = () => {
        el.value = el.value.toUpperCase().normalize('NFD').replace(/[^A-ZÑ]/g, '').slice(-1);
        fill[el.dataset.k] = el.value; store.set('escape_xw', fill);
        if (!el.value) return;
        const [r, c] = el.dataset.k.split(',').map(Number);
        const nx = byK[dir === 'h' ? `${r},${c + 1}` : `${r + 1},${c}`];
        if (nx) nx.focus();
      };
      el.onkeydown = e => {
        if (e.key === 'Backspace' && !el.value) {
          const [r, c] = el.dataset.k.split(',').map(Number);
          const pv = byK[dir === 'h' ? `${r},${c - 1}` : `${r - 1},${c}`]; if (pv) pv.focus();
        }
      };
    });
    document.getElementById('hint').onclick = async () => {
      const left = XW.words.filter(x => !revealed.includes(x.n) && !cellsOf(x).every(k => fill[k] === XW.cells[k].ch));
      if (!left.length) return;
      const x = left.find(w => !w.key) || left[0];
      revealed.push(x.n); store.set('escape_xwr', revealed);
      cellsOf(x).forEach(k => fill[k] = XW.cells[k].ch); store.set('escape_xw', fill);
      await addHint(); draw(`<p class="msg info">Se reveló la palabra ${x.n}.</p>`);
    };
    document.getElementById('check').onclick = async () => {
      const ok = XW.words.filter(x => cellsOf(x).every(k => fill[k] === XW.cells[k].ch)).length;
      if (ok === XW.words.length) { await saveTeam({ finished_at: new Date().toISOString() }); return viewWin(); }
      if (Object.keys(XW.cells).some(k => !fill[k])) { document.getElementById('msg').innerHTML = `<p class="msg info">Faltan casillas por llenar. Por ahora hay ${ok} de ${XW.words.length} palabras bien.</p>`; return; }
      await addError(); document.getElementById('msg').innerHTML = `<p class="msg bad">${ok} de ${XW.words.length} palabras están bien.</p>`;
      const n = document.getElementById('errn'); if (n) n.textContent = team.errors;
    };
  };
  draw();
}

function unlocked(i, fact) {
  $app.innerHTML = header() + `<div class="card center"><div class="eyebrow" style="color:var(--terra)">Candado ${i + 1} abierto</div>
    <h2>🔓 Encontraron la letra <span class="frag">«${cfg().letters[i]}»</span></h2><div class="fact" style="text-align:left">${esc(fact)}</div>
    <button class="btn" id="next">${i === NL - 1 ? 'Abrir el baúl' : 'Siguiente candado'}</button></div>`;
  startClock();
  document.getElementById('next').onclick = () => {
    saveTeam({ lock: i + 1 }).then(() => route(true)).catch(err => console.error(err));
  };
}

function viewWin() {
  clearInterval(timer);
  const t = score(team);
  $app.innerHTML = `<section class="hero center"><div class="eyebrow">¡Lo lograron!</div><h1>MANTUDO</h1>
    <p>El mantudo es la persona que se mete debajo de la mascarada y la hace bailar al ritmo de la cimarrona.</p>
    <p><b>${esc(team.name)}</b> · Puntaje final: <b>${fmt(t)}</b> (tiempo + pistas + errores)</p></section>
    <div class="card center"><p>Esperen a que el anfitrión muestre el ranking.</p><button class="btn ghost" id="reset">Salir</button></div>`;
  document.getElementById('reset').onclick = () => {
    resetLocal(); team = null; location.hash = '#/';
  };
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
      return [lock1, lock2, lock3, lock4, lock5, lock6, lock7, finalWord][team.lock]();
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
