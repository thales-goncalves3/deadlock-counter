const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const img = (src, cls) => {
  const i = el('img', cls);
  i.src = src || '';
  i.alt = '';
  i.draggable = false;
  return i;
};
const pp = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

const MAX_ENEMIES = 6;
const state = {
  heroes: [], heroById: new Map(), itemById: new Map(), ranks: [],
  me: null, enemies: [], target: 'me', search: '', cfg: null, seq: 0,
};

// ---------- seleção ----------
function save() {
  localStorage.setItem('picks', JSON.stringify({ me: state.me, enemies: state.enemies }));
}
function restore() {
  try {
    const p = JSON.parse(localStorage.getItem('picks') || '{}');
    if (state.heroById.has(p.me)) state.me = p.me;
    state.enemies = (p.enemies || []).filter((id) => state.heroById.has(id)).slice(0, MAX_ENEMIES);
  } catch {}
}

function pickHero(id) {
  if (state.target === 'me') {
    state.me = id;
    state.enemies = state.enemies.filter((e) => e !== id);
    state.target = 'enemy';
  } else if (state.enemies.includes(id)) {
    state.enemies = state.enemies.filter((e) => e !== id);
  } else if (id !== state.me && state.enemies.length < MAX_ENEMIES) {
    state.enemies.push(id);
  }
  changed();
}

function changed() {
  save();
  renderPicks();
  renderGrid();
  refresh();
}

// ---------- render ----------
function heroSlot(id, cls, onClick) {
  const s = el('div', `slot ${cls}${id ? ' filled' : ''}`);
  if (id) {
    const h = state.heroById.get(id);
    s.append(img(h.img));
    s.title = h.name;
  }
  if (onClick) s.onclick = onClick;
  return s;
}

function renderPicks() {
  const me = $('#slot-me');
  me.replaceChildren(heroSlot(state.me, `me${state.target === 'me' ? ' active' : ''}`, () => {
    state.target = 'me';
    renderPicks(); renderGrid();
  }));
  const en = $('#slot-enemies');
  en.replaceChildren();
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const id = state.enemies[i];
    en.append(heroSlot(id, `enemy${!id && state.target === 'enemy' && i === state.enemies.length ? ' active' : ''}`,
      () => {
        if (id) { state.enemies.splice(i, 1); changed(); return; }
        state.target = 'enemy'; renderPicks(); renderGrid();
      }));
  }
  $('#enemy-count').textContent = `${state.enemies.length}/${MAX_ENEMIES}`;
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.target === state.target));
}

function renderGrid() {
  const q = state.search.trim().toLowerCase();
  const grid = $('#grid');
  grid.replaceChildren();
  for (const h of state.heroes) {
    if (q && !h.name.toLowerCase().includes(q)) continue;
    const cls = h.id === state.me ? ' me' : state.enemies.includes(h.id) ? ' enemy' : '';
    const d = el('div', `hero${cls}`);
    d.title = h.name;
    d.append(img(h.img), el('span', null, h.name));
    d.onclick = () => pickHero(h.id);
    grid.append(d);
  }
}

function setStatus(msg, err = false) {
  const s = $('#status');
  s.textContent = msg || '';
  s.classList.toggle('err', err);
}

function renderResults(res) {
  const items = $('#items');
  items.replaceChildren();
  for (const r of res.items) {
    const it = state.itemById.get(r.itemId);
    const li = el('li');
    const ic = el('div', `item-ic ${it.slot}`);
    ic.append(img(it.img));
    const mid = el('div');
    const name = el('div', 'item-name', it.name);
    name.title = `${it.name} · T${it.tier} · ${it.cost} almas\nMédia do item: ${pct(r.baseWr)} · ${r.matches.toLocaleString('pt-BR')} partidas contra esses heróis`;
    const sub = el('div', 'item-sub', `T${it.tier} · ${it.cost.toLocaleString('pt-BR')}`);
    if (r.best) {
      const h = state.heroById.get(r.best.enemyId);
      sub.append(document.createTextNode(' · melhor vs'), img(h.img, 'mini'));
      sub.title = `${h.name}: ${pp(r.best.delta)} pp`;
    }
    mid.append(name, sub);
    li.append(ic, mid, el('div', `delta ${r.delta >= 0 ? 'pos' : 'neg'}`, pp(r.delta)));
    items.append(li);
  }
  if (!res.items.length) items.append(el('li', 'mut', 'Poucos dados para essa combinação.'));

  const mu = $('#matchups');
  mu.replaceChildren();
  const { overall, list } = res.matchups;
  $('#overall').textContent = overall == null ? '' : `geral do herói ${pct(overall)}`;
  for (const m of list) {
    const h = state.heroById.get(m.enemyId);
    const li = el('li');
    li.title = m.matches ? `${m.matches.toLocaleString('pt-BR')} partidas` : 'sem dados';
    const bar = el('div', 'wrbar');
    const fill = el('i');
    if (m.wr != null) {
      fill.style.width = `${Math.max(0, Math.min(1, m.wr)) * 100}%`;
      fill.style.background = m.wr >= 0.5 ? 'var(--good)' : 'var(--bad)';
    }
    bar.append(fill);
    li.append(img(h.img), el('div', 'item-name', h.name), bar,
      el('div', `wr ${m.delta == null ? '' : m.delta >= 0 ? 'pos' : 'neg'}`, m.wr == null ? '—' : pct(m.wr)));
    mu.append(li);
  }
}

