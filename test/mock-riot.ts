import http from 'node:http';

/**
 * Tiny stand-in for Riot's API and Data Dragon, with deterministic data.
 *   /ddragon/...        Data Dragon
 *   /riot/{host}/...    Riot API (host = platform or regional route)
 *
 * Match ids: EUW1_1000-1011 solo, EUW1_2000-2001 flex, EUW1_3000 remake,
 * EUW1_4000 normal game (queue 400), EUW1_5000-5002 solo (used by the crawl test).
 * In every match P0 plays Ahri mid on team 100 against Zed mid on team 200; team 100 wins when the id is even.
 */
const TEAM100 = [['P1', 'TOP', 86], ['P2', 'JUNGLE', 11], ['P0', 'MIDDLE', 103], ['P3', 'BOTTOM', 222], ['P4', 'UTILITY', 99]] as const;
const TEAM200 = [['P5', 'TOP', 24], ['P6', 'JUNGLE', 64], ['P7', 'MIDDLE', 238], ['P8', 'BOTTOM', 51], ['P9', 'UTILITY', 12]] as const;

const CHAMPS = [
  { key: '103', id: 'Ahri', name: 'Ahri', tags: ['Mage', 'Assassin'] },
  { key: '86', id: 'Garen', name: 'Garen', tags: ['Fighter', 'Tank'] },
  { key: '238', id: 'Zed', name: 'Zed', tags: ['Assassin'] },
  { key: '99', id: 'Lux', name: 'Lux', tags: ['Mage', 'Support'] },
  { key: '222', id: 'Jinx', name: 'Jinx', tags: ['Marksman'] },
];

const ITEMS = {
  data: {
    '1055': { name: "Doran's Blade", tags: ['Lane'], into: [], gold: { total: 450, purchasable: true } },
    '2003': { name: 'Health Potion', tags: ['Consumable'], gold: { total: 50, purchasable: true } },
    '3006': { name: "Berserker's Greaves", tags: ['Boots'], into: [], gold: { total: 1100, purchasable: true } },
    '3020': { name: "Sorcerer's Shoes", tags: ['Boots'], into: [], gold: { total: 1100, purchasable: true } },
    '3089': { name: "Rabadon's Deathcap", tags: ['SpellDamage'], into: [], gold: { total: 3600, purchasable: true } },
    '3157': { name: "Zhonya's Hourglass", tags: ['SpellDamage'], into: [], gold: { total: 3250, purchasable: true } },
    '6655': { name: "Luden's Echo", tags: ['SpellDamage'], into: [], gold: { total: 3000, purchasable: true } },
    '3340': { name: 'Stealth Ward', tags: ['Trinket'], into: [], gold: { total: 0, purchasable: true } },
  },
};

const perks = () => ({
  statPerks: { offense: 5008, flex: 5008, defense: 5002 },
  styles: [
    { description: 'primaryStyle', style: 8100, selections: [{ perk: 8112 }, { perk: 8126 }, { perk: 8138 }, { perk: 8135 }] },
    { description: 'subStyle', style: 8200, selections: [{ perk: 8226 }, { perk: 8237 }] },
  ],
});

function buildMatch(num: number) {
  const queueId = num === 4000 ? 400 : num >= 2000 && num < 3000 ? 440 : 420;
  const win100 = num % 2 === 0;
  const mk = (team: readonly (readonly [string, string, number])[], teamId: number, win: boolean) =>
    team.map(([puuid, pos, championId]) => ({
      puuid, riotIdGameName: puuid === 'P0' ? 'Tester' : `Player${puuid}`, riotIdTagline: 'EUW',
      championId, teamId, teamPosition: pos, win,
      kills: 5, deaths: 2, assists: 7, totalMinionsKilled: 180, neutralMinionsKilled: 10,
      goldEarned: 12000, totalDamageDealtToChampions: 22000, visionScore: 25, champLevel: 16,
      item0: 3020, item1: 6655, item2: 3089, item3: 3157, item4: 1055, item5: 2003, item6: 3340,
      summoner1Id: 4, summoner2Id: 14, perks: perks(),
    }));
  return {
    metadata: { matchId: `EUW1_${num}`, participants: [...TEAM100, ...TEAM200].map((p) => p[0]) },
    info: {
      queueId,
      gameVersion: '15.21.612.4321',
      gameCreation: 1_700_000_000_000 + num * 3_600_000,
      gameDuration: num === 3000 ? 120 : 1800 + (num % 50),
      participants: [...mk(TEAM100, 100, win100), ...mk(TEAM200, 200, !win100)],
      teams: [
        { teamId: 100, win: win100, bans: [{ championId: 238, pickTurn: 1 }, { championId: -1, pickTurn: 2 }] },
        { teamId: 200, win: !win100, bans: [{ championId: 238, pickTurn: 6 }, { championId: 91, pickTurn: 7 }] },
      ],
    },
  };
}

