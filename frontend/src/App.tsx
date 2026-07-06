import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AtBatPage } from './pages/AtBatPage';
import { ExplainerPage } from './pages/ExplainerPage';
import { LandingPage } from './pages/LandingPage';
import { PlayerPage } from './pages/PlayerPage';
import { ScorecardPage } from './pages/ScorecardPage';
import { SeasonPage } from './pages/SeasonPage';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/game/:gamePk" element={<ScorecardPage />} />
          <Route path="/game/:gamePk/atbat/:atBatIndex" element={<AtBatPage />} />
          <Route path="/stats" element={<ExplainerPage />} />
          <Route path="/season" element={<SeasonPage />} />
          <Route path="/player/:id" element={<PlayerPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
