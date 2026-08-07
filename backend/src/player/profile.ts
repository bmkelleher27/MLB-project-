import type {
  PitchTypePerformance,
  PitchTypeUsage,
  PlayerProfileSide,
  SplitLine,
  TrendPoint,
  ZoneCell,
  ZoneMetric,
} from '@mlb-scorecards/shared';
import type { RawByMonth, RawHotColdZones, RawPitchArsenal, RawStatSplits } from '../mlbApi.js';

/**
 * MLB's Gameday zone grid: '01'-'09' are the 3x3 cells inside the strike zone
 * (read left-to-right, top-to-bottom from the catcher's view) and '11'-'14' are
 * the four quadrants outside it. Anything else is ignored rather than guessed at.
 */
export const IN_ZONE = ['01', '02', '03', '04', '05', '06', '07', '08', '09'] as const;
export const OUT_ZONE = ['11', '12', '13', '14'] as const;
export const ALL_ZONES: string[] = [...IN_ZONE, ...OUT_ZONE];

/** Parses MLB's stat strings (".333", "1.250", "91.99") into a number. */
export function parseStatValue(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '.---' || trimmed === '-.--') return null;
  // A leading-dot average (".333") parses correctly as 0.333.
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function buildArsenal(
  raw: RawPitchArsenal,
  performance?: Map<string, PitchTypePerformance>
): PitchTypeUsage[] {
  const splits = raw.stats?.[0]?.splits ?? [];
  const out: PitchTypeUsage[] = [];
  for (const s of splits) {
    const stat = s.stat;
    const code = stat?.type?.code;
    if (!stat || !code) continue;
    out.push({
      code,
      name: stat.type?.description ?? code,
      count: num(stat.count),
      share: typeof stat.percentage === 'number' ? stat.percentage : 0,
      avgSpeed: typeof stat.averageSpeed === 'number' ? Math.round(stat.averageSpeed * 10) / 10 : null,
      performance: performance?.get(code) ?? null,
    });
  }
  // Most-used first: the shape of a mix is the story, so lead with the big pitches.
  out.sort((a, b) => b.share - a.share || b.count - a.count);
  return out;
}

interface ZoneMeta {
  label: string;
  description: string;
  kind: 'performance' | 'volume';
}

/** Only metrics we can label honestly are surfaced; anything else is dropped. */
const ZONE_META: Record<string, ZoneMeta> = {
  onBasePlusSlugging: { label: 'OPS', description: 'On-base plus slugging by zone', kind: 'performance' },
  sluggingPercentage: { label: 'SLG', description: 'Slugging percentage by zone', kind: 'performance' },
  onBasePercentage: { label: 'OBP', description: 'On-base percentage by zone', kind: 'performance' },
  battingAverage: { label: 'AVG', description: 'Batting average by zone', kind: 'performance' },
  exitVelocity: { label: 'Exit velo', description: 'Average exit velocity (mph) by zone', kind: 'performance' },
  numberOfPitches: { label: 'Pitches', description: 'Where the pitches went — count by zone', kind: 'volume' },
  numberOfStrikes: { label: 'Strikes', description: 'Strikes thrown by zone', kind: 'volume' },
  earnedRunAverage: { label: 'ERA', description: 'Earned run average by zone', kind: 'performance' },
};

/** Metric display order — location/volume first for pitchers, rate stats after. */
const ZONE_ORDER = [
  'numberOfPitches',
  'numberOfStrikes',
  'onBasePlusSlugging',
  'battingAverage',
  'sluggingPercentage',
  'onBasePercentage',
  'exitVelocity',
  'earnedRunAverage',
];

