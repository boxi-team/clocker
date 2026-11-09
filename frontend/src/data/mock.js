// MOCK DATA — replace via services/riotService.js, not here.
export const REGIONS = ['EUW', 'NA', 'EUNE', 'KR', 'BR', 'LAN', 'OCE', 'TR'];

export const META = [
  { champ: 'Aatrox', role: 'Top', wr: 51.2 }, { champ: 'Lee Sin', role: 'Jungle', wr: 49.8 },
  { champ: 'Ahri', role: 'Mid', wr: 52.1 }, { champ: "Kai'Sa", role: 'ADC', wr: 51.6 },
  { champ: 'Thresh', role: 'Support', wr: 50.4 }, { champ: 'Viego', role: 'Jungle', wr: 50.9 },
  { champ: 'Ornn', role: 'Top', wr: 52.4 }, { champ: 'Orianna', role: 'Mid', wr: 51.0 },
];

export const PLAYER = {
  puuid: 'mock-puuid-1', name: 'NeonSage', tag: 'EUW', region: 'EUW', level: 412,
  ranks: {
    solo: { tier: 'Diamond', div: 'II', lp: 67, wins: 142, losses: 121 },
    flex: { tier: 'Platinum', div: 'I', lp: 23, wins: 38, losses: 30 },
  },
  topChamps: [
    { champ: 'Ahri', games: 61, kda: 4.2, csMin: 8.1 },
    { champ: 'Orianna', games: 44, kda: 3.6, csMin: 8.4 },
    { champ: 'Viego', games: 29, kda: 3.1, csMin: 6.7 },
  ],
};

export const MATCHES = [
  { id: 'EUW1_1', win: true, mode: 'Ranked Solo', ago: '2 hours ago', mins: 31, champ: 'Ahri',
    spells: ['Flash', 'Ignite'], rune: 'Electrocute', k: 9, d: 2, a: 11, cs: 248, vision: 24, wards: 4,
    items: ["Luden's Companion", "Sorcerer's Shoes", 'Shadowflame', "Rabadon's Deathcap", "Zhonya's Hourglass", 'Void Staff'], trinket: 'Stealth Ward' },
  { id: 'EUW1_2', win: false, mode: 'Ranked Solo', ago: '5 hours ago', mins: 27, champ: 'Orianna',
    spells: ['Flash', 'Barrier'], rune: 'Arcane Comet', k: 3, d: 7, a: 6, cs: 201, vision: 18, wards: 2,
    items: ["Liandry's Torment", "Sorcerer's Shoes", "Rabadon's Deathcap", null, null, null], trinket: 'Stealth Ward' },
  { id: 'EUW1_3', win: true, mode: 'ARAM', ago: 'Yesterday', mins: 19, champ: 'Viego',
    spells: ['Mark', 'Flash'], rune: 'Conqueror', k: 14, d: 8, a: 17, cs: 96, vision: 0, wards: 0,
    items: ['Kraken Slayer', "Death's Dance", 'Guardian Angel', 'Bloodthirster', null, null], trinket: 'Stealth Ward' },
];

// No backend endpoint yet for these two (see riotService.js)
export const TOP_PLAYERS = [
  { name: 'Lucaaaa', lp: 2167, wr: 86.7 }, { name: 'Kaede', lp: 1790, wr: 58.9 },
  { name: 'MistFox', lp: 1755, wr: 60.4 }, { name: 'Nocturne9', lp: 1731, wr: 57.7 },
  { name: 'HexaBlade', lp: 1698, wr: 59.1 }, { name: 'Zephyr', lp: 1664, wr: 56.8 },
  { name: 'IronLotus', lp: 1640, wr: 58.2 }, { name: 'Vanta', lp: 1611, wr: 55.9 },
  { name: 'Solace', lp: 1587, wr: 57.0 }, { name: 'Quill', lp: 1562, wr: 56.3 },
];

export const LIVE_GAMES = [
  { id: 'L1', player: 'MistFox', champ: 'Ahri', mode: 'Ranked Solo', mins: 14 },
  { id: 'L2', player: 'Ryuu', champ: 'Viego', mode: 'Ranked Solo', mins: 22 },
  { id: 'L3', player: 'Kaede', champ: "Kai'Sa", mode: 'Ranked Flex', mins: 9 },
  { id: 'L4', player: 'Vanta', champ: 'Ornn', mode: 'Ranked Solo', mins: 31 },
  { id: 'L5', player: 'Quill', champ: 'Thresh', mode: 'Ranked Solo', mins: 4 },
  { id: 'L6', player: 'Zephyr', champ: 'Orianna', mode: 'Ranked Solo', mins: 18 },
];