interface ReplayControlsProps {
  totalPlays: number;
  /** Index into the game's ordered at-bats, or null when replay mode is off. */
  step: number | null;
  onChange: (step: number | null) => void;
}

export function ReplayControls({ totalPlays, step, onChange }: ReplayControlsProps) {
  if (totalPlays === 0) return null;

  if (step === null) {
    return (
      <div className="replay-bar replay-bar-idle">
        <button className="replay-btn replay-start" onClick={() => onChange(0)}>
          ▶ Replay this game
        </button>
        <span className="replay-hint">
          Step through at-bat by at-bat and watch the scorecard fill in
        </span>
      </div>
    );
  }

  return (
    <div className="replay-bar">
      <button className="replay-btn" onClick={() => onChange(null)}>
        ✕ Exit replay
      </button>
      <button className="replay-btn" onClick={() => onChange(Math.max(0, step - 1))} disabled={step === 0}>
        ‹ Prev
      </button>
      <button
        className="replay-btn"
        onClick={() => onChange(Math.min(totalPlays - 1, step + 1))}
        disabled={step >= totalPlays - 1}
      >
        Next ›
      </button>
      <input
        type="range"
        className="replay-slider"
        min={0}
        max={totalPlays - 1}
        value={step}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Replay position"
      />
      <span className="replay-progress">
        Play {step + 1} / {totalPlays}
      </span>
    </div>
  );
}
