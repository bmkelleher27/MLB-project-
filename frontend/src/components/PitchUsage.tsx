import { useMemo } from 'react';
import type { AtBatDetailResponse, PitchDetail } from '@mlb-scorecards/shared';
import { avg } from '../lib/math';
import { pitchMeta } from '../lib/pitchTypes';

const MIN_PITCHES = 20;

// Mutually exclusive count states, in story order. Two-strike counts get their
// own bucket (the putaway pitch); ahead/even/behind cover the rest.
type Bucket = 'first' | 'ahead' | 'even' | 'behind' | 'twoStrikes';

const BUCKET_LABEL: Record<Bucket, string> = {
  first: 'First pitch (0-0)',
  ahead: 'Ahead in count',
  even: 'Even count',
  behind: 'Behind in count',
  twoStrikes: 'Two strikes',
};

function bucketOf(balls: number, strikes: number): Bucket {
  if (strikes === 2) return 'twoStrikes';
  if (balls === 0 && strikes === 0) return 'first';
  if (strikes > balls) return 'ahead';
  if (balls > strikes) return 'behind';
  return 'even';
}

function isWhiff(p: PitchDetail): boolean {
  return p.outcome.startsWith('Swinging Strike') || p.outcome === 'Foul Tip';
}

function isSwing(p: PitchDetail): boolean {
  return isWhiff(p) || p.outcome.startsWith('Foul') || p.inPlay;
}

interface TypeRow {
  type: string | null;
  n: number;
  usage: number; // 0-1
  velo: number | null;
  whiffPct: number | null; // whiffs / swings
  cswPct: number; // (called strikes + whiffs) / pitches
}

interface UsageData {
  name: string;
  total: number;
  buckets: Array<{ bucket: Bucket; total: number; top: Array<{ type: string | null; share: number }> }>;
  types: TypeRow[];
}

function buildUsage(atBats: AtBatDetailResponse[]): UsageData[] {
  const order: string[] = [];
  const acc = new Map<string, Array<PitchDetail & { bucket: Bucket }>>();

  for (const ab of atBats) {
    let list = acc.get(ab.pitcher);
    if (!list) {
      list = [];
      acc.set(ab.pitcher, list);
      order.push(ab.pitcher);
    }
    // A pitch's balls/strikes are the count AFTER it; the count it was thrown
    // in is the previous pitch's (0-0 for the first of the plate appearance).
    ab.pitches.forEach((p, i) => {
      const before = i === 0 ? { balls: 0, strikes: 0 } : ab.pitches[i - 1];
      list!.push({ ...p, bucket: bucketOf(before.balls, before.strikes) });
    });
  }

  return order
    .map((name) => {
      const pitches = acc.get(name)!;
      const buckets = (Object.keys(BUCKET_LABEL) as Bucket[]).map((bucket) => {
        const inBucket = pitches.filter((p) => p.bucket === bucket);
        const byType = new Map<string | null, number>();
        for (const p of inBucket) byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
        const top = [...byType.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([type, n]) => ({ type, share: n / inBucket.length }));
        return { bucket, total: inBucket.length, top };
      });

      const byType = new Map<string | null, PitchDetail[]>();
      for (const p of pitches) {
        if (!byType.has(p.type)) byType.set(p.type, []);
        byType.get(p.type)!.push(p);
      }
      const types: TypeRow[] = [...byType.entries()]
        .map(([type, ps]) => {
          const swings = ps.filter(isSwing).length;
          const whiffs = ps.filter(isWhiff).length;
          const called = ps.filter((p) => p.outcome === 'Called Strike').length;
          const velos = ps.map((p) => p.velocity).filter((v): v is number => v != null);
          return {
            type,
            n: ps.length,
            usage: ps.length / pitches.length,
            velo: velos.length ? avg(velos) : null,
            whiffPct: swings > 0 ? whiffs / swings : null,
            cswPct: (called + whiffs) / ps.length,
          };
        })
        .sort((a, b) => b.n - a.n);

      return { name, total: pitches.length, buckets, types };
    })
    .filter((u) => u.total >= MIN_PITCHES);
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function UsagePanel({ data }: { data: UsageData }) {
  return (
    <div className="usage-panel">
      <div className="break-plot-name">
        {data.name} <span className="break-plot-count">· {data.total} pitches</span>
      </div>
      <div className="usage-buckets">
        {data.buckets
          .filter((b) => b.total > 0)
          .map((b) => (
            <div key={b.bucket} className="usage-bucket">
              <span className="usage-bucket-label">{BUCKET_LABEL[b.bucket]}</span>
              <span className="usage-bucket-pitches">
                {b.top.map((t) => (
                  <span key={t.type ?? 'other'} className="usage-chip">
                    <span className="break-swatch" style={{ background: pitchMeta(t.type).color }} aria-hidden="true" />
                    {pitchMeta(t.type).label} {pct(t.share)}
                  </span>
                ))}
              </span>
            </div>
          ))}
      </div>
      <table className="pregame-table usage-table">
        <thead>
          <tr>
            <th className="pregame-opp">Pitch</th>
            <th>#</th>
            <th title="Share of all pitches">Use</th>
            <th title="Average velocity">Velo</th>
            <th title="Whiffs per swing">Whiff%</th>
            <th title="Called strikes + whiffs, per pitch">CSW%</th>
          </tr>
        </thead>
        <tbody>
          {data.types.map((t) => (
            <tr key={t.type ?? 'other'}>
              <td className="pregame-opp">
                <span className="break-swatch" style={{ background: pitchMeta(t.type).color }} aria-hidden="true" />{' '}
                {pitchMeta(t.type).label}
              </td>
              <td>{t.n}</td>
              <td>{pct(t.usage)}</td>
              <td>{t.velo != null ? t.velo.toFixed(1) : '—'}</td>
              <td>{t.whiffPct != null ? pct(t.whiffPct) : '—'}</td>
              <td>{pct(t.cswPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PitchUsage({ atBats }: { atBats: AtBatDetailResponse[] }) {
  const usage = useMemo(() => buildUsage(atBats), [atBats]);
  if (usage.length === 0) return null;

  return (
    <section className="usage-section">
      <h2 className="atbat-inning-title">Pitch selection &amp; results</h2>
      <p className="atbat-note">
        What each pitcher reached for by count state, and how each pitch performed: <strong>Whiff%</strong> is
        misses per swing, <strong>CSW%</strong> is called strikes plus whiffs per pitch (league average ≈ 29%).
      </p>
      <div className="usage-grid">
        {usage.map((u) => (
          <UsagePanel key={u.name} data={u} />
        ))}
      </div>
    </section>
  );
}
