import { Router } from 'express';
import type { SeasonGame, SeasonResponse, TeamInfo } from '@mlb-scorecards/shared';
import { getTeams, getTeamSeasonSchedule } from '../mlbApi.js';

const FIRST_SEASON = 2010;

export const teamsRouter = Router();

teamsRouter.get('/', async (req, res) => {
  const season = parseInt(String(req.query.season ?? new Date().getFullYear()), 10);
  if (!Number.isFinite(season)) {
    res.status(400).json({ error: 'invalid season' });
    return;
  }
  try {
    const raw = await getTeams(season);
    const teams: TeamInfo[] = raw.teams
      .map((t) => ({ id: t.id, name: t.name, abbreviation: t.abbreviation ?? t.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ season, teams });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export const seasonRouter = Router();

seasonRouter.get('/', async (req, res) => {
  const teamId = parseInt(String(req.query.teamId), 10);
  const season = parseInt(String(req.query.season), 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(teamId) || !Number.isFinite(season) || season < FIRST_SEASON || season > currentYear) {
    res.status(400).json({ error: `teamId and season (${FIRST_SEASON}-${currentYear}) are required` });
    return;
  }
  try {
    const raw = await getTeamSeasonSchedule(teamId, season);
    const games: SeasonGame[] = (raw.dates ?? [])
      .flatMap((d) => d.games)
      .map((g) => {
        const isHome = g.teams.home.team.id === teamId;
        const us = isHome ? g.teams.home : g.teams.away;
        const them = isHome ? g.teams.away : g.teams.home;
        const isFinal = g.status.abstractGameState === 'Final';
        return {
          gamePk: g.gamePk,
          gameDate: g.gameDate,
          gameType: g.gameType ?? 'R',
          status: {
            abstractGameState: g.status.abstractGameState,
            detailedState: g.status.detailedState,
          },
          isHome,
          opponent: {
            id: them.team.id,
            name: them.team.name,
            abbreviation: them.team.abbreviation ?? them.team.name,
          },
          teamScore: isFinal ? us.score ?? null : null,
          opponentScore: isFinal ? them.score ?? null : null,
          won: isFinal && us.isWinner != null ? us.isWinner : null,
          venue: g.venue?.name ?? null,
        };
      });
    const body: SeasonResponse = { teamId, season, games };
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});
