import { config } from '../config.js';
import { pool } from '../db.js';
import { ROLE_FROM_RIOT, queueFromId, type Region } from '../domain.js';
import { riot, type RiotParticipant, type RiotTimeline } from '../riot/client.js';
import { classifyItems, itemsForPatch } from './items.js';

export type IngestOutcome = 'stored' | 'exists' | 'skipped';

const REMAKE_SECONDS = 300;
const SKILL_LETTER: Record<number, string> = { 1: 'Q', 2: 'W', 3: 'E', 4: 'R' };

export const patchOf = (gameVersion: string) => gameVersion.split('.').slice(0, 2).join('.');

/** Skill data for one participant from a match timeline. */
export function parseTimeline(tl: RiotTimeline, puuid: string) {
  const participantId = tl.metadata.participants.indexOf(puuid) + 1;
  if (participantId === 0) return null;

  const skills: number[] = [];
  const starting: number[] = [];
  for (const frame of tl.info.frames) {
    for (const e of frame.events) {
      if (e.participantId !== participantId) continue;
      if (e.type === 'SKILL_LEVEL_UP' && e.levelUpType === 'NORMAL' && e.skillSlot) {
        skills.push(e.skillSlot);
      } else if (e.type === 'ITEM_PURCHASED' && e.itemId && e.timestamp <= 90_000) {
        starting.push(e.itemId);
      } else if (e.type === 'ITEM_UNDO' && e.beforeId) {
        const i = starting.lastIndexOf(e.beforeId);
        if (i >= 0) starting.splice(i, 1);
      }
    }
  }
  if (!skills.length) return null;

  // Order in which Q, W, E reach their 5th point.
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const maxed: string[] = [];
  for (const s of skills) {
    if (s in counts && ++counts[s] === 5) maxed.push(SKILL_LETTER[s]);
  }
  for (const s of [1, 2, 3]) if (!maxed.includes(SKILL_LETTER[s])) maxed.push(SKILL_LETTER[s]); // incomplete: append by slot
  return {
    skillOrder: skills.slice(0, 15).map((s) => SKILL_LETTER[s]).join(''),
    skillMaxOrder: maxed.join('>'),
    startingItems: starting.sort((a, b) => a - b),
  };
}

function runesOf(p: RiotParticipant) {
  const primary = p.perks.styles.find((s) => s.description === 'primaryStyle');
  const sub = p.perks.styles.find((s) => s.description === 'subStyle');
  const primaryPerks = primary?.selections.map((s) => s.perk) ?? [];
  return {
    primaryStyle: primary?.style ?? null,
    subStyle: sub?.style ?? null,
    keystone: primaryPerks[0] ?? null,
    primaryPerks,
    secondaryPerks: sub?.selections.map((s) => s.perk) ?? [],
    statShards: [p.perks.statPerks.offense, p.perks.statPerks.flex, p.perks.statPerks.defense],
  };
}

/**
 * Downloads one match (and, for a sample, its timeline) and stores it.
 * Only ranked Solo/Duo and Flex matches that are not remakes are stored.
 */
export async function ingestMatch(
  region: Region,
  matchId: string,
  opts: { tierBucket: string; forceTimeline?: boolean },
): Promise<IngestOutcome> {
  const { rowCount } = await pool.query('SELECT 1 FROM matches WHERE match_id = $1', [matchId]);
  if (rowCount) return 'exists';

  const m = await riot.match(region, matchId);
  const queue = queueFromId(m.info.queueId);
  if (!queue || m.info.gameDuration < REMAKE_SECONDS || m.info.participants.length !== 10) return 'skipped';

  const patch = patchOf(m.info.gameVersion);
  const itemMap = await itemsForPatch(patch);

  let timeline: RiotTimeline | null = null;
  if (opts.forceTimeline || Math.random() < config.timelineSampleRate) {
    try {
      timeline = await riot.timeline(region, matchId);
    } catch {
      timeline = null; // a missing timeline must not block the match
    }
  }

  const winningTeam = m.info.teams.find((t) => t.win)?.teamId ?? 100;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO matches (match_id, region, queue_id, patch, game_version, game_creation, game_duration, winning_team, tier_bucket)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (match_id) DO NOTHING`,
      [matchId, region, m.info.queueId, patch, m.info.gameVersion, m.info.gameCreation,
       m.info.gameDuration, winningTeam, opts.tierBucket],
    );
    if (!ins.rowCount) { // another worker stored it first
      await client.query('ROLLBACK');
      return 'exists';
    }

    for (const p of m.info.participants) {
      const slots = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];
      const cls = classifyItems(slots, itemMap);
      const runes = runesOf(p);
      const tl = timeline ? parseTimeline(timeline, p.puuid) : null;
      await client.query(
        `INSERT INTO match_participants (
           match_id, puuid, game_name, tag_line, team_id, champion_id, role, win,
           kills, deaths, assists, cs, gold, damage, vision_score, champ_level,
           items, boots, completed_items, core_items, spell1, spell2,
           primary_style, sub_style, keystone, primary_perks, secondary_perks, stat_shards,
           skill_order, skill_max_order, starting_items,
           patch, queue_id, region, tier_bucket, game_creation, game_duration)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
                 $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)`,
        [
          matchId, p.puuid, p.riotIdGameName ?? null, p.riotIdTagline ?? null, p.teamId, p.championId,
          ROLE_FROM_RIOT[p.teamPosition] ?? null, p.win,
          p.kills, p.deaths, p.assists, p.totalMinionsKilled + p.neutralMinionsKilled,
          p.goldEarned, p.totalDamageDealtToChampions, p.visionScore, p.champLevel,
          [...slots, p.item6], cls.boots, cls.completedItems, cls.coreItems, p.summoner1Id, p.summoner2Id,
          runes.primaryStyle, runes.subStyle, runes.keystone, runes.primaryPerks, runes.secondaryPerks, runes.statShards,
          tl?.skillOrder ?? null, tl?.skillMaxOrder ?? null, tl?.startingItems ?? null,
          patch, m.info.queueId, region, opts.tierBucket, m.info.gameCreation, m.info.gameDuration,
        ],
      );
    }

    for (const team of m.info.teams) {
      for (const ban of team.bans) {
        if (ban.championId <= 0) continue;
        await client.query(
          `INSERT INTO match_bans (match_id, team_id, pick_turn, champion_id) VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING`,
          [matchId, team.teamId, ban.pickTurn, ban.championId],
        );
      }
    }
    await client.query('COMMIT');
    return 'stored';
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
