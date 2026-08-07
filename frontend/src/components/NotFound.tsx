import { Link } from 'react-router-dom';

/** Shown for any URL that matches no route, so a bad link is never a blank page. */
export function NotFound() {
  return (
    <div className="not-found">
      <h1>Page not found</h1>
      <p>That link doesn’t point anywhere in this app.</p>
      <Link to="/" className="not-found-link">
        ‹ Back to today’s games
      </Link>
    </div>
  );
}
