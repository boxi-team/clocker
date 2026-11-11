export const TIERS = ['master_plus', 'diamond_plus', 'emerald_plus', 'all', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'];
export const ROLES = ['top', 'jungle', 'mid', 'adc', 'support'];
export const QUEUES = ['ranked_solo', 'ranked_flex'];
export const REGIONS = ['br1', 'eun1', 'euw1', 'jp1', 'kr', 'la1', 'la2', 'me1', 'na1', 'oc1', 'ph2', 'ru', 'sg2', 'th2', 'tr1', 'tw2', 'vn2'];
export const TAGS = ['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'];
export const DEFAULTS = { patch: 'latest', tier: 'master_plus', queue: 'ranked_solo', region: 'all' };

// Regions offered in the search box: UI code -> backend platform code
export const SEARCH_REGIONS = { EUW: 'euw1', NA: 'na1', EUNE: 'eun1', KR: 'kr', BR: 'br1', LAN: 'la1', OCE: 'oc1', TR: 'tr1' };

export const ROLE_LABEL = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Support' };
export const QUEUE_LABEL = { ranked_solo: 'Ranked Solo/Duo', ranked_flex: 'Ranked Flex' };
export const tierLabel = (t) => (t === 'all' ? 'All ranks' : t.endsWith('_plus') ? `${t[0].toUpperCase()}${t.slice(1, -5)}+` : t[0].toUpperCase() + t.slice(1));

// Stat shards are not in runesReforged.json: names by perk id.
export const SHARD_NAME = {
    5001: 'Health (scaling)', 5002: 'Armor', 5003: 'Magic Resist', 5005: 'Attack Speed',
    5007: 'Ability Haste', 5008: 'Adaptive Force', 5010: 'Move Speed', 5011: 'Health', 5013: 'Tenacity',
};