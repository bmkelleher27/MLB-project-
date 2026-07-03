import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ExplainerPage } from './pages/ExplainerPage';
import { LandingPage } from './pages/LandingPage';
import { ScorecardPage } from './pages/ScorecardPage';
import { SeasonPage } from './pages/SeasonPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game/:gamePk" element={<ScorecardPage />} />
        <Route path="/stats" element={<ExplainerPage />} />
        <Route path="/season" element={<SeasonPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
