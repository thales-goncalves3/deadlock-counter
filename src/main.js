const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parseAccountId, analyzeItems, analyzeMatchups, findLiveMatch } = require('./analyze');

const API = 'https://api.deadlock-api.com';
const HOUR = 3600e3;
const KEYS = { mode: 'Control+Shift+D', hide: 'Control+Shift+H' };
const SIZE = { edit: { width: 780, height: 680 }, view: { width: 360, height: 560 } };

let win = null;
let mode = 'edit';

// ---------- configuração ----------
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
let cfg = { accountId: null, minBadge: 0, pos: {} };
function loadCfg() {
  try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgPath(), 'utf8')) }; } catch {}
}
function saveCfg() {
  fs.mkdirSync(path.dirname(cfgPath()), { recursive: true });
  fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2));
}

// ---------- API com cache em disco ----------
// Chamadas iguais ao mesmo tempo (pré-busca + cálculo) dividem a mesma requisição.
const inflight = new Map();
function getJson(pathAndQuery, ttlMs) {
  if (!inflight.has(pathAndQuery)) {
    inflight.set(pathAndQuery, fetchJson(pathAndQuery, ttlMs).finally(() => inflight.delete(pathAndQuery)));
  }
  return inflight.get(pathAndQuery);
}

async function fetchJson(pathAndQuery, ttlMs) {
  const url = API + pathAndQuery;
  const file = path.join(app.getPath('userData'), 'cache',
    crypto.createHash('sha1').update(url).digest('hex') + '.json');
  const cached = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  if (ttlMs) {
    try { if (Date.now() - fs.statSync(file).mtimeMs < ttlMs) return cached(); } catch {}
  }
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': 'deadlock-counter-overlay/0.1' } });
  } catch (e) {
    if (ttlMs && fs.existsSync(file)) return cached(); // sem internet: usa o cache vencido
    throw new Error('Sem conexão com a deadlock-api');
  }
  if (!res.ok) {
    if (ttlMs && fs.existsSync(file)) return cached();
    throw new Error(`deadlock-api respondeu ${res.status} em ${pathAndQuery.split('?')[0]}`);
  }
  const json = await res.json();
  if (ttlMs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(json));
  }
  return json;
}

let assetsPromise = null;
function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const [heroes, items, ranks] = await Promise.all([
        getJson('/v1/assets/heroes?only_active=true', 24 * HOUR),
        getJson('/v1/assets/items/by-type/upgrade', 24 * HOUR),
        getJson('/v1/assets/ranks', 24 * HOUR),
      ]);
      return {
        heroes: heroes
          .filter((h) => h.player_selectable && !h.disabled && !h.in_development)
          .map((h) => ({ id: h.id, name: h.name, img: h.images.icon_image_small_webp || h.images.icon_image_small }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        items: items
          .filter((i) => i.shopable)
          .map((i) => ({
            id: i.id, name: i.name, tier: i.item_tier, slot: i.item_slot_type,
            cost: i.cost, active: !!i.is_active_item, img: i.shop_image_webp || i.shop_image || i.image,
          })),
        ranks: ranks.filter((r) => r.tier > 0).map((r) => ({ tier: r.tier, name: r.name })),
      };
    })().catch((e) => { assetsPromise = null; throw e; });
  }
  return assetsPromise;
}

function badgeQuery() {
  return cfg.minBadge ? `&min_average_badge=${cfg.minBadge * 10 + 1}` : '';
}

const itemStats = (heroId) =>
  getJson(`/v1/analytics/item-stats?hero_id=${Number(heroId)}&bucket=enemy_hero&min_matches=20${badgeQuery()}`, HOUR);

async function analyze({ heroId, enemyIds }) {
  const assets = await loadAssets();
  const itemsById = new Map(assets.items.map((i) => [i.id, i]));
  const [itemRows, counterRows] = await Promise.all([
    itemStats(heroId),
    getJson(`/v1/analytics/hero-counter-stats?min_matches=20${badgeQuery()}`, 6 * HOUR),
  ]);
  return {
    items: analyzeItems(itemRows, enemyIds, itemsById),
    matchups: analyzeMatchups(counterRows, heroId, enemyIds),
  };
}

