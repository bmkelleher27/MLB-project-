import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFound } from './components/NotFound';
import { LandingPage } from './pages/LandingPage';

// The landing page is the common entry, so it loads eagerly. Every other route is
// a separate chunk fetched on demand, keeping the initial bundle small. Pages use
// named exports, so we remap them to the default shape lazy() expects.
const ScorecardPage = lazy(() =>
  import('./pages/ScorecardPage').then((m) => ({ default: m.ScorecardPage })),
);
const AtBatPage = lazy(() => import('./pages/AtBatPage').then((m) => ({ default: m.AtBatPage })));
const ExplainerPage = lazy(() =>
  import('./pages/ExplainerPage').then((m) => ({ default: m.ExplainerPage })),
);
const SeasonPage = lazy(() => import('./pages/SeasonPage').then((m) => ({ default: m.SeasonPage })));
const PlayerPage = lazy(() => import('./pages/PlayerPage').then((m) => ({ default: m.PlayerPage })));

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<p className="status-message">Loading…</p>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/game/:gamePk" element={<ScorecardPage />} />
            <Route path="/game/:gamePk/atbat/:atBatIndex" element={<AtBatPage />} />
            <Route path="/stats" element={<ExplainerPage />} />
            <Route path="/season" element={<SeasonPage />} />
            <Route path="/player/:id" element={<PlayerPage />} />
            {/* Without a catch-all, an unknown URL matched nothing and rendered
                a blank page with no way back. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
