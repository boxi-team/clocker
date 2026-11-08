import { z } from 'zod';

// ---------- regions ----------
export const REGIONS = [
  'br1', 'eun1', 'euw1', 'jp1', 'kr', 'la1', 'la2', 'me1', 'na1',
  'oc1', 'ph2', 'ru', 'sg2', 'th2', 'tr1', 'tw2', 'vn2',
] as const;
export type Region = (typeof REGIONS)[number];
export type Routing = 'americas' | 'asia' | 'europe' | 'sea';

/** Riot regional routing for account-v1 and match-v5. */
export const ROUTING: Record<Region, Routing> = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  kr: 'asia', jp1: 'asia',
  eun1: 'europe', euw1: 'europe', me1: 'europe', tr1: 'europe', ru: 'europe',
  oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea',
};

/** "EUW1_123" -> "euw1", "KR_123" -> "kr" */
export function regionFromMatchId(matchId: string): Region | null {
  const prefix = matchId.split('_')[0]?.toLowerCase();
  return (REGIONS as readonly string[]).includes(prefix) ? (prefix as Region) : null;
}

// ---------- roles ----------
export const ROLES = ['top', 'jungle', 'mid', 'adc', 'support'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_FROM_RIOT: Record<string, Role> = {
  TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'mid', BOTTOM: 'adc', UTILITY: 'support',
};

// ---------- queues ----------
export const QUEUES = {
  ranked_solo: { id: 420, riot: 'RANKED_SOLO_5x5' },
  ranked_flex: { id: 440, riot: 'RANKED_FLEX_SR' },
} as const;
export type Queue = keyof typeof QUEUES;
export const QUEUE_NAMES = Object.keys(QUEUES) as [Queue, ...Queue[]];
export const queueFromId = (id: number): Queue | null =>
  (QUEUE_NAMES.find((q) => QUEUES[q].id === id) ?? null);
export const queueFromRiot = (riot: string): Queue | null =>
  (QUEUE_NAMES.find((q) => QUEUES[q].riot === riot) ?? null);

// ---------- tiers ----------
export const TIER_BUCKETS = [
  'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger',
] as const;
export type TierBucket = (typeof TIER_BUCKETS)[number];

const plus = (from: TierBucket) => TIER_BUCKETS.slice(TIER_BUCKETS.indexOf(from));
export const TIER_FILTERS = [
  'all', ...TIER_BUCKETS, 'emerald_plus', 'diamond_plus', 'master_plus',
] as const;
export type TierFilter = (typeof TIER_FILTERS)[number];

/** null = no tier restriction. */
export function tierFilterToBuckets(t: TierFilter): string[] | null {
  if (t === 'all') return null;
  if (t === 'emerald_plus') return plus('emerald');
  if (t === 'diamond_plus') return plus('diamond');
  if (t === 'master_plus') return plus('master');
  return [t];
}

// ---------- request schemas ----------
export const regionSchema = z.enum(REGIONS);
export const roleSchema = z.enum(ROLES);
export const queueSchema = z.enum(QUEUE_NAMES);

export const playerParams = z.object({
  region: regionSchema,
  gameName: z.string().min(1).max(16),
  tagLine: z.string().min(1).max(5),
});

export const analyticsQuery = z.object({
  patch: z.string().regex(/^(latest|\d+\.\d+)$/).default('latest'),
  tier: z.enum(TIER_FILTERS).default('master_plus'),
  queue: queueSchema.default('ranked_solo'),
  region: z.union([regionSchema, z.literal('all')]).default('all'),
  role: roleSchema.optional(),
});

export const minGamesSchema = z.coerce.number().int().min(1).default(100);
