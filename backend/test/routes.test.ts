import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-level tests. MLB is stubbed at the api module boundary so these run
 * offline and deterministically — they exercise validation, status codes,
 * cache headers and body shape, which the pure-logic tests never touch.
 */
vi.mock('../src/mlbApi.js', () => ({
  searchPeople: vi.fn(),
  getPerson: vi.fn(),
  getPitchArsenal: vi.fn(async () => ({})),
  getHotColdZones: vi.fn(async () => ({})),
  getStatSplits: vi.fn(async () => ({})),
  getByMonth: vi.fn(async () => ({})),
  getPlayLog: vi.fn(async () => ({})),
  getPitchLog: vi.fn(async () => ({})),
}));

const api = await import('../src/mlbApi.js');
const { default: playerSearchRouter } = await import('../src/routes/playerSearch.js');
const { default: playerProfileRouter } = await import('../src/routes/playerProfile.js');

function appWith(path: string, router: express.Router) {
  const app = express();
  app.use(path, router);
  return app;
}

afterEach(() => vi.clearAllMocks());

describe('GET /api/players/search', () => {
  const app = appWith('/api/players/search', playerSearchRouter);

  it('rejects a query shorter than two characters', async () => {
    const res = await request(app).get('/api/players/search?q=a');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 2/);
  });

  it('rejects a missing query', async () => {
    expect((await request(app).get('/api/players/search')).status).toBe(400);
  });

  it('maps upstream results and ranks active big-leaguers first', async () => {
    vi.mocked(api.searchPeople).mockResolvedValue({
      people: [
        { id: 1, fullName: 'Retired Guy', active: false, primaryPosition: { abbreviation: '1B' } },
        {
          id: 2,
          fullName: 'Active Star',
          active: true,
          primaryPosition: { abbreviation: 'RF' },
          currentTeam: { name: 'New York Yankees' },
          batSide: { code: 'R' },
          pitchHand: { code: 'L' },
        },
      ],
    });

    const res = await request(app).get('/api/players/search?q=guy');
    expect(res.status).toBe(200);
    expect(res.body.players.map((p: { name: string }) => p.name)).toEqual([
      'Active Star',
      'Retired Guy',
    ]);
    expect(res.body.players[0]).toMatchObject({
      id: 2, position: 'RF', team: 'New York Yankees', bats: 'R', throws: 'L', active: true,
    });
  });

  it('sends a shared cache header', async () => {
    vi.mocked(api.searchPeople).mockResolvedValue({ people: [] });
    const res = await request(app).get('/api/players/search?q=zzz');
    expect(res.headers['cache-control']).toMatch(/public, max-age=60/);
  });

  it('reports an upstream failure as a bad gateway', async () => {
    vi.mocked(api.searchPeople).mockRejectedValue(new Error('MLB down'));
    const res = await request(app).get('/api/players/search?q=judge');
    expect(res.status).toBe(502);
  });
});

describe('GET /api/player/:id/profile', () => {
  const app = appWith('/api/player', playerProfileRouter);

  it('rejects a non-numeric id', async () => {
    expect((await request(app).get('/api/player/abc/profile')).status).toBe(400);
  });

  it('returns 404 — not 502 — when the player does not exist upstream', async () => {
    vi.mocked(api.getPerson).mockRejectedValue(
      new Error('MLB API request failed: /api/v1/people/999 -> 404')
    );
    const res = await request(app).get('/api/player/999/profile?season=2026');
    expect(res.status).toBe(404);
  });

  it('reports a genuine upstream outage as 502', async () => {
    vi.mocked(api.getPerson).mockRejectedValue(new Error('MLB API request failed: /x -> 503'));
    expect((await request(app).get('/api/player/1/profile?season=2026')).status).toBe(502);
  });

  it('returns null sides when the player has no data that season', async () => {
    vi.mocked(api.getPerson).mockResolvedValue({
      people: [{ id: 1, fullName: 'Nobody', primaryPosition: { abbreviation: 'P' } }],
    });
    const res = await request(app).get('/api/player/1/profile?season=1970');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Nobody', batting: null, pitching: null });
  });

  it('builds a side from the arsenal when data exists', async () => {
    vi.mocked(api.getPerson).mockResolvedValue({
      people: [{ id: 1, fullName: 'Slugger', batSide: { code: 'L' } }],
    });
    vi.mocked(api.getPitchArsenal).mockImplementation(async (_id, _season, group) =>
      group === 'hitting'
        ? {
            stats: [
              {
                splits: [
                  {
                    stat: {
                      percentage: 0.5, count: 50, totalPitches: 100, averageSpeed: 95,
                      type: { code: 'FF', description: 'Four-seam FB' },
                    },
                  },
                ],
              },
            ],
          }
        : {}
    );

    const res = await request(app).get('/api/player/1/profile?season=2026');
    expect(res.status).toBe(200);
    expect(res.body.bats).toBe('L');
    expect(res.body.batting.arsenal[0]).toMatchObject({ code: 'FF', count: 50 });
    expect(res.body.pitching).toBeNull();
  });
});