async function detect() {
  if (!cfg.accountId) return { error: 'Configure seu SteamID para detectar a partida.' };
  const matches = await getJson(`/v1/matches/active?account_id=${cfg.accountId}`, 0);
  const live = findLiveMatch(matches, cfg.accountId);
  return live || { error: 'Partida não encontrada (a API só enxerga as 200 partidas do topo). Escolha os heróis à mão.' };
}

// ---------- janela ----------
function applyMode(next) {
  if (!win) return;
  const b = win.getBounds();
  cfg.pos[mode] = { x: b.x, y: b.y };
  mode = next;
  const size = SIZE[mode];
  const wa = screen.getPrimaryDisplay().workArea;
  const p = cfg.pos[mode] || (mode === 'view'
    ? { x: wa.x + wa.width - size.width - 16, y: wa.y + 120 }
    : { x: wa.x + Math.round((wa.width - size.width) / 2), y: wa.y + Math.round((wa.height - size.height) / 2) });
  win.setBounds({ ...p, ...size });
  if (mode === 'view') {
    // Modo jogo: os cliques passam para o jogo e a janela não rouba o foco.
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setFocusable(false);
    win.blur();
  } else {
    win.setIgnoreMouseEvents(false);
    win.setFocusable(true);
    win.focus();
  }
  win.setAlwaysOnTop(true, 'screen-saver');
  win.webContents.send('mode', mode);
  saveCfg();
}

function createWindow() {
  win = new BrowserWindow({
    ...SIZE.edit,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    show: false,
    title: 'Deadlock Counter',
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { applyMode('edit'); win.show(); });
  if (process.env.DC_SHOT) devShot(process.env.DC_SHOT);
  win.on('close', () => {
    const b = win.getBounds();
    cfg.pos[mode] = { x: b.x, y: b.y };
    saveCfg();
  });
}

// Só para desenvolvimento: DC_SHOT=pasta DC_PICKS="1:7,13,19" npm start
// escolhe os heróis, salva um PNG de cada modo na pasta e fecha.
function devShot(dir) {
  const [me, en] = (process.env.DC_PICKS || '1:7,13,19,31,35,52').split(':');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  win.webContents.once('did-finish-load', async () => {
    await wait(2500);
    await win.webContents.executeJavaScript(
      `state.me=${Number(me)};state.enemies=[${en.split(',').map(Number)}];state.target='enemy';changed();`);
    await wait(4000);
    fs.writeFileSync(path.join(dir, 'edit.png'), (await win.webContents.capturePage()).toPNG());
    applyMode('view');
    await wait(1200);
    fs.writeFileSync(path.join(dir, 'view.png'), (await win.webContents.capturePage()).toPNG());
    app.quit();
  });
}

const handle = (name, fn) => ipcMain.handle(name, async (_e, arg) => {
  try { return { ok: true, data: await fn(arg) }; } catch (e) { return { ok: false, error: e.message }; }
});

app.whenReady().then(() => {
  loadCfg();
  handle('assets', loadAssets);
  handle('analyze', analyze);
  handle('prefetch', async (heroId) => { await itemStats(heroId); });
  handle('detect', detect);
  handle('cfg:get', () => ({ ...cfg, keys: KEYS }));
  handle('cfg:set', (patch) => {
    if ('accountId' in patch) {
      const id = parseAccountId(patch.accountId);
      if (patch.accountId && !id) throw new Error('SteamID inválido');
      cfg.accountId = id;
    }
    if ('minBadge' in patch) cfg.minBadge = Number(patch.minBadge) || 0;
    saveCfg();
    return { ...cfg, keys: KEYS };
  });
  handle('mode', (m) => applyMode(m === 'view' ? 'view' : 'edit'));
  handle('quit', () => app.quit());

  createWindow();
  globalShortcut.register(KEYS.mode, () => applyMode(mode === 'edit' ? 'view' : 'edit'));
  globalShortcut.register(KEYS.hide, () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else { win.showInactive(); win.setAlwaysOnTop(true, 'screen-saver'); }
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
