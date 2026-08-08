/** Compact base-out state: three base diamonds plus out dots. */
export function BasesMini({
  first,
  second,
  third,
  outs,
}: {
  first: boolean;
  second: boolean;
  third: boolean;
  outs: number;
}) {
  const base = (cx: number, cy: number, occupied: boolean) => (
    <rect
      x={cx - 4}
      y={cy - 4}
      width={8}
      height={8}
      rx={1.5}
      transform={`rotate(45 ${cx} ${cy})`}
      className={occupied ? 'bases-mini-on' : 'bases-mini-off'}
    />
  );
  return (
    <span
      className="bases-mini"
      role="img"
      aria-label={`${[third && 'runner on third', second && 'runner on second', first && 'runner on first']
        .filter(Boolean)
        .join(', ') || 'bases empty'}, ${outs} out${outs === 1 ? '' : 's'}`}
    >
      <svg viewBox="0 0 34 24" width={34} height={24} aria-hidden="true">
        {base(9, 14, third)}
        {base(17, 7, second)}
        {base(25, 14, first)}
      </svg>
      <span className="bases-mini-outs" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`bases-mini-out${i < outs ? ' bases-mini-out-on' : ''}`} />
        ))}
      </span>
    </span>
  );
}
