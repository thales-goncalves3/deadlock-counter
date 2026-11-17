const test = require('node:test');
const assert = require('node:assert');
const { parseAccountId, analyzeItems, analyzeMatchups, findLiveMatch } = require('../src/analyze');

test('parseAccountId aceita os formatos comuns', () => {
  assert.equal(parseAccountId('52079950'), 52079950);
  assert.equal(parseAccountId('[U:1:52079950]'), 52079950);
  assert.equal(parseAccountId('76561198012345678'), 52079950);
  assert.equal(parseAccountId('https://steamcommunity.com/profiles/76561198012345678/'), 52079950);
  assert.equal(parseAccountId(''), null);
  assert.equal(parseAccountId('abc'), null);
});

test('analyzeItems desconta o efeito do confronto', () => {
  const items = new Map([[1, { id: 1 }], [2, { id: 2 }]]);
  // Contra o herói 10 todo mundo ganha 60% (confronto fácil); contra o 11, 40%.
  // O item 1 ganha 70% contra o 10: é ele que deve aparecer como counter.
  const rows = [
    { item_id: 1, bucket: 10, wins: 7000, matches: 10000 },
    { item_id: 1, bucket: 11, wins: 4000, matches: 10000 },
    { item_id: 2, bucket: 10, wins: 6000, matches: 10000 },
    { item_id: 2, bucket: 11, wins: 4000, matches: 10000 },
    { item_id: 999, bucket: 10, wins: 9000, matches: 10000 }, // fora da loja: ignorado
  ];
  const out = analyzeItems(rows, [10], items);
  assert.deepEqual(out.map((r) => r.itemId), [1, 2]);
  assert.ok(out[0].delta > 0.02, `delta do item 1: ${out[0].delta}`);
  assert.ok(out[1].delta < 0, `delta do item 2: ${out[1].delta}`);
  assert.equal(out[0].best.enemyId, 10);
});

test('analyzeItems ignora itens com poucas partidas', () => {
  const items = new Map([[1, { id: 1 }]]);
  const rows = [{ item_id: 1, bucket: 10, wins: 90, matches: 100 }];
  assert.equal(analyzeItems(rows, [10], items).length, 0);
});

test('analyzeMatchups ordena da maior ameaça para a menor', () => {
  const rows = [
    { hero_id: 1, enemy_hero_id: 2, wins: 60, matches_played: 100 },
    { hero_id: 1, enemy_hero_id: 3, wins: 40, matches_played: 100 },
    { hero_id: 5, enemy_hero_id: 2, wins: 10, matches_played: 100 },
  ];
  const m = analyzeMatchups(rows, 1, [2, 3, 4]);
  assert.equal(m.overall, 0.5);
  assert.deepEqual(m.list.map((x) => x.enemyId), [3, 2, 4]);
  assert.equal(m.list[2].wr, null);
});

test('findLiveMatch separa o time inimigo', () => {
  const matches = [{
    match_id: 9,
    players: [
      { account_id: 1, team: 0, hero_id: 10 },
      { account_id: 2, team: 0, hero_id: 11 },
      { account_id: 3, team: 1, hero_id: 12 },
      { account_id: 4, team: 1, hero_id: 13 },
    ],
  }];
  assert.deepEqual(findLiveMatch(matches, 2), { matchId: 9, heroId: 11, enemyIds: [12, 13] });
  assert.equal(findLiveMatch(matches, 99), null);
});