// ---------- dados ----------
async function refresh() {
  const seq = ++state.seq;
  if (state.me) window.dc.prefetch(state.me).catch(() => {}); // adianta a consulta lenta
  if (!state.me || !state.enemies.length) {
    $('#items').replaceChildren(); $('#matchups').replaceChildren(); $('#overall').textContent = '';
    setStatus(state.me ? 'Escolha os inimigos.' : 'Escolha seu herói e os inimigos.');
    return;
  }
  setStatus('Calculando… (a 1ª vez de cada herói leva uns 5 s)');
  document.body.classList.add('loading');
  try {
    const res = await window.dc.analyze({ heroId: state.me, enemyIds: state.enemies });
    if (seq !== state.seq) return;
    const me = state.heroById.get(state.me).name;
    setStatus(`${me}: itens que ganham mais que a média contra esse time (pontos percentuais).`);
    renderResults(res);
  } catch (e) {
    if (seq === state.seq) setStatus(e.message, true);
  } finally {
    if (seq === state.seq) document.body.classList.remove('loading');
  }
}

async function detect() {
  setStatus('Procurando sua partida…');
  try {
    const r = await window.dc.detect();
    if (r.error) { setStatus(r.error, true); return; }
    state.me = r.heroId;
    state.enemies = r.enemyIds.filter((id) => state.heroById.has(id)).slice(0, MAX_ENEMIES);
    state.target = 'enemy';
    changed();
  } catch (e) {
    setStatus(e.message, true);
  }
}

// ---------- configurações ----------
function fillCfg() {
  const c = state.cfg;
  $('#cfg-account').value = c.accountId || '';
  const sel = $('#cfg-badge');
  sel.replaceChildren(new Option('Todos', 0), ...state.ranks.map((r) => new Option(`${r.name}+`, r.tier)));
  sel.value = String(c.minBadge || 0);
  $('#hint').textContent = `${c.keys.mode.replace('Control', 'Ctrl')} jogo/editar · ${c.keys.hide.replace('Control', 'Ctrl')} esconder`;
  $('#foot').textContent = state.cfg.minBadge
    ? `rank ${state.ranks.find((r) => r.tier === state.cfg.minBadge)?.name || ''}+` : 'todos os ranks';
}

async function saveCfg() {
  try {
    state.cfg = await window.dc.setCfg({ accountId: $('#cfg-account').value, minBadge: $('#cfg-badge').value });
    fillCfg();
    $('#cfg-msg').textContent = 'Salvo.';
    refresh();
  } catch (e) {
    $('#cfg-msg').textContent = e.message;
  }
}

// ---------- início ----------
async function init() {
  window.dc.onMode((m) => {
    document.body.className = m;
    if (m === 'edit') $('#search').focus();
  });
  $('#btn-view').onclick = () => window.dc.setMode('view');
  $('#btn-quit').onclick = () => window.dc.quit();
  $('#btn-clear').onclick = () => { state.me = null; state.enemies = []; state.target = 'me'; changed(); };
  $('#btn-detect').onclick = detect;
  $('#btn-cfg').onclick = () => { $('#cfg').hidden = !$('#cfg').hidden; $('#cfg-msg').textContent = ''; };
  $('#cfg-save').onclick = saveCfg;
  document.querySelectorAll('.seg button').forEach((b) => {
    b.onclick = () => { state.target = b.dataset.target; renderPicks(); renderGrid(); };
  });
  $('#search').oninput = (e) => { state.search = e.target.value; renderGrid(); };
  $('#search').onkeydown = (e) => {
    if (e.key === 'Enter') {
      const first = $('#grid .hero');
      if (first) { first.click(); e.target.value = ''; state.search = ''; renderGrid(); }
    }
    if (e.key === 'Escape') { e.target.value = ''; state.search = ''; renderGrid(); }
  };

  setStatus('Carregando heróis e itens…');
  try {
    const [assets, cfg] = await Promise.all([window.dc.assets(), window.dc.getCfg()]);
    state.heroes = assets.heroes;
    state.heroById = new Map(assets.heroes.map((h) => [h.id, h]));
    state.itemById = new Map(assets.items.map((i) => [i.id, i]));
    state.ranks = assets.ranks;
    state.cfg = cfg;
  } catch (e) {
    setStatus(`Não deu para carregar: ${e.message}`, true);
    return;
  }
  fillCfg();
  restore();
  if (state.me) state.target = 'enemy';
  renderPicks();
  renderGrid();
  refresh();
  if (state.cfg.accountId) detect();
}

init();
