import { useState } from 'react';
import { getTeamHex } from '../teamColors';

const NEUTRAL_HEX = '#64748b';

function teamLogoUrl(teamId: number): string {
  return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
}

/**
 * Team logo from the MLB CDN, degrading to a solid team-color swatch if the
 * image fails to load. Callers supply the class names so the same logic serves
 * the schedule cards, the print card, etc.
 */
export function TeamLogo({
  teamId,
  size = 20,
  imgClassName,
  fallbackClassName,
}: {
  teamId: number;
  size?: number;
  imgClassName?: string;
  fallbackClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={fallbackClassName} style={{ background: getTeamHex(teamId) ?? NEUTRAL_HEX }} />;
  }
  return (
    <img
      className={imgClassName}
      src={teamLogoUrl(teamId)}
      alt=""
      loading="lazy"
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