function buildTimeline() {
  // P0 is participant 3. Q reaches 5 points first, then E, then W -> "Q>E>W".
  const slots = [1, 2, 3, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2];
  const events: unknown[] = [
    { type: 'ITEM_PURCHASED', timestamp: 1000, participantId: 3, itemId: 2003 },
    { type: 'ITEM_PURCHASED', timestamp: 1200, participantId: 3, itemId: 1055 },
    { type: 'ITEM_PURCHASED', timestamp: 1300, participantId: 3, itemId: 3340 },
    { type: 'ITEM_UNDO', timestamp: 1400, participantId: 3, beforeId: 3340, afterId: 0 },
    { type: 'ITEM_PURCHASED', timestamp: 400_000, participantId: 3, itemId: 3020 },
    { type: 'ITEM_PURCHASED', timestamp: 1000, participantId: 4, itemId: 9999 }, // another player, ignored
    ...slots.map((s, i) => ({ type: 'SKILL_LEVEL_UP', timestamp: 60_000 + i * 1000, participantId: 3, skillSlot: s, levelUpType: 'NORMAL' })),
  ];
  return {
    metadata: { participants: [...TEAM100, ...TEAM200].map((p) => p[0]) },
    info: { frames: [{ events }] },
  };
}

export function startMock(port: number): Promise<http.Server> {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const path = url.pathname;
    calls.push(path);

    // ---- Data Dragon ----
    if (path === '/ddragon/api/versions.json') return send(200, ['15.21.1', '15.20.1']);
    if (path === '/ddragon/cdn/15.21.1/data/en_US/champion.json') {
      return send(200, { data: Object.fromEntries(CHAMPS.map((c) => [c.id, { id: c.id, key: c.key, name: c.name }])) });
    }
    let m = path.match(/^\/ddragon\/cdn\/15\.21\.1\/data\/en_US\/champion\/(\w+)\.json$/);
    if (m) {
      const c = CHAMPS.find((x) => x.id === m![1]);
      if (!c) return send(404, {});
      return send(200, {
        data: {
          [c.id]: {
            ...c, title: `the ${c.name}`, blurb: 'blurb', lore: 'lore', partype: 'Mana',
            info: { attack: 3, defense: 4, magic: 5, difficulty: 6 }, stats: { hp: 600 },
            spells: [{ id: `${c.id}Q` }], passive: { name: 'Passive' }, skins: [{ num: 0 }],
            image: { full: `${c.id}.png` },
          },
        },
      });
    }
    if (path === '/ddragon/cdn/15.21.1/data/en_US/item.json') return send(200, ITEMS);
    if (path === '/ddragon/cdn/15.21.1/data/en_US/runesReforged.json') return send(200, [{ id: 8100, key: 'Domination' }]);
    if (path === '/ddragon/cdn/15.21.1/data/en_US/summoner.json') return send(200, { data: { SummonerFlash: { key: '4' } } });

    // ---- Riot ----
    if (path === '/__calls') return send(200, calls);
    m = path.match(/^\/riot\/([a-z0-9]+)(\/.*)$/);
    if (!m) return send(404, {});
    const rest = m[2];

    if (rest === '/riot/account/v1/accounts/by-riot-id/Tester/EUW') return send(200, { puuid: 'P0', gameName: 'Tester', tagLine: 'EUW' });
    if (rest.startsWith('/riot/account/v1/accounts/by-riot-id/')) return send(404, { status: { status_code: 404 } });
    if (rest === '/lol/summoner/v4/summoners/by-puuid/P0') return send(200, { puuid: 'P0', profileIconId: 29, summonerLevel: 321 });
    if (rest === '/lol/league/v4/entries/by-puuid/P0') {
      return send(200, [
        { queueType: 'RANKED_SOLO_5x5', tier: 'EMERALD', rank: 'II', leaguePoints: 55, wins: 60, losses: 40 },
        { queueType: 'RANKED_TFT', tier: 'GOLD', rank: 'I', leaguePoints: 10, wins: 1, losses: 1 },
      ]);
    }
    if (rest === '/lol/match/v5/matches/by-puuid/P0/ids') {
      const q = url.searchParams.get('queue');
      if (q === '420') return send(200, [...Array.from({ length: 12 }, (_, i) => `EUW1_${1000 + i}`), 'EUW1_3000']);
      if (q === '440') return send(200, ['EUW1_2000', 'EUW1_2001']);
    }
    if (rest === '/lol/match/v5/matches/by-puuid/P1/ids') return send(200, ['EUW1_5000', 'EUW1_5001', 'EUW1_5002']);

    if (rest === '/lol/league/v4/entries/RANKED_SOLO_5x5/GOLD/I') {
      return send(200, url.searchParams.get('page') === '1' ? [{ puuid: 'P1', tier: 'GOLD', rank: 'I' }] : []);
    }

    m = rest.match(/^\/lol\/match\/v5\/matches\/EUW1_(\d+)(\/timeline)?$/);
    if (m) {
      const num = Number(m[1]);
      const known = (num >= 1000 && num <= 1011) || num === 2000 || num === 2001 || num === 3000 || num === 4000 || (num >= 5000 && num <= 5002);
      if (!known) return send(404, {});
      return send(200, m[2] ? buildTimeline() : buildMatch(num));
    }
    return send(404, {});
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
