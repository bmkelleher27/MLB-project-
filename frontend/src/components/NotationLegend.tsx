const POSITIONS: Array<{ num: number; abbr: string; name: string; x: number; y: number }> = [
  { num: 1, abbr: 'P', name: 'Pitcher', x: 110, y: 103 },
  { num: 2, abbr: 'C', name: 'Catcher', x: 110, y: 163 },
  { num: 3, abbr: '1B', name: 'First base', x: 178, y: 92 },
  { num: 4, abbr: '2B', name: 'Second base', x: 146, y: 66 },
  { num: 5, abbr: '3B', name: 'Third base', x: 42, y: 92 },
  { num: 6, abbr: 'SS', name: 'Shortstop', x: 74, y: 66 },
  { num: 7, abbr: 'LF', name: 'Left field', x: 38, y: 30 },
  { num: 8, abbr: 'CF', name: 'Center field', x: 110, y: 14 },
  { num: 9, abbr: 'RF', name: 'Right field', x: 182, y: 30 },
];

const CODE_GROUPS: Array<{ title: string; codes: Array<[string, string]> }> = [
  {
    title: 'Hits',
    codes: [
      ['1B', 'Single'],
      ['2B', 'Double'],
      ['3B', 'Triple'],
      ['HR', 'Home run'],
      ['1B-7', 'Single, fielded by the left fielder (7)'],
    ],
  },
  {
    title: 'Outs',
    codes: [
      ['K', 'Strikeout, swinging'],
      ['ꓘ', 'Strikeout, called (caught looking)'],
      ['6-3', 'Ground out: shortstop (6) threw to first base (3)'],
      ['F8', 'Fly out to the center fielder (8)'],
      ['L4', 'Line out to the second baseman (4)'],
      ['P6', 'Pop out to the shortstop (6)'],
      ['6-4-3', 'Double play: 6 to 4 to 3'],
      ['SF8', 'Sacrifice fly to center'],
      ['SH1-3', 'Sacrifice bunt, pitcher to first'],
    ],
  },
  {
    title: 'Reaching base',
    codes: [
      ['BB', 'Walk (base on balls)'],
      ['IBB', 'Intentional walk'],
      ['HBP', 'Hit by pitch'],
      ['FC', "Fielder's choice"],
      ['E5', 'Error by the third baseman (5)'],
      ['CI', "Catcher's interference"],
    ],
  },
  {
    title: 'On the bases',
    codes: [
      ['SB', 'Stolen base'],
      ['CS', 'Caught stealing'],
      ['WP', 'Advanced on a wild pitch'],
      ['PB', 'Advanced on a passed ball'],
      ['BLK', 'Advanced on a balk'],
      ['PO', 'Picked off'],
      ['DI', 'Defensive indifference'],
    ],
  },
];

