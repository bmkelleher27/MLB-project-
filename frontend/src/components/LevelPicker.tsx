import { LEVELS, type LevelId } from '@mlb-scorecards/shared';

/**
 * Level selector: the majors and the affiliated minor leagues below them.
 *
 * Only levels the caller says are available are shown as enabled — on a player
 * page that's the levels they actually played at, so the control never offers a
 * switch that leads to an empty page.
 */
export function LevelPicker({
  value,
  onChange,
  available,
  label = 'Level',
}: {
  value: LevelId;
  onChange: (level: LevelId) => void;
  /** Level ids to offer; omit to offer all of them. */
  available?: number[];
  label?: string;
}) {
  const shown = available ? LEVELS.filter((l) => available.includes(l.id)) : LEVELS;
  if (shown.length <= 1) return null;

  return (
    <div className="level-picker" role="group" aria-label={label}>
      <span className="level-picker-label">{label}</span>
      {shown.map((level) => (
        <button
          key={level.id}
          type="button"
          className={`level-chip${level.id === value ? ' level-chip-on' : ''}`}
          aria-pressed={level.id === value}
          title={level.name}
          onClick={() => onChange(level.id)}
        >
          {level.abbreviation}
        </button>
      ))}
    </div>
  );
}
