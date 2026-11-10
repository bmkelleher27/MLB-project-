import { Link, useLocation } from 'react-router-dom';
import { LogoMark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * The app-wide navigation bar, rendered once above every route.
 *
 * Before this existed the only way into Season Review was a button on the
 * landing page styled like every other action, and the metrics guide was only
 * reachable from footnotes. Each page keeps its own contextual bar (back link,
 * page actions) underneath.
 */
const LINKS: { to: string; label: string; isActive: (path: string) => boolean }[] = [
  { to: '/', label: 'Scores', isActive: (p) => p === '/' || p.startsWith('/game/') },
  { to: '/season', label: 'Season', isActive: (p) => p.startsWith('/season') },
  { to: '/stats', label: 'Stats guide', isActive: (p) => p.startsWith('/stats') },
];

export function SiteNav() {
  const { pathname } = useLocation();
  return (
    <header className="site-nav">
      <Link to="/" className="site-nav-brand" aria-label="MLB Live Scorecards — home">
        <LogoMark size={26} />
        <span className="site-nav-brand-text">MLB Live Scorecards</span>
      </Link>
      <nav className="site-nav-links" aria-label="Primary">
        {LINKS.map((link) => {
          const active = link.isActive(pathname);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`site-nav-link${active ? ' site-nav-link-on' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <ThemeToggle />
    </header>
  );
}