function PositionDiagram() {
  return (
    <svg viewBox="0 0 220 178" className="legend-field" aria-label="Fielding position numbers">
      {/* infield diamond: home, first, second, third */}
      <path d="M110,140 L165,100 L110,60 L55,100 Z" className="legend-field-diamond" fill="none" />
      {POSITIONS.map((p) => (
        <g key={p.num}>
          <circle cx={p.x} cy={p.y} r={10} className="legend-field-pos" />
          <text x={p.x} y={p.y + 0.5} textAnchor="middle" dominantBaseline="middle" className="legend-field-num">
            {p.num}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function NotationLegend() {
  return (
    <div className="notation-legend">
      <div className="legend-section">
        <h3 className="legend-heading">Reading the grid</h3>
        <ul className="legend-bullets">
          <li>Each <strong>row</strong> is a spot in the batting order; each <strong>column</strong> is an inning.</li>
          <li>Each box is one plate appearance. Read down a column for the inning's action, then move right to the next inning.</li>
          <li>The bold line on the little diamond traces how far that batter got around the bases.</li>
          <li>Small codes next to a base (SB, WP…) show how the runner moved <em>after</em> his at-bat — those plays happened during a later batter's turn. Click one to see which.</li>
          <li>Click any box for a plain-English explanation of the play.</li>
        </ul>
        <div className="legend-swatches">
          <span className="legend-swatch"><span className="legend-swatch-box legend-swatch-scored" /> came around to score</span>
          <span className="legend-swatch"><span className="legend-swatch-box legend-swatch-out" /> out</span>
          <span className="legend-swatch"><span className="legend-swatch-chip">① ② ③</span> which out of the inning</span>
          <span className="legend-swatch"><span className="legend-swatch-chip">2-1</span> final ball-strike count</span>
        </div>
      </div>

      <div className="legend-section legend-section-positions">
        <h3 className="legend-heading">Fielders are numbered 1–9</h3>
        <div className="legend-positions">
          <PositionDiagram />
          <ul className="legend-position-list">
            {POSITIONS.map((p) => (
              <li key={p.num}>
                <span className="legend-code">{p.num}</span> {p.abbr} — {p.name}
              </li>
            ))}
          </ul>
        </div>
        <p className="legend-note">
          So "6-3" means the shortstop threw the batter out at first, and "F8" is a fly ball caught by the center fielder.
        </p>
      </div>

      {CODE_GROUPS.map((group) => (
        <div className="legend-section" key={group.title}>
          <h3 className="legend-heading">{group.title}</h3>
          <ul className="legend-code-list">
            {group.codes.map(([code, meaning]) => (
              <li key={code}>
                <span className="legend-code">{code}</span> {meaning}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="legend-section legend-section-predictive">
        <h3 className="legend-heading">Predictive metrics: DMG &amp; DOM</h3>
        <p className="legend-prose">
          The box score tells you what <em>happened</em>; these two stats measure the <em>process</em> — what the
          player actually controlled — which predicts future performance much better than results do. Both are
          scaled so <strong>100 = league average</strong>; higher is better.
        </p>
        <div className="legend-predictive-cols">
          <div>
            <h4 className="legend-subheading">
              <span className="legend-code">DMG</span> Damage Index (batters)
            </h4>
            <ul className="legend-bullets">
              <li>
                Each batted ball is valued by <strong>how it was struck</strong> — exit velocity and launch angle —
                not where it landed. A 400-foot out and a 400-foot homer count the same.
              </li>
              <li>
                A <strong>barrel</strong> (98+ mph at an ideal angle, roughly 26–30° and widening as the ball is hit
                harder) is worth the most; hard line drives next; weak or poorly-angled contact the least.
              </li>
              <li>Walks and hit-by-pitches add value; strikeouts count zero.</li>
              <li>
                <strong>Hard-hit</strong> = 95+ mph off the bat. Exit velocity data exists from 2015 onward — for
                older games DMG runs on discipline alone.
              </li>
            </ul>
          </div>
          <div>
            <h4 className="legend-subheading">
              <span className="legend-code">DOM</span> Dominance Index (pitchers)
            </h4>
            <ul className="legend-bullets">
              <li>
                Built on <strong>CSW%</strong> — called strikes plus whiffs per pitch (league average ≈ 29%) — the
                best simple indicator of pitcher skill, because taking strikes and missing bats are things the
                defense can't help with.
              </li>
              <li>
                Adjusted by the <strong>quality of contact allowed</strong>: a pitcher drowned by bloop hits still
                grades well; one saved by great defense doesn't.
              </li>
              <li>Ignores runs and hits entirely, so it's immune to box-score luck.</li>
            </ul>
          </div>
        </div>
        <p className="legend-prose legend-note">
          One game is a small sample — a single barrel can swing DMG a lot — so read these as "who was actually
          dangerous today," not season-long talent. Watch for tells like a pitcher who "won" with a low DOM (got
          away with one) or a hitter who went 0-for-4 with a high DMG (hit into bad luck).
        </p>
      </div>
    </div>
  );
}
