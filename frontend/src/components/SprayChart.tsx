import { useMemo } from 'react';
import type { AtBatDetailResponse, GameAtBatsResponse } from '@mlb-scorecards/shared';

// Gameday spray coordinates: home plate sits near (125.4, 199), y shrinking
// toward the outfield. Rendered as-is with a field drawn in the same space.
const HOME_X = 125.42;
const HOME_Y = 198.27;
const VIEW_W = 250;
const VIEW_TOP = 20;
const VIEW_BOTTOM = 215;

type Batted = AtBatDetailResponse & { hitX: number; hitY: number };

function isBatted(ab: AtBatDetailResponse): ab is Batted {
  return ab.hitX != null && ab.hitY != null;
}

type Result = 'single' | 'double' | 'triple' | 'hr' | 'out';

function resultOf(ab: AtBatDetailResponse): Result {
  if (ab.code.startsWith('HR')) return 'hr';
  if (ab.code.startsWith('3B')) return 'triple';
  if (ab.code.startsWith('2B')) return 'double';
  if (ab.code.startsWith('1B') || ab.code.startsWith('E') || ab.code === 'CI') return 'single';
  return 'out';
}

const RESULT_META: Record<Result, { label: string; className: string }> = {
  single: { label: '1B', className: 'spray-dot-single' },
  double: { label: '2B', className: 'spray-dot-double' },
  triple: { label: '3B', className: 'spray-dot-triple' },
  hr: { label: 'HR', className: 'spray-dot-hr' },
  out: { label: 'Out', className: 'spray-dot-out' },
};

const TRAJECTORY_LABEL: Record<string, string> = {
  ground_ball: 'grounder',
  line_drive: 'line drive',
  fly_ball: 'fly ball',
  popup: 'pop up',
  bunt_grounder: 'bunt',
};

function Field() {
  // Foul lines run 45° from home; a generic outfield arc for orientation.
  const foulLen = 155;
  const dx = foulLen * Math.SQRT1_2;
  return (
    <g>
      <path
        d={`M${HOME_X - dx},${HOME_Y - dx} L${HOME_X},${HOME_Y} L${HOME_X + dx},${HOME_Y - dx}`}
        className="spray-foul-line"
      />
      {/* outfield arc, then infield diamond (bases ~45 units out) */}
      <path
        d={`M${HOME_X - dx},${HOME_Y - dx} A ${foulLen} ${foulLen} 0 0 1 ${HOME_X + dx},${HOME_Y - dx}`}
        className="spray-fence"
      />
      <path
        d={`M${HOME_X},${HOME_Y} L${HOME_X + 45 * Math.SQRT1_2},${HOME_Y - 45 * Math.SQRT1_2} L${HOME_X},${
          HOME_Y - 45 * Math.SQRT2
        } L${HOME_X - 45 * Math.SQRT1_2},${HOME_Y - 45 * Math.SQRT1_2} Z`}
        className="spray-infield"
      />
    </g>
  );
}

function TeamSpray({ title, atBats }: { title: string; atBats: Batted[] }) {
  return (
    <figure className="spray-chart">
      <figcaption className="break-plot-name">
        {title} <span className="break-plot-count">· {atBats.length} batted balls</span>
      </figcaption>
      <svg
        viewBox={`0 ${VIEW_TOP} ${VIEW_W} ${VIEW_BOTTOM - VIEW_TOP}`}
        role="img"
        aria-label={`${title} spray chart: one dot per batted ball, colored by result`}
      >
        <Field />
        {atBats.map((ab) => {
          const r = resultOf(ab);
          const traj = ab.trajectory ? TRAJECTORY_LABEL[ab.trajectory] ?? ab.trajectory : null;
          return (
            <circle
              key={ab.atBatIndex}
              cx={ab.hitX}
              cy={ab.hitY}
              r={4}
              className={`spray-dot ${RESULT_META[r].className}`}
            >
              <title>
                {`${ab.batter} — ${ab.code}${traj ? ` (${traj})` : ''}${
                  ab.exitVelocity != null ? ` · ${Math.round(ab.exitVelocity)} mph` : ''
                }${ab.distance != null ? ` · ${ab.distance} ft` : ''}`}
              </title>
            </circle>
          );
        })}
      </svg>
    </figure>
  );
}

export function SprayCharts({ data }: { data: GameAtBatsResponse }) {
  const { away, home } = useMemo(() => {
    const batted = data.atBats.filter(isBatted);
    return {
      // top half = away team batting
      away: batted.filter((ab) => ab.halfInning === 'top'),
      home: batted.filter((ab) => ab.halfInning === 'bottom'),
    };
  }, [data.atBats]);

  if (away.length + home.length === 0) return null;

  return (
    <section className="spray-section">
      <h2 className="atbat-inning-title">Spray charts</h2>
      <p className="atbat-note">
        Where every batted ball landed (or was fielded), colored by result. Hover a dot for the batter, exit
        velocity, and distance.
      </p>
      <div className="spray-legend">
        {(Object.keys(RESULT_META) as Result[]).map((r) => (
          <span key={r} className="spray-legend-item">
            <span className={`spray-swatch ${RESULT_META[r].className}`} aria-hidden="true" /> {RESULT_META[r].label}
          </span>
        ))}
      </div>
      <div className="break-plots-grid spray-grid">
        <TeamSpray title={data.teams.away.name} atBats={away} />
        <TeamSpray title={data.teams.home.name} atBats={home} />
      </div>
    </section>
  );
}
