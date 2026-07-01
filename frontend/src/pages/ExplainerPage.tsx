import { useState } from 'react';
import { Link } from 'react-router-dom';

/*
 * Contact-value map geometry. Data space: launch angle -40..60 deg (x),
 * exit velocity 60..116 mph (y). Pixel space: x 70..690, y 420..40.
 */
const X0 = 70;
const X_PER_DEG = 6.2;
const Y0 = 420;
const Y_PER_MPH = 380 / 56;

function x(la: number): number {
  return X0 + (la + 40) * X_PER_DEG;
}
function y(ev: number): number {
  return Y0 - (ev - 60) * Y_PER_MPH;
}

interface RegionInfo {
  name: string;
  value: string;
  sub: string;
}

const REGIONS: Record<string, RegionInfo> = {
  weak: { name: 'Weak contact', value: '0.18', sub: "Under 80 mph — any angle. Bloops sometimes fall, but you can't live there." },
  medo: { name: 'Medium, poor angle', value: '0.22', sub: '80–95 mph, topped (< 8°) or popped (> 32°).' },
  sweet: { name: 'Flares & liners', value: '0.42', sub: '80–95 mph at 8–32° — playable contact that finds grass.' },
  hardo: { name: 'Hard, bad angle', value: '0.35', sub: '95+ mph but smothered into the ground or skied.' },
  solid: { name: 'Solid contact', value: '0.70', sub: '95+ mph at 8–40°, just short of the barrel window.' },
  barrel: { name: 'Barrel', value: '1.30', sub: '98+ mph in the widening ideal-angle window. The gold standard.' },
};

interface Hover {
  region: RegionInfo;
  ev: number;
  la: number;
  px: number;
  py: number;
}

function ContactMap() {
  const [hover, setHover] = useState<Hover | null>(null);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const target = (e.target as Element).closest('.explainer-region');
    const key = target?.getAttribute('data-r');
    if (!key || !REGIONS[key]) {
      setHover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) * 720) / rect.width;
    const sy = ((e.clientY - rect.top) * 470) / rect.height;
    setHover({
      region: REGIONS[key],
      la: Math.round((sx - X0) / X_PER_DEG - 40),
      ev: Math.round(60 + (Y0 - sy) / Y_PER_MPH),
      px: e.clientX,
      py: e.clientY,
    });
  }

  // Barrel wedge: 26-30 deg at 98 mph, widening (left edge clamps at 8 deg, right at 50).
  const barrelPath = [
    `M${x(26)},${y(98)}`,
    `L${x(30)},${y(98)}`,
    `L${x(50)},${y(108)}`,
    `L${x(50)},${y(116)}`,
    `L${x(8)},${y(116)}`,
    `L${x(8)},${y(98 + 18 / 1.7)}`,
    'Z',
  ].join(' ');

  return (
    <figure className="explainer-figure">
      <div className="explainer-chart-legend">
        <span>Expected production per batted ball</span>
        <span className="explainer-ramp" aria-hidden="true">
          {['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab', '#0d366b'].map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
        <span>0.18 → 1.30</span>
      </div>
      <svg
        viewBox="0 0 720 470"
        role="img"
        aria-label="Contact value by exit velocity and launch angle"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <g stroke="var(--panel-bg)" strokeWidth={2}>
          <rect className="explainer-region" data-r="weak" x={x(-40)} y={y(80)} width={x(60) - x(-40)} height={y(60) - y(80)} fill="#cde2fb" />
          <rect className="explainer-region" data-r="medo" x={x(-40)} y={y(95)} width={x(8) - x(-40)} height={y(80) - y(95)} fill="#9ec5f4" />
          <rect className="explainer-region" data-r="medo" x={x(32)} y={y(95)} width={x(60) - x(32)} height={y(80) - y(95)} fill="#9ec5f4" />
          <rect className="explainer-region" data-r="sweet" x={x(8)} y={y(95)} width={x(32) - x(8)} height={y(80) - y(95)} fill="#3987e5" />
          <rect className="explainer-region" data-r="hardo" x={x(-40)} y={y(116)} width={x(8) - x(-40)} height={y(95) - y(116)} fill="#6da7ec" />
          <rect className="explainer-region" data-r="hardo" x={x(40)} y={y(116)} width={x(60) - x(40)} height={y(95) - y(116)} fill="#6da7ec" />
          <rect className="explainer-region" data-r="solid" x={x(8)} y={y(116)} width={x(40) - x(8)} height={y(95) - y(116)} fill="#1c5cab" />
          <path className="explainer-region" data-r="barrel" d={barrelPath} fill="#0d366b" />
        </g>
        {/* Direct labels use fixed ink: they sit on fills that never change */}
        <g fill="#0b0b0b">
          <text className="explainer-region-label" x={380} y={348} textAnchor="middle">
            0.18 <tspan className="explainer-region-cap" fill="#3d3c39">weak (&lt; 80 mph)</tspan>
          </text>
          <text className="explainer-region-label" x={218} y={230} textAnchor="middle">0.22</text>
          <text className="explainer-region-label" x={603} y={230} textAnchor="middle">0.22</text>
          <text className="explainer-region-label" x={200} y={105} textAnchor="middle">
            0.35 <tspan className="explainer-region-cap" fill="#3d3c39">hard, bad angle</tspan>
          </text>
          <text className="explainer-region-label" x={628} y={170} textAnchor="middle">0.35</text>
        </g>
        <g fill="#ffffff">
          <text className="explainer-region-label" x={442} y={234} textAnchor="middle">
            0.42 <tspan className="explainer-region-cap" fill="#e8f0fb">flares &amp; liners</tspan>
          </text>
          <text className="explainer-region-label" x={435} y={150} textAnchor="middle">
            0.70 <tspan className="explainer-region-cap" fill="#e8f0fb">solid</tspan>
          </text>
          <text className="explainer-region-label" x={498} y={66} textAnchor="middle">
            1.30 <tspan className="explainer-region-cap" fill="#dbe6f7">barrel</tspan>
          </text>
        </g>
        <line x1={70} y1={420} x2={690} y2={420} stroke="var(--border)" />
        <line x1={70} y1={40} x2={70} y2={420} stroke="var(--border)" />
        <g className="explainer-tick" textAnchor="middle">
          {[-40, -20, 0, 20, 40, 60].map((la) => (
            <text key={la} x={x(la)} y={436}>{la}°</text>
          ))}
        </g>
        <g className="explainer-tick" textAnchor="end">
          {[60, 70, 80, 90, 100, 110].map((ev) => (
            <text key={ev} x={62} y={y(ev) + 3}>{ev}</text>
          ))}
        </g>
        <text className="explainer-axis-title" x={380} y={460} textAnchor="middle">Launch angle</text>
        <text className="explainer-axis-title" x={16} y={230} textAnchor="middle" transform="rotate(-90 16 230)">
          Exit velocity (mph)
        </text>
      </svg>
      {hover && (
        <div
          className="explainer-tooltip"
          style={{
            left: Math.min(hover.px + 14, window.innerWidth - 250),
            top: hover.py + 14,
          }}
        >
          <div className="explainer-tt-title">{hover.region.name} — {hover.region.value}</div>
          <div className="explainer-tt-sub">{hover.region.sub}</div>
          <div className="explainer-tt-sub explainer-mono">{hover.ev} mph at {hover.la}°</div>
        </div>
      )}
      <p className="explainer-chart-note">
        The barrel wedge starts at 98 mph on a 26–30° window and widens as the ball is hit harder — by 116 mph
        anything from 8° to 50° barrels. Approximates Statcast xwOBA-on-contact.
      </p>
    </figure>
  );
}

