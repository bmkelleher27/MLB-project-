import { Router } from 'express';
import type { PlayerSearchResponse, PlayerSearchResult } from '@mlb-scorecards/shared';
import { setShortCache } from '../http.js';
import { searchPeople } from '../mlbApi.js';

const router = Router();

/** Active big-leaguers first, then alphabetical, so the useful hits lead. */
function rank(a: PlayerSearchResult, b: PlayerSearchResult): number {
  if (a.active !== b.active) return a.active ? -1 : 1;
  if (Boolean(a.team) !== Boolean(b.team)) return a.team ? -1 : 1;
  return a.name.localeCompare(b.name);
}

router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.status(400).json({ error: 'query param "q" must be at least 2 characters' });
    return;
  }

  try {
    const raw = await searchPeople(q);
    const players: PlayerSearchResult[] = (raw.people ?? []).map((p) => ({
      id: p.id,
      name: p.fullName,
      position: p.primaryPosition?.abbreviation ?? null,
      team: p.currentTeam?.name ?? null,
      bats: p.batSide?.code ?? null,
      throws: p.pitchHand?.code ?? null,
      active: Boolean(p.active),
    }));
    players.sort(rank);

    const body: PlayerSearchResponse = { query: q, players: players.slice(0, 25) };
    // Name -> id mapping barely changes; a minute of shared caching is plenty.
    setShortCache(res, 60);
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
