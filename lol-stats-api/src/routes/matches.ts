import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, latestPatch } from '../db.js';
import { QUEUES, queueFromId, regionFromMatchId, regionSchema } from '../domain.js';
import { AppError, notFound } from '../errors.js';
import { ok } from '../http.js';
import { ingestMatch } from '../ingest/match.js';
import { RiotNotFound } from '../riot/client.js';

const params = z.object({
  region: regionSchema,
  matchId: z.string().regex(/^[A-Z0-9]+_\d+$/),
});

interface MatchRow {
  match_id: string; region: string; queue_id: number; patch: string; game_creation: string;
  game_duration: number; winning_team: number; tier_bucket: string;
}

async function load(matchId: string) {
  const m = await pool.query<MatchRow>('SELECT * FROM matches WHERE match_id = $1', [matchId]);
  return m.rows[0] ?? null;
}

export async function matchRoutes(app: FastifyInstance) {
  app.get('/matches/:region/:matchId', async (req, reply) => {
    const { region, matchId } = params.parse(req.params);
    if (regionFromMatchId(matchId) !== region) {
      throw new AppError(400, 'INVALID_PARAMETER', `Match id ${matchId} does not belong to region ${region}`);
    }

    let match = await load(matchId);
    if (!match) {
      try {
        const outcome = await ingestMatch(region, matchId, { tierBucket: 'unranked' });
        if (outcome === 'skipped') {
          throw new AppError(422, 'UNSUPPORTED_MATCH', 'Only ranked Solo/Duo and Flex matches (not remakes) are supported');
        }
      } catch (err) {
        if (err instanceof RiotNotFound) throw notFound('MATCH_NOT_FOUND', `Match ${matchId} not found`);
        throw err;
      }
      match = await load(matchId);
      if (!match) throw notFound('MATCH_NOT_FOUND', `Match ${matchId} not found`);
    }

    const patch = await latestPatch();
    const [participants, bans] = await Promise.all([
      pool.query(
        `SELECT p.*, c.id AS champion_name FROM match_participants p
         LEFT JOIN champions c ON c.key = p.champion_id AND c.patch = $2
         WHERE p.match_id = $1 ORDER BY p.team_id, array_position(ARRAY['top','jungle','mid','adc','support'], p.role)`,
        [matchId, patch],
      ),
      pool.query<{ team_id: number; champion_id: number }>(
        'SELECT team_id, champion_id FROM match_bans WHERE match_id = $1 ORDER BY pick_turn',
        [matchId],
      ),
    ]);

    const teams = [100, 200].map((teamId) => {
      const rows = participants.rows.filter((p) => p.team_id === teamId);
      return {
        teamId,
        win: match!.winning_team === teamId,
        bans: bans.rows.filter((b) => b.team_id === teamId).map((b) => b.champion_id),
        participants: rows.map((p) => ({
          puuid: p.puuid,
          gameName: p.game_name,
          tagLine: p.tag_line,
          championKey: p.champion_id,
          championId: p.champion_name ?? null,
          role: p.role,
          win: p.win,
          kills: p.kills, deaths: p.deaths, assists: p.assists,
          cs: p.cs, gold: p.gold, damageToChampions: p.damage,
          visionScore: p.vision_score, champLevel: p.champ_level,
          items: p.items,
          summonerSpells: [p.spell1, p.spell2],
          runes: {
            primaryStyle: p.primary_style, subStyle: p.sub_style, keystone: p.keystone,
            primaryPerks: p.primary_perks, secondaryPerks: p.secondary_perks, statShards: p.stat_shards,
          },
        })),
      };
    });

    reply.header('Cache-Control', 'public, max-age=3600'); // matches never change
    return ok({
      matchId: match.match_id,
      region: match.region,
      queue: queueFromId(match.queue_id) ?? (Object.keys(QUEUES)[0] as string),
      patch: match.patch,
      gameCreation: Number(match.game_creation),
      gameDuration: match.game_duration,
      winningTeamId: match.winning_team,
      tierBucket: match.tier_bucket,
      teams,
    }, { patch: match.patch });
  });
}