function Term({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <span className="explainer-term">
      <span className="explainer-term-t">{children}</span>
      <span className="explainer-term-cap">{caption}</span>
    </span>
  );
}

export function ExplainerPage() {
  return (
    <>
      <div className="scorecard-nav-bar">
        <Link to="/" className="scorecard-nav-back">‹ Schedule</Link>
        <span className="scorecard-nav-date">Predictive metrics explained</span>
      </div>
      <div className="explainer-page">
        <h1>DMG &amp; DOM — how the formulas work</h1>
        <p className="explainer-subtitle">
          Both are process stats indexed so <strong>100 = league average</strong>. They measure what the player
          controlled, not what the defense allowed — which is why they predict future performance better than the
          box score.
        </p>

        <div className="explainer-card">
          <h2>DMG — Damage Index <span className="explainer-role">(batters)</span></h2>
          <p className="explainer-card-sub">Expected production per plate appearance, from contact quality + plate discipline.</p>

          <div className="explainer-stepline">Step 1 — value every plate appearance</div>
          <div className="explainer-chips">
            <span className="explainer-chip">Strikeout → <strong>0.00</strong></span>
            <span className="explainer-chip">Walk / HBP → <strong>+0.69</strong></span>
            <span className="explainer-chip">Ball in play → <strong>value from the map below</strong></span>
          </div>

          <div className="explainer-stepline">The contact-value map · hover to explore</div>
          <ContactMap />

          <div className="explainer-stepline">Step 2 — average and index</div>
          <p className="explainer-formula">
            <span className="explainer-big">DMG</span><span className="explainer-op">=</span>100<span className="explainer-op">×</span>
            <Term caption="this player, this game">Σ PA values ÷ PA</Term>
            <span className="explainer-op">÷</span>
            <Term caption="league avg per PA">0.320</Term>
          </p>
          <div className="explainer-example">
            Example — 4 PAs: barrel <span className="explainer-mono">1.30</span> + walk <span className="explainer-mono">0.69</span> + flare{' '}
            <span className="explainer-mono">0.42</span> + strikeout <span className="explainer-mono">0.00</span> → mean{' '}
            <span className="explainer-mono">0.603</span> ÷ 0.320 × 100 = <strong>DMG 188</strong>
          </div>
        </div>

        <div className="explainer-card">
          <h2>DOM — Dominance Index <span className="explainer-role">(pitchers)</span></h2>
          <p className="explainer-card-sub">Strike-getting plus contact suppression — immune to runs, hits, and defense.</p>

          <div className="explainer-stepline">Ingredient 1 — CSW%: which pitches count</div>
          <div className="explainer-chips">
            <span className="explainer-chip explainer-chip-counted"><span className="explainer-mark">✓</span> Called strike</span>
            <span className="explainer-chip explainer-chip-counted"><span className="explainer-mark">✓</span> Swinging strike</span>
            <span className="explainer-chip explainer-chip-counted"><span className="explainer-mark">✓</span> Foul tip</span>
            <span className="explainer-chip explainer-chip-skipped"><span className="explainer-mark">✕</span> Foul ball</span>
            <span className="explainer-chip explainer-chip-skipped"><span className="explainer-mark">✕</span> Ball</span>
            <span className="explainer-chip explainer-chip-skipped"><span className="explainer-mark">✕</span> In play</span>
          </div>
          <p className="explainer-formula">
            <Term caption="league avg ≈ 29%">CSW%</Term>
            <span className="explainer-op">=</span> ( called strikes <span className="explainer-op">+</span> whiffs ){' '}
            <span className="explainer-op">÷</span> total pitches
          </p>

          <div className="explainer-stepline">Ingredient 2 — contact allowed</div>
          <p className="explainer-formula">
            <Term caption="league avg ≈ 0.370">xCON</Term>
            <span className="explainer-op">=</span> mean map value <span className="explainer-muted">(chart above)</span> of batted balls allowed
          </p>

          <div className="explainer-stepline">Combine</div>
          <p className="explainer-formula">
            <span className="explainer-big">DOM</span><span className="explainer-op">=</span>100<span className="explainer-op">+</span>
            <Term caption="strike-getting">350 × ( CSW − 0.29 )</Term>
            <span className="explainer-op">−</span>
            <Term caption="contact quality allowed">200 × ( xCON − 0.370 )</Term>
          </p>

          <div className="explainer-stepline">Worked examples — each term pushes DOM up or down from 100</div>
          <div className="explainer-contrib">
            <div className="explainer-contrib-row">
              <span className="explainer-contrib-name">Dominant start<br /><span className="explainer-contrib-inputs">CSW 35% · xCON 0.280</span></span>
              <span className="explainer-contrib-track"><span className="explainer-contrib-zero" /><span className="explainer-contrib-bar explainer-contrib-pos" style={{ width: '42%' }} /></span>
              <span className="explainer-mono">+21 strikes, +18 contact → <strong>DOM 139</strong></span>
            </div>
            <div className="explainer-contrib-row">
              <span className="explainer-contrib-name">Rough start<br /><span className="explainer-contrib-inputs">CSW 24% · xCON 0.460</span></span>
              <span className="explainer-contrib-track"><span className="explainer-contrib-zero" /><span className="explainer-contrib-bar explainer-contrib-neg" style={{ width: '38%' }} /></span>
              <span className="explainer-mono">−18 strikes, −18 contact → <strong>DOM 65</strong></span>
            </div>
            <div className="explainer-contrib-row">
              <span className="explainer-contrib-name">Got away with one<br /><span className="explainer-contrib-inputs">CSW 24% · xCON 0.420 · won 5–1</span></span>
              <span className="explainer-contrib-track"><span className="explainer-contrib-zero" /><span className="explainer-contrib-bar explainer-contrib-neg" style={{ width: '30%' }} /></span>
              <span className="explainer-mono">−18 strikes, −10 contact → <strong>DOM 72</strong></span>
            </div>
            <p className="explainer-contrib-note">
              Blue pushes above 100, red below. The third line is the tell these stats exist for: the box score said{' '}
              <em>win</em>, the process said <em>lucky</em>.
            </p>
          </div>
        </div>

        <p className="explainer-footnote">
          League constants: 0.320 production per PA · 0.370 per batted ball · 29% CSW. Walk value 0.69 is the
          standard wOBA weight. DOM is clamped at 0 for tiny relief outings. Exit-velocity data exists from 2015
          onward; older games fall back to the league-average contact value (0.370) per ball in play, so DMG runs
          on discipline alone and DOM on CSW alone.
        </p>
      </div>
    </>
  );
}
