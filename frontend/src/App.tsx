import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { ScorecardPage } from './pages/ScorecardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/game/:gamePk" element={<ScorecardPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
