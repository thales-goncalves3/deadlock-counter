// Cálculos puros (sem Electron), para poder testar com `npm test`.

// Converte o que o usuário digitar em SteamID3 (account_id da API).
// Aceita: 12345678, [U:1:12345678], 7656119..., ou a URL do perfil /profiles/7656119...
const STEAM64_BASE = 76561197960265728n;
function parseAccountId(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const u = s.match(/\[?U:1:(\d+)\]?/i);
  if (u) return Number(u[1]);
  const digits = s.match(/(\d{5,20})/);
  if (!digits) return null;
  const n = BigInt(digits[1]);
  if (n > STEAM64_BASE) return Number(n - STEAM64_BASE);
  return n > 0n && n < 2n ** 32n ? Number(n) : null;
}

// rows: resposta de /v1/analytics/item-stats?hero_id=X&bucket=enemy_hero
//   cada linha = item × herói inimigo (bucket = id do inimigo).
// A média do item (baseline) é a soma de todas as linhas dele: cada partida entra
// uma vez por inimigo, então a proporção de vitórias fica igual à geral.
// Para cada inimigo escolhido: taxa de vitória do item contra ele, "encolhida" para a
// média do item com `prior` partidas fictícias (evita item raro com 70% por sorte).
// Desconta o efeito do confronto: se meu herói já ganha 54% contra o Mirage, todo item
// parece bom contra ele. Esse efeito (taxa contra o inimigo − taxa geral, somando todos
// os itens) sai da conta, e sobra só o quanto o item ajuda além do esperado.
// Pontuação = média simples dos ganhos contra cada inimigo, em pontos percentuais.
function analyzeItems(rows, enemyIds, itemsById, opts = {}) {
  const { prior = 800, minMatches = 500, limit = 10 } = opts;
  const enemies = new Set(enemyIds);
  const agg = new Map();
  const tot = { w: 0, m: 0 };
  const byEnemy = new Map();
  for (const r of rows) {
    if (!itemsById.has(r.item_id)) continue; // só itens da loja (ignora habilidades e itens que saíram)
    let a = agg.get(r.item_id);
    if (!a) agg.set(r.item_id, (a = { w: 0, m: 0, per: new Map() }));
    a.w += r.wins;
    a.m += r.matches;
    tot.w += r.wins;
    tot.m += r.matches;
    if (enemies.has(r.bucket)) {
      a.per.set(r.bucket, { w: r.wins, m: r.matches });
      const e = byEnemy.get(r.bucket) || { w: 0, m: 0 };
      e.w += r.wins;
      e.m += r.matches;
      byEnemy.set(r.bucket, e);
    }
  }
  const totWr = tot.m ? tot.w / tot.m : 0;
  const effect = new Map();
  for (const e of enemies) {
    const x = byEnemy.get(e);
    effect.set(e, x && x.m ? x.w / x.m - totWr : 0);
  }

  const out = [];
  for (const [itemId, a] of agg) {
    const item = itemsById.get(itemId);
    if (!item || !a.m) continue;
    const baseWr = a.w / a.m;
    let vsMatches = 0;
    const per = [];
    for (const e of enemies) {
      const p = a.per.get(e) || { w: 0, m: 0 };
      vsMatches += p.m;
      const expected = baseWr + effect.get(e);
      const wr = (p.w + prior * expected) / (p.m + prior);
      per.push({ enemyId: e, delta: wr - expected, matches: p.m });
    }
    if (vsMatches < minMatches) continue;
    const delta = per.reduce((s, p) => s + p.delta, 0) / per.length;
    per.sort((x, y) => y.delta - x.delta);
    out.push({
      itemId,
      delta,
      baseWr,
      matches: vsMatches,
      best: per[0] && per[0].delta > 0 ? per[0] : null,
    });
  }
  out.sort((x, y) => y.delta - x.delta);
  return out.slice(0, limit);
}

// rows: resposta de /v1/analytics/hero-counter-stats (todas as duplas herói × inimigo).
// Devolve meu herói contra cada inimigo, da maior ameaça (pior taxa) para a menor.
function analyzeMatchups(rows, heroId, enemyIds) {
  let w = 0, m = 0;
  const vs = new Map();
  for (const r of rows) {
    if (r.hero_id !== heroId) continue;
    w += r.wins;
    m += r.matches_played;
    vs.set(r.enemy_hero_id, r);
  }
  const overall = m ? w / m : null;
  const list = enemyIds.map((e) => {
    const r = vs.get(e);
    if (!r || !r.matches_played) return { enemyId: e, wr: null, delta: null, matches: 0 };
    const wr = r.wins / r.matches_played;
    return { enemyId: e, wr, delta: overall == null ? null : wr - overall, matches: r.matches_played };
  });
  list.sort((x, y) => (x.wr ?? 1) - (y.wr ?? 1));
  return { overall, list };
}

// Resposta de /v1/matches/active: acha a partida da conta e separa os times.
function findLiveMatch(matches, accountId) {
  for (const match of matches || []) {
    const me = (match.players || []).find((p) => p.account_id === accountId);
    if (!me) continue;
    const enemies = match.players.filter((p) => p.team !== me.team).map((p) => p.hero_id);
    return { matchId: match.match_id, heroId: me.hero_id, enemyIds: enemies };
  }
  return null;
}

module.exports = { parseAccountId, analyzeItems, analyzeMatchups, findLiveMatch };