export function buildZones(raw: RawHotColdZones): ZoneMetric[] {
  const splits = raw.stats?.[0]?.splits ?? [];
  const metrics: ZoneMetric[] = [];

  for (const s of splits) {
    const name = s.stat?.name;
    const meta = name ? ZONE_META[name] : undefined;
    if (!name || !meta) continue;

    const byZone = new Map<string, ZoneCell>();
    for (const z of s.stat?.zones ?? []) {
      if (!z.zone || !ALL_ZONES.includes(z.zone)) continue;
      byZone.set(z.zone, {
        zone: z.zone,
        value: parseStatValue(z.value),
        display: typeof z.value === 'string' ? z.value : '',
      });
    }
    // Always emit all 13 cells so the grid renders complete, with gaps as nulls.
    const cells: ZoneCell[] = ALL_ZONES.map(
      (zone) => byZone.get(zone) ?? { zone, value: null, display: '' }
    );

    const values = cells.map((c) => c.value).filter((v): v is number => v != null);
    // Volume scales read against their own total; performance scales diverge
    // around this player's own across-zone average, so "hot" means hot for him.
    const reference =
      values.length === 0
        ? null
        : meta.kind === 'volume'
          ? values.reduce((a, b) => a + b, 0)
          : values.reduce((a, b) => a + b, 0) / values.length;

    metrics.push({
      name,
      label: meta.label,
      description: meta.description,
      kind: meta.kind,
      cells,
      reference: reference == null ? null : Math.round(reference * 1000) / 1000,
    });
  }

  metrics.sort((a, b) => {
    const ai = ZONE_ORDER.indexOf(a.name);
    const bi = ZONE_ORDER.indexOf(b.name);
    return (ai < 0 ? ZONE_ORDER.length : ai) - (bi < 0 ? ZONE_ORDER.length : bi);
  });
  return metrics;
}

const SPLIT_LABELS: Record<string, string> = {
  vl: 'vs LHP',
  vr: 'vs RHP',
};

export function buildSplits(raw: RawStatSplits, group: 'hitting' | 'pitching'): SplitLine[] {
  const splits = raw.stats?.[0]?.splits ?? [];
  const out: SplitLine[] = [];
  for (const s of splits) {
    const code = s.split?.code;
    const stat = s.stat;
    if (!code || !stat) continue;
    // A pitcher's "vs left" means left-handed batters faced.
    const fallback = group === 'pitching' ? (code === 'vl' ? 'vs LHB' : 'vs RHB') : SPLIT_LABELS[code];
    out.push({
      code,
      label: SPLIT_LABELS[code] && group === 'hitting' ? SPLIT_LABELS[code] : (fallback ?? s.split?.description ?? code),
      // Hitters report plateAppearances; pitchers report battersFaced.
      plateAppearances: num(stat.plateAppearances) || num(stat.battersFaced),
      avg: String(stat.avg ?? ''),
      obp: String(stat.obp ?? ''),
      slg: String(stat.slg ?? ''),
      ops: String(stat.ops ?? ''),
      strikeouts: num(stat.strikeOuts),
      walks: num(stat.baseOnBalls),
      homeRuns: num(stat.homeRuns),
    });
  }
  return out;
}

const MONTH_LABELS: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

export function buildTrend(raw: RawByMonth, group: 'hitting' | 'pitching'): TrendPoint[] {
  const splits = raw.stats?.[0]?.splits ?? [];
  const out: TrendPoint[] = [];
  for (const s of splits) {
    const month = s.month;
    const stat = s.stat;
    if (typeof month !== 'number' || !stat) continue;

    // Denominator for rate stats: PA for hitters, batters faced for pitchers.
    const denom =
      group === 'hitting'
        ? num(stat.plateAppearances)
        : num(stat.battersFaced) || num(stat.plateAppearances);
    const k = num(stat.strikeOuts);
    const bb = num(stat.baseOnBalls);

    out.push({
      month,
      label: MONTH_LABELS[month] ?? String(month),
      games: num(stat.gamesPlayed),
      primary: parseStatValue(group === 'hitting' ? stat.ops : stat.era),
      secondary: parseStatValue(stat.avg),
      strikeoutRate: denom > 0 ? Math.round((k / denom) * 1000) / 1000 : null,
      walkRate: denom > 0 ? Math.round((bb / denom) * 1000) / 1000 : null,
    });
  }
  // The API returns months unordered; a trend line needs chronological order.
  out.sort((a, b) => a.month - b.month);
  return out;
}

/** True when there's enough here to be worth rendering a side of the profile. */
export function hasProfileData(side: PlayerProfileSide): boolean {
  return (
    side.arsenal.length > 0 ||
    side.zones.length > 0 ||
    side.trend.length > 0 ||
    side.splits.length > 0
  );
}
